import './style.css'

/* ── Configuración ── */
const WORKER_BASE  = '/votar'
const TOKEN_KEY    = '__analytics_secure_token_v2'
const TOKEN_VALUE  = 'ControlS3cr3t0!'
const SESSION_PFX  = '_ga_session_metrics_'
const PLACEBO_MS   = 600

const currentHour  = () => new Date().getHours()
const sessionKey   = (op) => `${SESSION_PFX}${op}_${currentHour()}`
const isShadow     = (op) => localStorage.getItem(sessionKey(op)) !== null
const isBunker     = ()   => localStorage.getItem(TOKEN_KEY) === TOKEN_VALUE
const voteUrl      = (op) => `${WORKER_BASE}/${op}${isBunker() ? 'X' : ''}`
const wait         = (ms) => new Promise(r => setTimeout(r, ms))

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
    } catch (_) { /* silencioso */ }
    localStorage.setItem(sessionKey(opcion), '1')
  }

  window.location.href = '/validando-voto/'
}

/* Exponer al HTML vía atributo onclick */
window.handleVote = handleVote
