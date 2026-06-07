# ═══════════════════════════════════════════════════════
#  update-resultados.ps1 — Actualiza resultados.json desde KV
#                          y purga caché en Cloudflare
#
#  Uso:
#    .\scripts\update-resultados.ps1              → prod
#    .\scripts\update-resultados.ps1 -Env testing → testing
# ═══════════════════════════════════════════════════════
param(
  [ValidateSet("production","testing")]
  [string]$Env = "production"
)

$ErrorActionPreference = "Stop"

function Ok($m)     { Write-Host "  OK  $m" -ForegroundColor Green }
function Info($m)   { Write-Host "  ... $m" -ForegroundColor Cyan }
function Header($m) { Write-Host "`n━━━ $m ━━━" -ForegroundColor Magenta }

# ── Cargar .env ──
$Root    = Split-Path $PSScriptRoot -Parent
$envFile = Join-Path $Root ".env"
Get-Content $envFile | ForEach-Object {
  if ($_ -match "^\s*([^#][^=]+)=(.+)$") {
    [System.Environment]::SetEnvironmentVariable($Matches[1].Trim(), $Matches[2].Trim(), "Process")
  }
}

$token     = $env:CLOUDFLARE_API_TOKEN
$account   = $env:CF_ACCOUNT_ID
$nsId      = $env:KV_NAMESPACE_ID
$zoneId    = "4d9f84ea27b20128a09a827fe5acf769"
$project   = if ($Env -eq "testing") { $env:CF_TESTING_PROJECT } else { $env:CF_PROJECT_NAME }
$prodUrl   = if ($Env -eq "testing") { $env:CF_TESTING_URL     } else { $env:CF_PROD_URL     }
$jsonUrl   = "$prodUrl/data/resultados.json"

$kvBase  = "https://api.cloudflare.com/client/v4/accounts/$account/storage/kv/namespaces/$nsId/values"
$headers = @{ "Authorization" = "Bearer $token" }

# ── 1. Leer conteos desde KV ──
Header "Leyendo conteos desde KV"

function ReadKV($key) {
  try {
    $r = Invoke-WebRequest "$kvBase/$key" -Headers $headers -UseBasicParsing -ErrorAction Stop
    $text = if ($r.Content -is [byte[]]) {
      [System.Text.Encoding]::UTF8.GetString($r.Content)
    } else { $r.Content }
    return [int]($text.Trim())
  } catch { return 0 }
}

$jp   = ReadKV "jp"
$k    = ReadKV "k"
$nulo = ReadKV "nulo"
$last = try {
  $r = Invoke-WebRequest "$kvBase/last_updated" -Headers $headers -UseBasicParsing -ErrorAction Stop
  if ($r.Content -is [byte[]]) { [System.Text.Encoding]::UTF8.GetString($r.Content).Trim() } else { $r.Content.Trim() }
} catch { (Get-Date -Format "o") }

$total = $jp + $k + $nulo

Ok "JP:   $jp votos"
Ok "K:    $k votos"
Ok "Nulo: $nulo votos"
Ok "Total: $total"

# ── 2. Generar resultados.json ──
Header "Generando resultados.json"

$json = [ordered]@{
  votos = [ordered]@{
    jp   = $jp
    k    = $k
    nulo = $nulo
  }
  total                 = $total
  ultima_actualizacion  = $last
  generado_por          = "update-resultados.ps1 [$Env]"
} | ConvertTo-Json -Depth 3

# Escribir en public/data/ y dist/data/ (si existe)
$publicPath = Join-Path $Root "public\data\resultados.json"
$distPath   = Join-Path $Root "dist\data\resultados.json"

Set-Content $publicPath $json -Encoding UTF8
if (Test-Path (Split-Path $distPath -Parent)) {
  Set-Content $distPath $json -Encoding UTF8
}

Ok "Archivo generado"

# ── 3. Build y deploy ──
Header "Publicando en Cloudflare Pages [$Env]"
Info "Ejecutando build..."
Set-Location $Root
npm run build | Out-Null

$env:CLOUDFLARE_API_TOKEN = $token
$branch = if ($Env -eq "testing") { "testing" } else { "main" }
npx wrangler pages deploy dist --project-name $project --branch $branch

Ok "Deploy completado"

# ── 4. Purgar caché del JSON en Cloudflare ──
Header "Purgando caché"

$purgeBody = @{ files = @($jsonUrl) } | ConvertTo-Json
$purgeHeaders = @{ "Authorization" = "Bearer $token"; "Content-Type" = "application/json" }

$purgeResult = Invoke-RestMethod `
  -Uri "https://api.cloudflare.com/client/v4/zones/$zoneId/purge_cache" `
  -Method POST -Headers $purgeHeaders -Body $purgeBody

if ($purgeResult.success) {
  Ok "Cache purgado: $jsonUrl"
} else {
  Write-Host "  WARN Cache purge fallo: $($purgeResult.errors)" -ForegroundColor Yellow
}

Header "Listo"
Write-Host "  $jsonUrl" -ForegroundColor White
