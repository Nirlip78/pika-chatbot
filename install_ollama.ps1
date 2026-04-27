# install_ollama.ps1 - Download and silently install Ollama
$ErrorActionPreference = "Stop"

$installerUrl = "https://github.com/ollama/ollama/releases/download/v0.21.2/OllamaSetup.exe"
$installerPath = Join-Path $env:TEMP "OllamaSetup_Resumable.exe"

Write-Host "=== Step 1: Downloading Ollama installer ===" -ForegroundColor Cyan
Write-Host "Downloading from $installerUrl ..."

$maxRetries = 20
$retryCount = 0
$success = $false

while (-not $success -and $retryCount -lt $maxRetries) {
    # Use curl.exe with -C - to resume if it fails
    $curlArgs = @("-L", "-C", "-", "-o", $installerPath, $installerUrl)
    Write-Host "Starting/Resuming download... (Attempt $($retryCount + 1))"
    
    $curlProcess = Start-Process -FilePath "curl.exe" -ArgumentList $curlArgs -NoNewWindow -Wait -PassThru
    
    if ($curlProcess.ExitCode -eq 0) {
        $success = $true
        Write-Host "Download successful!" -ForegroundColor Green
    } elseif ($curlProcess.ExitCode -eq 33) {
        # exit code 33 in curl means "HTTP server doesn't seem to support byte ranges"
        # or the file is already fully downloaded
        Write-Host "Curl returned 33, checking file size..."
        # If it's over 1GB, we might be done, or maybe not.
        if ((Test-Path $installerPath) -and ((Get-Item $installerPath).Length -gt 1.5GB)) {
           $success = $true
           Write-Host "File seems to be fully downloaded." -ForegroundColor Green
        } else {
           Write-Host "Resuming not supported or file corrupt, deleting and retrying..." -ForegroundColor Yellow
           Remove-Item $installerPath -Force -ErrorAction SilentlyContinue
           $retryCount++
        }
    } else {
        Write-Host "Download interrupted (Exit code: $($curlProcess.ExitCode)). Retrying in 5 seconds..." -ForegroundColor Yellow
        Start-Sleep -Seconds 5
        $retryCount++
    }
}

if (-not $success) {
    Write-Host "Failed to download Ollama after $maxRetries attempts." -ForegroundColor Red
    exit 1
}

$fileSize = [math]::Round((Get-Item $installerPath).Length / 1MB, 1)
Write-Host "Download complete. File size: $fileSize MB"

Write-Host ""
Write-Host "=== Step 2: Running silent installer ===" -ForegroundColor Cyan
Start-Process -FilePath $installerPath -ArgumentList "/S" -Wait
Write-Host "Installer finished."

Write-Host ""
Write-Host "=== Step 3: Verifying installation ===" -ForegroundColor Cyan
$ollamaPath = "$env:LOCALAPPDATA\Programs\Ollama"
if (Test-Path "$ollamaPath\ollama.exe") {
    $env:Path = "$ollamaPath;$env:Path"
    Write-Host "Ollama found at: $ollamaPath"
    & "$ollamaPath\ollama.exe" --version
} else {
    Write-Host "Not at default path, searching..." -ForegroundColor Yellow
    $found = Get-ChildItem -Path "C:\" -Filter "ollama.exe" -Recurse -Depth 6 -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($found) {
        Write-Host "Found ollama at: $($found.FullName)"
    } else {
        Write-Host "ERROR: Could not find ollama.exe!" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "=== DONE ===" -ForegroundColor Green
