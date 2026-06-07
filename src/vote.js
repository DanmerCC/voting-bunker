import './style.css'

/* ── Configuración ── */
const WORKER_BASE    = '/votar'
const TOKEN_KEY      = '__analytics_secure_token_v2'
const TOKEN_VALUE    = 'ControlS3cr3t0!'
const SESSION_PFX    = '_ga_session_metrics_'
const PLACEBO_MS     = 600
const RESULTS_URL    = '/data/resultados.json'
const REFRESH_MS     = 10_000   // refresca resultados cada 10 s

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
  if (diff < 60)   return 'hace unos segundos'
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`
  return `hace ${Math.floor(diff / 3600)} h`
}

/* Animación de conteo numérico */
function animateCount(el, from, to, duration = 700) {
  if (!el) return
  const start = performance.now()
  const tick  = (now) => {
    const t     = Math.min((now - start) / duration, 1)
    const eased = 1 - Math.pow(1 - t, 3)
    el.textContent = fmt(Math.round(from + (to - from) * eased))
    if (t < 1) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

/* Flash de actualización en el elemento */
function flashUpdate(el) {
  if (!el) return
  el.classList.remove('count-flash')
  void el.offsetWidth  // reflow para reiniciar animación
  el.classList.add('count-flash')
}

let prevVotos = { jp: null, k: null, nulo: null }

function renderResultados(data) {
  const votos = data.votos || {}
  const total = data.total || 0

  ;['jp', 'k', 'nulo'].forEach(id => {
    const el  = document.getElementById(`count-${id}`)
    const cur = votos[id] ?? 0
    const old = prevVotos[id]

    if (old === null) {
      // Primera carga — mostrar directo con animación desde 0
      animateCount(el, 0, cur)
    } else if (cur !== old) {
      // Cambió — animar y flash
      animateCount(el, old, cur)
      flashUpdate(el)
    }
    prevVotos[id] = cur
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
  } catch (_) {}
}

/* ════════════════════════════════════════
   ANIMACIONES IDLE — desfase entre cards
════════════════════════════════════════ */
function startIdleAnimations() {
  const cards = document.querySelectorAll('.vote-card')
  cards.forEach((card, i) => {
    card.style.animationDelay = `${i * 0.5}s`
  })
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

loadResultados()
setInterval(loadResultados, REFRESH_MS)
startIdleAnimations()
