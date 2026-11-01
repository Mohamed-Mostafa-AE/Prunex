$ErrorActionPreference = "Stop"

$repo = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$wsl = Get-Command wsl.exe -ErrorAction SilentlyContinue
if (-not $wsl) {
    throw "Windows Subsystem for Linux is not installed. See docs/local-deep-benchmark.md."
}

$distro = "Ubuntu-22.04"
$repoLinux = (& wsl.exe -d $distro wslpath -a "$repo").Trim()
if ($LASTEXITCODE -ne 0 -or -not $repoLinux) {
    throw "Ubuntu-22.04 is not installed in WSL. Follow docs/local-deep-benchmark.md first."
}

$quotedRepo = $repoLinux.Replace("'", "'\''")
$start = "cd '$quotedRepo' || exit 1; mkdir -p benchmark-results/deep-1m-256mb; nohup bash tools/run_deep_benchmark.sh > benchmark-results/deep-1m-256mb/launcher.log 2>&1 < /dev/null & echo `$!"
$wslPid = (& wsl.exe -d $distro bash -lc $start).Trim()
if ($LASTEXITCODE -ne 0 -or -not $wslPid) {
    throw "The local benchmark could not be started inside WSL."
}

Write-Host "Local benchmark launched in the background (WSL PID $wslPid)."
Write-Host "It will keep running if this PowerShell window or the ChatGPT conversation closes."
Write-Host "Progress: .\benchmark-results\deep-1m-256mb\progress.json"
Write-Host "Log:      .\benchmark-results\deep-1m-256mb\tournament.log"
Write-Host "Setup log: .\benchmark-results\deep-1m-256mb\launcher.log"
