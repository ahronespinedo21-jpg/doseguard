# Ionic CLI Wrapper for DoseGuard App
# This script provides a convenient way to run Ionic CLI commands

if ($args.Count -eq 0) {
    Write-Host "Usage: .\ionic.ps1 [command] [options]" -ForegroundColor Cyan
    Write-Host "Example: .\ionic.ps1 serve" -ForegroundColor Gray
    Write-Host "         .\ionic.ps1 capacitor resource" -ForegroundColor Gray
} elseif ($args[0] -eq "serve") {
    Write-Host "Starting DoseGuard with Angular development server..." -ForegroundColor Green
    Write-Host "Opening http://localhost:4200" -ForegroundColor Cyan
    npm run ionic
} else {
    Write-Host "Running ionic $($args -join ' ')" -ForegroundColor Cyan
    & npx ionic @args
}
