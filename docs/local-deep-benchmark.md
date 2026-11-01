# Local deep-search benchmark

This is the 64-game Prunex 0.8.0 vs official Stockfish 2.0 match at one million nodes per move and 256 MB hash per engine. It is a local tournament: once the engines are built, the games run on your computer. It does not depend on ChatGPT, a browser tab, GitHub Actions, or a remote session.

## What is being tested

- Prunex 0.8.0: official Stockfish 19 source tag `sf_19`, with the UCI name changed to identify the derivative.
- Opponent: official Stockfish source tag `sf_2.0`.
- 64 games: 16 openings, two repetitions, each engine playing both colors in every opening.
- Both engines: 1,000,000 nodes per move, 256 MB hash, one thread.
- Opening books disabled where the engine exposes the option. Contempt is set to zero where supported.
- Draws are adjudicated using python-chess claimable and automatic draw rules. There is no artificial ply cap.

This remains a benchmark of a Stockfish 19-derived build, not a strength result for the independently authored Prunex 0.5.x engine.

## Windows setup

The supplied PowerShell launcher uses WSL 2 so both historical Stockfish source trees can be built in a consistent Linux environment. It starts the match as a detached background process; closing PowerShell or this chat does not stop it.

1. Install WSL 2 with Ubuntu 22.04 if it is not already installed. In an elevated PowerShell window:

   ```powershell
   wsl --install -d Ubuntu-22.04
   ```

   Restart Windows if prompted, then complete Ubuntu's first-run username setup.

2. Open Ubuntu from the Start menu and install the build tools:

   ```bash
   sudo apt update
   sudo apt install -y git build-essential python3 python3-venv python3-pip util-linux
   ```

3. Open PowerShell in the Prunex repository folder and run:

   ```powershell
   .\tools\run_deep_benchmark.ps1
   ```

The first run downloads the two official source tags, builds both engines, installs the pinned match-harness dependency in a dedicated Python virtual environment, and runs the schedule/recovery checks before starting. It may take some time. The actual match is CPU-intensive and can take a long time at one million nodes per move. The launcher returns to PowerShell while the tournament continues in WSL.

## Results and recovery

All tournament files are written to:

```text
benchmark-results/deep-1m-256mb/
```

The folder contains:

- `results.jsonl`: one durable result record per completed game.
- `progress.json`: an updated score and completion count after each game.
- `summary.json`: the current summary, final when all 64 games are complete.
- `all-games.pgn`: the combined PGN.
- One PGN file per game.
- `run-config.json`: engine hashes, UCI identities, settings, and source revisions.
- `tournament.log`: console output from each run.

Each game's PGN is written atomically, then its result is appended and flushed to disk before the next game starts. The detached process continues if PowerShell or this chat closes. If Windows restarts, WSL is shut down, or the process is interrupted, completed games remain saved. Run the same PowerShell command again to resume; completed game IDs are skipped and an interrupted game is replayed from its opening. A lock held in WSL's Linux filesystem prevents a second copy from running against the same results folder.

Do not delete or edit the results folder while a match is in progress. A different engine build or different settings will be rejected rather than mixed into the existing match. Use a separate output folder for a separate experiment.

The benchmark runs inside WSL on your computer. Closing this chat or PowerShell has no effect on the detached process. You can monitor progress with `Get-Content .\\benchmark-results\\deep-1m-256mb\\progress.json` or follow the log with `Get-Content .\\benchmark-results\\deep-1m-256mb\\tournament.log -Wait`. To stop it deliberately, send an interrupt to the runner from PowerShell: `wsl -d Ubuntu-22.04 pkill -INT -f '[p]runex_deep_match.py'`. Completed games remain saved.

## Before publishing the result

Wait for `summary.json` to report `"status": "complete"` and 64 completed games. Keep the PGNs, result records, source revisions, and executable hashes with the report. Do not describe a partial run as a completed 64-game result, and do not convert the score into an Elo claim without a separately designed rating test.
