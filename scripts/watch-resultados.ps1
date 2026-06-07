# ═══════════════════════════════════════════════════════
#  watch-resultados.ps1 — Actualiza conteos cada 60s
#
#  Uso:
#    .\scripts\watch-resultados.ps1              → prod
#    .\scripts\watch-resultados.ps1 -Env testing → testing
#    Ctrl+C para detener
# ═══════════════════════════════════════════════════════
param(
  [ValidateSet("production","testing")]
  [string]$Env = "production",
  [int]$IntervalSeg = 60
)

$script = Join-Path $PSScriptRoot "update-resultados.ps1"
$i = 1

Write-Host "`n▶  Watch iniciado — actualizando cada ${IntervalSeg}s  [Ctrl+C para detener]`n" -ForegroundColor Cyan

while ($true) {
  $ts = Get-Date -Format "HH:mm:ss"
  Write-Host "[$ts] Iteración #$i" -ForegroundColor DarkGray
  & $script -Env $Env
  $i++
  Write-Host "`n  Próxima actualización en ${IntervalSeg}s...`n" -ForegroundColor DarkGray
  Start-Sleep -Seconds $IntervalSeg
}
