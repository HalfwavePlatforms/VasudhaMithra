$services = @(
    @{ Name = "API Gateway"; Url = "http://localhost:8000/health" },
    @{ Name = "OCR Pipeline"; Url = "http://localhost:8001/health" },
    @{ Name = "Extraction Engine"; Url = "http://localhost:8002/health" },
    @{ Name = "GIS Service"; Url = "http://localhost:8003/health" },
    @{ Name = "Upload Portal"; Url = "http://localhost:3000" },
    @{ Name = "Dashboard"; Url = "http://localhost:3001" }
)

$failed = $false
foreach ($s in $services) {
    try {
        $resp = Invoke-WebRequest -Uri $s.Url -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
        Write-Host ("OK    {0,-20} ({1})" -f $s.Name, $s.Url) -ForegroundColor Green
    } catch {
        Write-Host ("DOWN  {0,-20} ({1})" -f $s.Name, $s.Url) -ForegroundColor Red
        $failed = $true
    }
}

if ($failed) {
    Write-Host "`nOne or more services are down." -ForegroundColor Red
    exit 1
} else {
    Write-Host "`nAll services healthy. Good to demo." -ForegroundColor Green
    exit 0
}