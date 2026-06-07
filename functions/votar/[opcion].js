/**
 * Cloudflare Pages Function: /votar/:opcion
 *
 * Recibe peticiones de voto, aplica fingerprinting por hora
 * y devuelve 200 (voto nuevo) o 429 (ya registrado).
 *
 * RAM Map: persiste mientras el Worker esté caliente.
 * Para persistencia total → migrar a D1 (ver README).
 */

const voteSlots = new Map();

const VALID_OPCIONES = new Set(['jp', 'k', 'nulo']);

/* Clave de hora: cambia cada 60 min → resetea slots */
function hourBucket() {
  return Math.floor(Date.now() / (1000 * 60 * 60));
}

/* SHA-256 del string usando la Web Crypto API del runtime */
async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const buf  = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/* Genera fingerprint único: IP + UA + opcion + hora */
async function buildFingerprint(request, opcion) {
  const ip = request.headers.get('CF-Connecting-IP')
          || request.headers.get('X-Forwarded-For')
          || '0.0.0.0';
  const ua   = request.headers.get('User-Agent') || 'unknown';
  const hour = hourBucket();
  return sha256(`${ip}|${ua}|${opcion}|${hour}`);
}

/* Limpia slots de horas anteriores (mantenimiento básico) */
function pruneOldSlots() {
  const current = hourBucket();
  for (const [key] of voteSlots) {
    const keyHour = parseInt(key.split('_')[0], 10);
    if (keyHour < current) voteSlots.delete(key);
  }
}

/* Cabeceras CORS comunes */
function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };
}

export async function onRequestPost({ request, params }) {
  const origin  = request.headers.get('Origin') || '*';
  const headers = corsHeaders(origin);

  /* ── 1. Extraer y limpiar opción de la URL ── */
  let rawOpcion = (params.opcion || '').toLowerCase();

  // Detectar Modo Búnker: la URL termina en 'x'
  const isBunker = rawOpcion.endsWith('x');
  const opcion   = isBunker ? rawOpcion.slice(0, -1) : rawOpcion;

  if (!VALID_OPCIONES.has(opcion)) {
    return new Response(
      JSON.stringify({ error: 'Opción inválida', code: 'INVALID_OPTION' }),
      { status: 400, headers }
    );
  }

  /* ── 2. Fingerprinting ── */
  const fingerprint = await buildFingerprint(request, opcion);

  /* ── 3. Validar slot en RAM ── */
  pruneOldSlots();
  const slotKey = `${hourBucket()}_${fingerprint}`;

  if (voteSlots.has(slotKey)) {
    return new Response(
      JSON.stringify({
        status: 'already_voted',
        message: 'Ya registraste tu voto en esta sesión',
        code: 'SLOT_OCCUPIED',
      }),
      { status: 429, headers }
    );
  }

  /* ── 4. Registrar voto ── */
  voteSlots.set(slotKey, {
    opcion,
    ts: Date.now(),
    bunker: isBunker,
  });

  return new Response(
    JSON.stringify({
      status: 'registered',
      message: 'Voto registrado exitosamente',
      opcion,
      bunker: isBunker,
    }),
    { status: 200, headers }
  );
}

/* Preflight CORS */
export async function onRequestOptions({ request }) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request.headers.get('Origin') || '*'),
  });
}

/* Rechazar explícitamente GET/PUT/DELETE/etc. */
export async function onRequest({ request }) {
  if (request.method === 'POST' || request.method === 'OPTIONS') return
  return new Response(JSON.stringify({ error: 'Método no permitido' }), {
    status: 405,
    headers: { ...corsHeaders('*'), Allow: 'POST, OPTIONS' },
  })
}
