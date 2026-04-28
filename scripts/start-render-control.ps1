$ErrorActionPreference = "Stop"

$WorkspaceRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$RemotionDir = Join-Path $WorkspaceRoot "remotion-app"
$BackendDir = Join-Path $WorkspaceRoot "backend"
$RemotionOut = Join-Path $RemotionDir "out"
$BackendOut = Join-Path $BackendDir "out"
$RemotionLog = Join-Path $RemotionOut "preview-web-3010.log"
$RemotionErr = Join-Path $RemotionOut "preview-web-3010.err.log"
$BackendLog = Join-Path $BackendOut "backend-8000.log"
$BackendErr = Join-Path $BackendOut "backend-8000.err.log"

function Test-LocalUrl {
  param([string] $Url)

  try {
    $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
    return $response.StatusCode -ge 200 -and $response.StatusCode -lt 500
  } catch {
    return $false
  }
}

function Start-LoggedCommand {
  param(
    [string] $Name,
    [string] $WorkingDirectory,
    [string] $Command,
    [string] $StdoutPath,
    [string] $StderrPath
  )

  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $StdoutPath) | Out-Null
  Remove-Item -LiteralPath $StdoutPath -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $StderrPath -Force -ErrorAction SilentlyContinue

  $redirectedCommand = "$Command > `"$StdoutPath`" 2> `"$StderrPath`""
  $process = Start-Process -FilePath $env:ComSpec -ArgumentList @("/c", $redirectedCommand) -WorkingDirectory $WorkingDirectory -PassThru
  Write-Host "$Name started with launcher PID $($process.Id)."
}

if (Test-LocalUrl "http://127.0.0.1:3010") {
  Write-Host "Remotion control app is already live at http://127.0.0.1:3010"
} else {
  Start-LoggedCommand `
    -Name "Remotion control app" `
    -WorkingDirectory $RemotionDir `
    -Command "npm.cmd run dev -- --host 127.0.0.1" `
    -StdoutPath $RemotionLog `
    -StderrPath $RemotionErr
}

if (Test-LocalUrl "http://127.0.0.1:8000/health") {
  Write-Host "Backend is already live at http://127.0.0.1:8000"
} else {
  Start-LoggedCommand `
    -Name "Backend" `
    -WorkingDirectory $BackendDir `
    -Command "npm.cmd run start" `
    -StdoutPath $BackendLog `
    -StderrPath $BackendErr
}

Write-Host "Waiting for services..."
$deadline = (Get-Date).AddSeconds(45)
do {
  $remotionReady = Test-LocalUrl "http://127.0.0.1:3010"
  $backendReady = Test-LocalUrl "http://127.0.0.1:8000/health"

  if ($remotionReady -and $backendReady) {
    Write-Host "Ready."
    Write-Host "Open: http://127.0.0.1:3010"
    Write-Host "Backend health: http://127.0.0.1:8000/health"
    Write-Host "Remotion log: $RemotionLog"
    Write-Host "Backend log: $BackendLog"
    exit 0
  }

  Start-Sleep -Seconds 2
} while ((Get-Date) -lt $deadline)

Write-Warning "One or more services did not become ready in time."
Write-Host "Remotion log tail:"
Get-Content -Path $RemotionLog -Tail 40 -ErrorAction SilentlyContinue
Write-Host "Backend log tail:"
Get-Content -Path $BackendLog -Tail 40 -ErrorAction SilentlyContinue
exit 1
