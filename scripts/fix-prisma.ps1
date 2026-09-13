# Fix-Prisma.ps1
# This script stops potential locking processes and syncs the database

Write-Host "Stopping any running node processes that might lock Prisma binaries..." -ForegroundColor Cyan

# Gracefully stop the dev server if it's running on port 3000
$port3000 = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if ($port3000) {
    Write-Host "Found process on port 3000. Terminating..."
    Stop-Process -Id $port3000.OwningProcess -Force
}

# Stop any other node processes (be careful, but necessary if locking persists)
# Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue

Write-Host "Cleaning up temporary Prisma files..." -ForegroundColor Cyan
Remove-Item -Path "f:\Project\C\Layer 3\3.1\socialynaacara\lib\generated\prisma\*.tmp*" -ErrorAction SilentlyContinue

Write-Host "Generating Prisma Client..." -ForegroundColor Cyan
npx prisma generate

Write-Host "Syncing Database Schema (db push)..." -ForegroundColor Cyan
npx prisma db push --accept-data-loss # Accept data loss if necessary for schema sync during development

Write-Host "Environment fixed and Database synced!" -ForegroundColor Green
Write-Host "You can now run 'npm run dev' again." -ForegroundColor Yellow
