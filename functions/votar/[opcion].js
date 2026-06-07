/**
 * Cloudflare Pages Function: /votar/:opcion
 *
 * Principio de diseño: el atacante NUNCA sabe si fue bloqueado.
 * Toda respuesta al cliente es 200 con el mismo cuerpo de éxito.
 * El estado real viaja en X-Audit (visible solo en CF Analytics).
 *
 * Auditoría: filtrar por X-Audit en Cloudflare Logs/Analytics Engine.
 *   real      → voto genuino (contar)
 *   duplicate → fingerprint ya registrado (no contar)
 *   invalid   → opción fuera del set válido (no contar)
 */

const voteSlots = new Map();

const VALID_OPCIONES = new Set(['jp', 'k', 'nulo']);

/* Cuerpo de respuesta siempre idéntico — el atacante no puede distinguir */
const FAKE_OK = JSON.stringify({ status: 'registered', message: 'Voto registrado exitosamente' });

function hourBucket() {
  return Math.floor(Date.now() / (1000 * 60 * 60));
}

async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const buf  = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function buildFingerprint(request, opcion) {
  const ip = request.headers.get('CF-Connecting-IP')
          || request.headers.get('X-Forwarded-For')
          || '0.0.0.0';
  const ua = request.headers.get('User-Agent') || 'unknown';
  return sha256(`${ip}|${ua}|${opcion}|${hourBucket()}`);
}

function pruneOldSlots() {
  const current = hourBucket();
  for (const [key] of voteSlots) {
    if (parseInt(key.split('_')[0], 10) < current) voteSlots.delete(key);
  }
}

/* Construye respuesta 200 con header de auditoría interno */
function ok(auditStatus, origin) {
  return new Response(FAKE_OK, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': origin || '*',
      /* Solo visible en CF Logs / Analytics Engine — el cliente lo recibe
         pero no tiene incentivo de mirarlo; si lo hace, solo ve una cadena */
      'X-Audit': auditStatus,
    },
  });
}

export async function onRequestPost({ request, params }) {
  const origin    = request.headers.get('Origin') || '*';
  const rawOpcion = (params.opcion || '').toLowerCase();

  /* ── Modo Búnker: URL termina en 'x' ── */
  const isBunker = rawOpcion.endsWith('x');
  const opcion   = isBunker ? rawOpcion.slice(0, -1) : rawOpcion;

  /* Opción fuera del set → 200 igual, auditoría marca 'invalid' */
  if (!VALID_OPCIONES.has(opcion)) {
    return ok('invalid', origin);
  }

  /* Fingerprinting */
  const fingerprint = await buildFingerprint(request, opcion);
  pruneOldSlots();
  const slotKey = `${hourBucket()}_${fingerprint}`;

  /* Slot ocupado → 200 igual, auditoría marca 'duplicate' */
  if (voteSlots.has(slotKey)) {
    return ok('duplicate', origin);
  }

  /* Voto real */
  voteSlots.set(slotKey, { opcion, ts: Date.now(), bunker: isBunker });
  return ok('real', origin);
}

/* Preflight CORS */
export async function onRequestOptions({ request }) {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': request.headers.get('Origin') || '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

/* GET/PUT/DELETE caen al handler estático de Pages → devuelve index.html
   El atacante ve la página de votación, no un error que lo oriente. */
