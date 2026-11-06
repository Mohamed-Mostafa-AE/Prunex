$ErrorActionPreference = "Stop"

$exe = Join-Path $PWD "build/Release/Prunex.exe"
if (-not (Test-Path -LiteralPath $exe -PathType Leaf)) {
  throw "Prunex.exe was not built."
}

if (-not ("PrunexSmokeInput" -as [type])) {
  Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public static class PrunexSmokeInput
{
    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool PostMessage(IntPtr hWnd, uint message, IntPtr wParam, IntPtr lParam);

    public static void Click(IntPtr window, int x, int y)
    {
        const uint WM_LBUTTONDOWN = 0x0201;
        const uint WM_LBUTTONUP = 0x0202;
        IntPtr point = new IntPtr(((y & 0xffff) << 16) | (x & 0xffff));

        if (!PostMessage(window, WM_LBUTTONDOWN, new IntPtr(1), point))
            throw new InvalidOperationException("Could not post mouse-down to the Prunex window.");
        if (!PostMessage(window, WM_LBUTTONUP, IntPtr.Zero, point))
            throw new InvalidOperationException("Could not post mouse-up to the Prunex window.");
    }
}
"@
}

function Wait-ForTitle([Diagnostics.Process] $Target, [string] $Pattern, [int] $TimeoutSeconds = 30) {
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  do {
    $Target.Refresh()
    if ($Target.HasExited) {
      throw "Prunex exited while waiting for '$Pattern' (code $($Target.ExitCode))."
    }
    if ($Target.MainWindowTitle -match $Pattern) { return $Target.MainWindowTitle }
    if (-not $Target.Responding) { throw "The Prunex desktop window stopped responding." }
    Start-Sleep -Milliseconds 100
  } while ((Get-Date) -lt $deadline)
  throw "Timed out waiting for '$Pattern'. Last title: '$($Target.MainWindowTitle)'."
}

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
  if ($process.MainWindowHandle -eq [IntPtr]::Zero) {
    throw "Prunex did not create a visible top-level window."
  }
  if (-not $process.Responding) { throw "The Prunex desktop window is not responding." }
  $window = $process.MainWindowHandle
  $initialTitle = Wait-ForTitle $process "Prunex Chess \| White to move \| 0 plies"
  Write-Host "Initial position verified: $initialTitle"

  # e2-e4: board coordinates are client-relative and fixed by the current GUI layout.
  [PrunexSmokeInput]::Click($window, 376, 588)
  [PrunexSmokeInput]::Click($window, 376, 436)
  $thinkingTitle = Wait-ForTitle $process "Prunex is thinking" 10
  Write-Host "Engine search started: $thinkingTitle"
  $replyTitle = Wait-ForTitle $process "White to move \| 2 plies" 30
  Write-Host "Human and engine moves completed: $replyTitle"

  # Undo must restore both half-moves from the human/engine pair.
  [PrunexSmokeInput]::Click($window, 789, 473)
  $undoTitle = Wait-ForTitle $process "White to move \| 0 plies" 10
  Write-Host "Undo restored the starting position: $undoTitle"

  # Start a second search, then cancel it with New Game.
  [PrunexSmokeInput]::Click($window, 376, 588)
  [PrunexSmokeInput]::Click($window, 376, 436)
  [void](Wait-ForTitle $process "Prunex is thinking" 10)
  [PrunexSmokeInput]::Click($window, 789, 425)
  $newGameTitle = Wait-ForTitle $process "White to move \| 0 plies" 10
  Write-Host "New Game cancelled the pending search: $newGameTitle"

  # Verify board orientation control remains responsive.
  [PrunexSmokeInput]::Click($window, 789, 521)
  $process.Refresh()
  if (-not $process.Responding) { throw "Prunex stopped responding after board flip." }

  Write-Host "GUI interaction smoke passed: startup, legal move input, engine reply, paired undo, search cancellation, new game, board flip, and normal shutdown."
} finally {
  if ($process -and -not $process.HasExited) {
    [void]$process.CloseMainWindow()
    if (-not $process.WaitForExit(5000)) {
      throw "Prunex did not close after a normal window-close request."
    }
  }
}
