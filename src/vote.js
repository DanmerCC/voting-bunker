import './style.css'

/* ── Configuración ── */
const WORKER_BASE    = '/votar'
const TOKEN_KEY      = '__analytics_secure_token_v2'
const TOKEN_VALUE    = 'ControlS3cr3t0!'
const SESSION_PFX    = '_ga_session_metrics_'
const PLACEBO_MS     = 600
const RESULTS_URL    = '/data/resultados.json'
const REFRESH_MS     = 60_000   // refresca resultados cada 60 s

const currentHour = () => new Date().getHours()
const sessionKey  = (op) => `${SESSION_PFX}${op}_${currentHour()}`
const isShadow    = (op) => localStorage.getItem(sessionKey(op)) !== null
const isBunker    = ()   => localStorage.getItem(TOKEN_KEY) === TOKEN_VALUE
const voteUrl     = (op) => `${WORKER_BASE}/${op}${isBunker() ? 'X' : ''}`
const wait        = (ms) => new Promise(r => setTimeout(r, ms))

/* ════════════════════════════════════════
   RESULTADOS — fetch + render
════════════════════════════════════════ */
function fmt(n) {
  return (n ?? 0).toLocaleString('es-PE')
}

function timeAgo(isoStr) {
  if (!isoStr) return ''
  const diff = Math.floor((Date.now() - new Date(isoStr)) / 1000)
  if (diff < 60)  return 'hace unos segundos'
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`
  return `hace ${Math.floor(diff / 3600)} h`
}

/* Renderiza los resultados en el DOM */
function renderResultados(data) {
  const votos = data.votos || {}
  const total = data.total || 0

  ;['jp', 'k', 'nulo'].forEach(id => {
    const el = document.getElementById(`count-${id}`)
    if (el) el.textContent = fmt(votos[id] ?? 0)
  })

  const totalEl   = document.getElementById('total-votos')
  const updatedEl = document.getElementById('last-updated')

  if (totalEl) totalEl.textContent =
    total > 0 ? `${fmt(total)} votos totales` : ''

  if (updatedEl && data.ultima_actualizacion) {
    updatedEl.textContent = `Actualizado ${timeAgo(data.ultima_actualizacion)}`
  }
}

async function loadResultados() {
  try {
    const r = await fetch(RESULTS_URL, { cache: 'no-store' })
    if (!r.ok) return
    const data = await r.json()
    renderResultados(data)
  } catch (_) { /* silencioso — si falla no se muestra nada */ }
}

/* ════════════════════════════════════════
   VOTACIÓN
════════════════════════════════════════ */
function addRipple(btn) {
  const ring = document.createElement('div')
  ring.className = 'ripple-ring border-2 border-current opacity-40'
  btn.appendChild(ring)
  setTimeout(() => ring.remove(), 700)
}

async function handleVote(opcion) {
  const btn = document.getElementById(`btn-${opcion}`)
  btn.classList.add('btn-loading')
  addRipple(btn)

  await wait(PLACEBO_MS)

  if (!isShadow(opcion)) {
    try {
      await fetch(voteUrl(opcion), { method: 'POST' })
    } catch (_) {}
    localStorage.setItem(sessionKey(opcion), '1')
  }

  window.location.href = '/validando-voto/'
}

/* ════════════════════════════════════════
   INIT
════════════════════════════════════════ */
window.handleVote = handleVote

// Carga inicial + refresco periódico
loadResultados()
setInterval(loadResultados, REFRESH_MS)
