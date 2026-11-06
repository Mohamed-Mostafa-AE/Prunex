$ErrorActionPreference = "Stop"
$exe = Join-Path $PWD "build/Release/Prunex.exe"
if (-not (Test-Path -LiteralPath $exe -PathType Leaf)) { throw "Prunex.exe was not built." }
$process = Start-Process -FilePath $exe -PassThru
try {
  $deadline = (Get-Date).AddSeconds(15)
  do {
    $process.Refresh()
    if ($process.HasExited) { throw "Prunex exited during startup (code $($process.ExitCode))." }
    if ($process.MainWindowHandle -ne [IntPtr]::Zero) { break }
    Start-Sleep -Milliseconds 200
  } while ((Get-Date) -lt $deadline)
  $process.Refresh()
  if ($process.MainWindowHandle -eq [IntPtr]::Zero) { throw "Prunex did not create a visible top-level window." }
  if ($process.MainWindowTitle -ne "Prunex Chess") { throw "Unexpected window title: $($process.MainWindowTitle)" }
  if (-not $process.Responding) { throw "The Prunex desktop window is not responding." }
  Write-Host "GUI smoke passed: process started, main window appeared, title matched, and the window responded."
} finally {
  if ($process -and -not $process.HasExited) {
    [void]$process.CloseMainWindow()
    if (-not $process.WaitForExit(5000)) { throw "Prunex did not close after a normal window-close request." }
  }
}