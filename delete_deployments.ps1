# ─── Delete all GitHub Deployments for nexus-rag ───────────────────────────
# Replace YOUR_TOKEN_HERE with a GitHub PAT (repo scope)

$TOKEN  = $env:GITHUB_TOKEN   # set via: $env:GITHUB_TOKEN = "ghp_yourTokenHere"
$OWNER  = "Mdhummad"
$REPO   = "nexus-rag"

$headers = @{
    Authorization = "Bearer $TOKEN"
    Accept        = "application/vnd.github+json"
    "X-GitHub-Api-Version" = "2022-11-28"
}

$base = "https://api.github.com/repos/$OWNER/$REPO"

Write-Host "`n[1/3] Fetching all deployments..." -ForegroundColor Cyan

$page = 1
$allDeployments = @()

do {
    $url  = "$base/deployments?per_page=100&page=$page"
    $resp = Invoke-RestMethod -Uri $url -Headers $headers -Method Get
    $allDeployments += $resp
    $page++
} while ($resp.Count -eq 100)

Write-Host "      Found $($allDeployments.Count) deployments." -ForegroundColor Yellow

if ($allDeployments.Count -eq 0) {
    Write-Host "Nothing to delete!" -ForegroundColor Green
    exit 0
}

Write-Host "`n[2/3] Marking all deployments as inactive..." -ForegroundColor Cyan

foreach ($dep in $allDeployments) {
    $statusUrl = "$base/deployments/$($dep.id)/statuses"
    $body = '{"state":"inactive"}'
    try {
        Invoke-RestMethod -Uri $statusUrl -Headers $headers -Method Post `
            -Body $body -ContentType "application/json" | Out-Null
        Write-Host "  -> Deactivated deployment $($dep.id)" -ForegroundColor DarkGray
    } catch {
        Write-Host "  !! Could not deactivate $($dep.id): $_" -ForegroundColor Red
    }
}

Write-Host "`n[3/3] Deleting all deployments..." -ForegroundColor Cyan

$deleted = 0
$failed  = 0

foreach ($dep in $allDeployments) {
    $delUrl = "$base/deployments/$($dep.id)"
    try {
        Invoke-RestMethod -Uri $delUrl -Headers $headers -Method Delete | Out-Null
        Write-Host "  -> Deleted deployment $($dep.id)" -ForegroundColor DarkGray
        $deleted++
    } catch {
        Write-Host "  !! Failed to delete $($dep.id): $_" -ForegroundColor Red
        $failed++
    }
}

Write-Host "`nDone! Deleted: $deleted  |  Failed: $failed" -ForegroundColor Green
