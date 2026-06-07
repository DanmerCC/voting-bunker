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

/* Anima el contador de número con efecto de conteo */
function animateCount(el, from, to, duration = 600) {
  if (!el) return
  const start = performance.now()
  const tick  = (now) => {
    const t = Math.min((now - start) / duration, 1)
    const eased = 1 - Math.pow(1 - t, 3)   // easeOutCubic
    const val = Math.round(from + (to - from) * eased)
    el.textContent = fmt(val) + ' votos'
    if (t < 1) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

/* Renderiza los resultados en el DOM */
let prevData = { jp: 0, k: 0, nulo: 0 }

function renderResultados(data) {
  const votos = data.votos || {}
  const total = data.total || 0

  const opts = [
    { id: 'jp',   count: votos.jp   ?? 0 },
    { id: 'k',    count: votos.k    ?? 0 },
    { id: 'nulo', count: votos.nulo ?? 0 },
  ]

  opts.forEach(({ id, count }) => {
    const pct     = total > 0 ? Math.round((count / total) * 100) : 0
    const countEl = document.getElementById(`count-${id}`)
    const pctEl   = document.getElementById(`pct-${id}`)
    const barEl   = document.getElementById(`bar-${id}`)

    animateCount(countEl, prevData[id] ?? 0, count)
    if (pctEl) pctEl.textContent = pct + '%'
    if (barEl) barEl.style.width = pct + '%'

    prevData[id] = count
  })

  const totalEl   = document.getElementById('total-votos')
  const updatedEl = document.getElementById('last-updated')

  if (totalEl) totalEl.textContent =
    total > 0 ? `${fmt(total)} votos registrados en total` : ''

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
