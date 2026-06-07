# ═══════════════════════════════════════════════════════
#  setup-kv.ps1 — Crea namespaces KV e inyecta IDs en wrangler.toml
#  Ejecutar UNA sola vez tras agregar Workers KV al token.
# ═══════════════════════════════════════════════════════
$ErrorActionPreference = "Stop"

$Root    = Split-Path $PSScriptRoot -Parent
$envFile = Join-Path $Root ".env"
Get-Content $envFile | ForEach-Object {
  if ($_ -match "^\s*([^#][^=]+)=(.+)$") {
    [System.Environment]::SetEnvironmentVariable($Matches[1].Trim(), $Matches[2].Trim(), "Process")
  }
}

$token   = $env:CLOUDFLARE_API_TOKEN
$account = $env:CF_ACCOUNT_ID
$base    = "https://api.cloudflare.com/client/v4/accounts/$account/storage/kv/namespaces"
$headers = @{ "Authorization" = "Bearer $token"; "Content-Type" = "application/json" }

function CreateNS($title) {
  $r = Invoke-RestMethod -Uri $base -Method POST -Headers $headers `
    -Body (ConvertTo-Json @{ title = $title })
  if ($r.success) { return $r.result.id }
  throw "Error creando KV '$title': $($r.errors)"
}

Write-Host "Creando namespaces KV..." -ForegroundColor Cyan
$prodId    = CreateNS "voting-bunker-votes"
$previewId = CreateNS "voting-bunker-votes-preview"

Write-Host "  Prod:    $prodId" -ForegroundColor Green
Write-Host "  Preview: $previewId" -ForegroundColor Green

# Inyectar IDs en wrangler.toml
$toml = Get-Content (Join-Path $Root "wrangler.toml") -Raw
$toml = $toml -replace "KV_PROD_ID_PLACEHOLDER",    $prodId
$toml = $toml -replace "KV_PREVIEW_ID_PLACEHOLDER", $previewId
Set-Content (Join-Path $Root "wrangler.toml") $toml

# Guardar en .env para que update-resultados.ps1 pueda leerlos
Add-Content $envFile "`nKV_NAMESPACE_ID=$prodId"

Write-Host "wrangler.toml actualizado. Ejecuta deploy.ps1 para aplicar." -ForegroundColor Green
