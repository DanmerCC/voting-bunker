import './style.css'

/* ════ HISTORY HIJACKING ════ */
history.replaceState(null, '', '/verificacion-completada')

/* ════ TRAMPA BOTÓN ATRÁS ════ */
history.pushState({ trapped: true }, '')
window.addEventListener('popstate', () => {
  history.pushState({ trapped: true }, '')
  resetAnimation()
})

/* ════ ANIMACIÓN NO LINEAL ════ */
const fill   = document.getElementById('progress-fill')
const pctLbl = document.getElementById('pct-label')
const statusT = document.getElementById('status-text')

const STAGES = [
  { target: 28,  ms: 700,  msg: 'Validando token de sesión...',  step: 'step-1' },
  { target: 55,  ms: 1000, msg: 'Generando huella digital...',   step: 'step-2' },
  { target: 80,  ms: 900,  msg: 'Registrando en el búnker...',   step: 'step-3' },
  { target: 94,  ms: 700,  msg: 'Firmando con auditoría...',     step: 'step-4' },
  { target: 100, ms: 400,  msg: 'Completando...',                step: null    },
]

let pct = 0, stageIdx = 0, timer = null

function setStep(id, state) {
  if (!id) return
  const el  = document.getElementById(id)
  const dot = el.querySelector('div')
  if (state === 'active') {
    el.classList.replace('text-slate-500', 'text-blue-400')
    dot.classList.replace('bg-slate-600', 'bg-blue-400')
  } else if (state === 'done') {
    el.classList.replace('text-blue-400', 'text-emerald-400')
    dot.classList.replace('bg-blue-400', 'bg-emerald-400')
  }
}

function animateTo(target, ms, onDone) {
  const start = pct, delta = target - start, t0 = performance.now()
  const tick = (now) => {
    const t = Math.min((now - t0) / ms, 1)
    const e = t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t+2, 2)/2  // easeInOutQuad
    pct = start + delta * e
    fill.style.width = pct + '%'
    pctLbl.textContent = Math.round(pct) + '%'
    t < 1 ? requestAnimationFrame(tick) : (pct = target, fill.style.width = target+'%', pctLbl.textContent = target+'%', onDone?.())
  }
  requestAnimationFrame(tick)
}

function runStage(i) {
  if (i >= STAGES.length) { onComplete(); return }
  const prev = STAGES[i - 1], s = STAGES[i]
  if (prev?.step) setStep(prev.step, 'done')
  setStep(s.step, 'active')
  statusT.textContent = s.msg
  animateTo(s.target, s.ms, () => { stageIdx = i+1; timer = setTimeout(() => runStage(stageIdx), 120) })
}

function onComplete() {
  setStep(STAGES[STAGES.length - 2]?.step, 'done')
  document.getElementById('vote-ref').textContent =
    'REF-' + Math.random().toString(36).slice(2, 10).toUpperCase()
  document.getElementById('ts-label').textContent =
    new Date().toLocaleTimeString('es-ES')

  setTimeout(() => {
    document.getElementById('state-loading').style.display = 'none'
    Object.assign(document.getElementById('state-done').style, {
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem',
    })
  }, 300)
}

function resetAnimation() {
  clearTimeout(timer)
  pct = 0; stageIdx = 0
  fill.style.width = '0%'
  pctLbl.textContent = '0%'
  statusT.textContent = 'Iniciando protocolo seguro...'
  ;['step-1','step-2','step-3','step-4'].forEach(id => {
    const el = document.getElementById(id)
    el.className = 'flex items-center gap-3 text-slate-500 text-xs'
    el.querySelector('div').className = 'w-1.5 h-1.5 rounded-full bg-slate-600'
  })
  document.getElementById('state-loading').style.display = 'flex'
  document.getElementById('state-done').style.display   = 'none'
  setTimeout(() => runStage(0), 200)
}

setTimeout(() => runStage(0), 300)
