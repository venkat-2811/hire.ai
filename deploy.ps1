param(
    [string]$Host = "root@147.93.27.101",
    [string]$Key  = "$env:USERPROFILE\.ssh\id_ed25519_rekshift"
)

$SSH = "ssh -i `"$Key`" -o StrictHostKeyChecking=no $Host"

Write-Host "==> Pulling latest code on VPS..." -ForegroundColor Cyan
Invoke-Expression "$SSH 'cd /root/hire.ai && git pull origin main'"

Write-Host "==> Installing frontend dependencies..." -ForegroundColor Cyan
Invoke-Expression "$SSH 'cd /root/hire.ai && npm ci --prefer-offline 2>&1 | tail -5'"

Write-Host "==> Building frontend..." -ForegroundColor Cyan
Invoke-Expression "$SSH 'cd /root/hire.ai && npm run build'"

Write-Host "==> Installing backend dependencies..." -ForegroundColor Cyan
Invoke-Expression "$SSH 'cd /root/hire.ai/backend && pip install -r requirements.txt -q'"

Write-Host "==> NOTE: Run migration 008 manually in Supabase SQL editor:" -ForegroundColor Yellow
Write-Host "    ALTER TABLE public.job_descriptions ADD COLUMN IF NOT EXISTS end_customer text NULL, ADD COLUMN IF NOT EXISTS end_customer_name text NULL;" -ForegroundColor Yellow

Write-Host "==> Restarting backend service..." -ForegroundColor Cyan
Invoke-Expression "$SSH 'systemctl restart hireai && systemctl is-active hireai'"

Write-Host "==> Reloading nginx..." -ForegroundColor Cyan
Invoke-Expression "$SSH 'nginx -t && systemctl reload nginx'"

Write-Host "==> Deploy complete!" -ForegroundColor Green
