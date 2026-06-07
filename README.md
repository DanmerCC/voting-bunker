# 🗳️ Voting Búnker

Sistema de votación con capas de protección anti-spam y anti-bots.  
Desplegado en **Cloudflare Pages + Functions** (plan gratuito).

---

## Arquitectura de seguridad

| Capa | Mecanismo | Dónde |
|---|---|---|
| 1 | UX Placebo (spinner, no deshabilita botón) | Frontend |
| 2 | Shadow Blocking (`localStorage` por hora) | Frontend |
| 3 | URL Tampering / Modo Búnker | Frontend → Worker |
| 4 | Cloudflare Turnstile Invisible | Red |
| 5 | Rate Limiting (5 req/min por IP) | Red |
| 6 | Fingerprint Hash (IP + UA + opción + hora) | Worker |
| 7 | RAM Slot (Map en memoria) | Worker |
| 8 | History Hijacking + Trampa botón atrás | Frontend |

---

## Estructura de archivos

```
voting-bunker/
├── public/
│   ├── index.html                 # Página de votación principal
│   └── validando-voto/
│       └── index.html             # Página de carga / verificación
├── functions/
│   └── votar/
│       └── [opcion].js            # Cloudflare Pages Function (Worker)
├── wrangler.toml                  # Configuración de Cloudflare
├── package.json
└── README.md
```

---

## Inicio rápido

### 1. Instalar dependencias

```bash
npm install
```

### 2. Desarrollo local

```bash
npm run dev
# → http://localhost:8788
```

### 3. Desplegar a Cloudflare Pages

```bash
npm run deploy
```

---

## Configuración en Cloudflare Dashboard

### Rate Limiting (obligatorio)

1. Dashboard → **Security** → **WAF** → **Rate Limiting Rules**
2. Nueva regla:
   - **URI Path** contiene `/votar/`
   - Límite: **5 requests / 60 segundos** por IP
   - Acción: **Block** (devuelve 429)

### Turnstile Invisible (recomendado)

1. Dashboard → **Security** → **Turnstile**
2. Crear un widget `Invisible`
3. Copiar la **Site Key** y añadirla en `public/index.html`:
   ```html
   <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
   ```
4. Añadir el widget invisible al formulario y validar el token en el Worker.

---

## Modo Búnker (admin)

Para que las peticiones del administrador incluyan el ruido de URL (`X`),
ejecutar en la consola del navegador en la página de votación:

```javascript
localStorage.setItem('__analytics_secure_token_v2', 'ControlS3cr3t0!');
```

Con esto, el fetch irá a `/votar/jpX` en lugar de `/votar/jp`,
lo que permite al Worker identificar tráfico de auditoría.

Para desactivar:

```javascript
localStorage.removeItem('__analytics_secure_token_v2');
```

---

## Cómputo de resultados

Al finalizar el período de votación:

1. Accede a **Cloudflare Analytics** (Dashboard → Pages → tu proyecto → Analytics)
2. Filtra por ruta `/votar/*`
3. Calcula:
   - **Votos válidos** = peticiones con status `200`
   - **Intentos de spam** = peticiones con status `429` o `403`

---

## Limitación: Cold Starts de Workers

Si el Worker lleva varios minutos sin recibir tráfico, Cloudflare puede apagarlo
y perder el `Map` en RAM. Para alta precisión en periodos de baja actividad,
migrar el slot a **D1** (base de datos SQLite gratuita de Cloudflare):

```javascript
// En [opcion].js, reemplazar voteSlots.has/set por:
const row = await env.DB.prepare(
  'SELECT 1 FROM votes WHERE slot_key = ?'
).bind(slotKey).first();

if (row) return /* 429 */;

await env.DB.prepare(
  'INSERT INTO votes (slot_key, opcion, ts) VALUES (?, ?, ?)'
).bind(slotKey, opcion, Date.now()).run();
```

---

## Stack

- **Frontend**: HTML5 + Tailwind CSS (CDN) + JS vanilla
- **Edge**: Cloudflare Pages Functions (Workers runtime)
- **Seguridad de red**: Cloudflare WAF + Turnstile
