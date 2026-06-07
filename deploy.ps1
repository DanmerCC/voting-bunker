# ═══════════════════════════════════════════════════════
#  deploy.ps1 — Script de despliegue automatizado
#  Voting Búnker → Cloudflare Pages (elecciones2026)
#
#  Uso:
#    .\deploy.ps1              → build + deploy CF Pages
#    .\deploy.ps1 -SkipBuild   → deploy sin rebuild
#    .\deploy.ps1 -DryRun      → solo build, sin subir
# ═══════════════════════════════════════════════════════
param(
  [switch]$SkipBuild,
  [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ── Colores ──
function Info($msg)    { Write-Host "  $msg" -ForegroundColor Cyan }
function Ok($msg)      { Write-Host "  ✓ $msg" -ForegroundColor Green }
function Warn($msg)    { Write-Host "  ⚠ $msg" -ForegroundColor Yellow }
function Err($msg)     { Write-Host "  ✗ $msg" -ForegroundColor Red; exit 1 }
function Header($msg)  { Write-Host "`n━━━ $msg ━━━" -ForegroundColor Magenta }

$Root = $PSScriptRoot

# ── 1. Cargar .env ──
Header "Cargando configuración"
$envFile = Join-Path $Root ".env"
if (-not (Test-Path $envFile)) { Err ".env no encontrado en $Root" }

Get-Content $envFile | ForEach-Object {
  if ($_ -match "^\s*([^#][^=]+)=(.+)$") {
    [System.Environment]::SetEnvironmentVariable($Matches[1].Trim(), $Matches[2].Trim(), "Process")
  }
}

$token   = $env:CLOUDFLARE_API_TOKEN
$project = $env:CF_PROJECT_NAME
$url     = $env:CF_URL

if (-not $token)   { Err "CLOUDFLARE_API_TOKEN no está en .env" }
if (-not $project) { Err "CF_PROJECT_NAME no está en .env" }

Ok "Proyecto : $project"
Ok "URL      : $url"

# ── 2. Build ──
if (-not $SkipBuild) {
  Header "Build de producción (Vite)"
  Set-Location $Root
  npm run build
  if ($LASTEXITCODE -ne 0) { Err "npm run build falló" }
  Ok "dist/ generado correctamente"
} else {
  Warn "Build omitido (-SkipBuild)"
}

# ── 3. Deploy a Cloudflare Pages ──
if (-not $DryRun) {
  Header "Deploy → Cloudflare Pages"
  $env:CLOUDFLARE_API_TOKEN = $token

  npx wrangler pages deploy dist `
    --project-name $project `
    --branch main

  if ($LASTEXITCODE -ne 0) { Err "Deploy falló" }
  Ok "Deploy completado"
  Write-Host ""
  Write-Host "  🌐  $url" -ForegroundColor White
} else {
  Warn "Deploy omitido (-DryRun). Build listo en dist/"
}

Header "Todo listo"
