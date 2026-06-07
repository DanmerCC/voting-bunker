/**
 * Cloudflare Pages Function: /votar/:opcion
 *
 * Principio de diseño: el atacante NUNCA sabe si fue bloqueado.
 * Toda respuesta al cliente es 200 con el mismo cuerpo de éxito.
 * El estado real viaja en X-Audit (visible solo en CF Analytics).
 *
 * Conteos reales → KV (binding VOTES) para persistencia cross-restart.
 * Auditoría: filtrar por X-Audit en Cloudflare Logs/Analytics Engine.
 *   real      → voto genuino (KV incrementado)
 *   duplicate → fingerprint ya registrado (no cuenta)
 *   invalid   → opción fuera del set válido (no cuenta)
 */

const voteSlots     = new Map();
const VALID_OPCIONES = new Set(['jp', 'k', 'nulo']);
const FAKE_OK        = JSON.stringify({ status: 'registered', message: 'Voto registrado exitosamente' });

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

/* Incrementa el contador en KV de forma atómica (best-effort) */
async function incrementKV(env, opcion) {
  if (!env.VOTES) return;  // KV no configurado todavía
  try {
    const current = parseInt(await env.VOTES.get(opcion) || '0', 10);
    await env.VOTES.put(opcion, String(current + 1));
    // Actualizar también el timestamp del último voto
    await env.VOTES.put('last_updated', new Date().toISOString());
  } catch (_) { /* silencioso — el voto se registra igual */ }
}

function ok(auditStatus, origin) {
  return new Response(FAKE_OK, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': origin || '*',
      'X-Audit': auditStatus,
    },
  });
}

export async function onRequestPost({ request, params, env, ctx }) {
  const origin    = request.headers.get('Origin') || '*';
  const rawOpcion = (params.opcion || '').toLowerCase();

  const isBunker = rawOpcion.endsWith('x');
  const opcion   = isBunker ? rawOpcion.slice(0, -1) : rawOpcion;

  if (!VALID_OPCIONES.has(opcion)) {
    return ok('invalid', origin);
  }

  const fingerprint = await buildFingerprint(request, opcion);
  pruneOldSlots();
  const slotKey = `${hourBucket()}_${fingerprint}`;

  if (voteSlots.has(slotKey)) {
    return ok('duplicate', origin);
  }

  voteSlots.set(slotKey, { opcion, ts: Date.now(), bunker: isBunker });

  /* Incrementar KV en background (no bloquea la respuesta) */
  ctx.waitUntil(incrementKV(env, opcion));

  return ok('real', origin);
}

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
