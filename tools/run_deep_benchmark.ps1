$ErrorActionPreference = "Stop"

$repo = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$wsl = Get-Command wsl.exe -ErrorAction SilentlyContinue
if (-not $wsl) {
    throw "Windows Subsystem for Linux is not installed. See docs/local-deep-benchmark.md."
}

$repoLinux = (& wsl.exe wslpath -a "$repo").Trim()
if ($LASTEXITCODE -ne 0 -or -not $repoLinux) {
    throw "Could not resolve the project folder inside WSL. Install an Ubuntu WSL distribution first."
}

$quotedRepo = $repoLinux.Replace("'", "'\''")
& wsl.exe bash -lc "cd '$quotedRepo' && bash tools/run_deep_benchmark.sh"
exit $LASTEXITCODE
