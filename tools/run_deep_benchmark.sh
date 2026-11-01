#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK_DIR="${PRUNEX_BENCHMARK_WORK_DIR:-$HOME/prunex-benchmark-work}"
OUT_DIR="$REPO_ROOT/benchmark-results/deep-1m-256mb"
mkdir -p "$WORK_DIR" "$OUT_DIR"

if ! command -v flock >/dev/null; then
  echo "The flock utility is required; install util-linux in Ubuntu on WSL." >&2
  exit 1
fi
LOCK_KEY="$(printf '%s' "$OUT_DIR" | sha256sum | cut -d' ' -f1)"
exec 9>"$WORK_DIR/$LOCK_KEY.lock"
if ! flock -n 9; then
  echo "A benchmark process is already running in $OUT_DIR"
  exit 0
fi

if ! command -v git >/dev/null || ! command -v make >/dev/null || ! command -v g++ >/dev/null || ! command -v python3 >/dev/null; then
  echo "Missing build tools. In Ubuntu on WSL, run:" >&2
  echo "sudo apt update && sudo apt install -y git build-essential python3 python3-venv python3-pip" >&2
  exit 1
fi

if command -v lsb_release >/dev/null; then
  release="$(lsb_release -rs)"
  if [ "$release" != "22.04" ]; then
    echo "This build was last validated on Ubuntu 22.04; you are using Ubuntu $release." >&2
    echo "Continuing, but an older Stockfish 2.0 compiler issue may need attention." >&2
  fi
fi

if [ ! -x "$WORK_DIR/venv/bin/python" ]; then
  rm -rf "$WORK_DIR/venv"
  python3 -m venv "$WORK_DIR/venv"
fi
PYTHON="$WORK_DIR/venv/bin/python"
if ! "$PYTHON" -c "import chess, chess.engine, chess.pgn" >/dev/null 2>&1; then
  "$PYTHON" -m pip install "python-chess==1.999"
fi

if [ ! -d "$WORK_DIR/prunex-core/.git" ] || [ "$(git -C "$WORK_DIR/prunex-core" describe --tags --exact-match HEAD 2>/dev/null || true)" != "sf_19" ]; then
  rm -rf "$WORK_DIR/prunex-core"
  git clone --depth 1 --branch sf_19 https://github.com/official-stockfish/Stockfish.git "$WORK_DIR/prunex-core"
fi
if [ ! -d "$WORK_DIR/stockfish-2.0/.git" ] || [ "$(git -C "$WORK_DIR/stockfish-2.0" describe --tags --exact-match HEAD 2>/dev/null || true)" != "sf_2.0" ]; then
  rm -rf "$WORK_DIR/stockfish-2.0"
  git clone --depth 1 --branch sf_2.0 https://github.com/official-stockfish/Stockfish.git "$WORK_DIR/stockfish-2.0"
fi

python3 - "$WORK_DIR/prunex-core/src/misc.cpp" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
source = path.read_text(encoding="utf-8")
old = 'ss << "Stockfish " << version << std::setfill(\'0\');'
new = 'ss << "Prunex 0.8.0 (Stockfish " << version << "-derived)" << std::setfill(\'0\');'
if new in source:
    pass
elif source.count(old) == 1:
    path.write_text(source.replace(old, new, 1), encoding="utf-8")
else:
    raise SystemExit("Could not identify the Stockfish 19 UCI name line; no source changes were made.")
PY

mkdir -p "$WORK_DIR/bin"
echo "Checking the 64-game schedule and checkpoint recovery..."
"$PYTHON" "$REPO_ROOT/tools/test_prunex_deep_match.py"

if [ ! -x "$WORK_DIR/bin/prunex-0.8.0" ]; then
  echo "Building Prunex 0.8.0 from official Stockfish tag sf_19..."
  make -C "$WORK_DIR/prunex-core/src" -j2 build ARCH=x86-64 COMP=gcc
  cp "$WORK_DIR/prunex-core/src/stockfish" "$WORK_DIR/bin/prunex-0.8.0.tmp"
  mv "$WORK_DIR/bin/prunex-0.8.0.tmp" "$WORK_DIR/bin/prunex-0.8.0"
fi
if [ ! -x "$WORK_DIR/bin/stockfish-2.0" ]; then
  echo "Building the opponent from official Stockfish tag sf_2.0..."
  make -C "$WORK_DIR/stockfish-2.0/src" -j2 build ARCH=x86-64 COMP=gcc
  cp "$WORK_DIR/stockfish-2.0/src/stockfish" "$WORK_DIR/bin/stockfish-2.0.tmp"
  mv "$WORK_DIR/bin/stockfish-2.0.tmp" "$WORK_DIR/bin/stockfish-2.0"
fi

{
  echo "Prunex source: official-stockfish/Stockfish"
  echo "Prunex tag: sf_19"
  echo "Prunex commit: $(git -C "$WORK_DIR/prunex-core" rev-parse HEAD)"
  echo "Prunex change: UCI engine name only"
  echo "Opponent source: official-stockfish/Stockfish"
  echo "Opponent tag: sf_2.0"
  echo "Opponent commit: $(git -C "$WORK_DIR/stockfish-2.0" rev-parse HEAD)"
  echo "Build: local WSL Ubuntu; GCC; x86-64"
} > "$WORK_DIR/source-revisions.txt"

mkdir -p "$OUT_DIR/engines" "$OUT_DIR/licenses"
if [ ! -x "$OUT_DIR/engines/prunex-0.8.0" ]; then
  cp "$WORK_DIR/bin/prunex-0.8.0" "$OUT_DIR/engines/prunex-0.8.0"
fi
if [ ! -x "$OUT_DIR/engines/stockfish-2.0" ]; then
  cp "$WORK_DIR/bin/stockfish-2.0" "$OUT_DIR/engines/stockfish-2.0"
fi
if [ ! -f "$OUT_DIR/source-revisions.txt" ]; then
  cp "$WORK_DIR/source-revisions.txt" "$OUT_DIR/source-revisions.txt"
fi
cp "$WORK_DIR/prunex-core/Copying.txt" "$OUT_DIR/licenses/Prunex-GPLv3.txt"
cp "$WORK_DIR/stockfish-2.0/Copying.txt" "$OUT_DIR/licenses/Stockfish-2.0-GPLv3.txt"

echo
echo "The tournament runs locally. It does not use GitHub Actions or a ChatGPT session."
echo "Results folder: $OUT_DIR"
echo "If the run is interrupted, run this script again; finished games will be skipped."
echo

set -o pipefail
OMP_NUM_THREADS=1 "$PYTHON" -u "$REPO_ROOT/tools/prunex_deep_match.py" \
  --prunex "$OUT_DIR/engines/prunex-0.8.0" \
  --stockfish "$OUT_DIR/engines/stockfish-2.0" \
  --output "$OUT_DIR" \
  --provenance-file "$OUT_DIR/source-revisions.txt" \
  --nodes-per-move 1000000 \
  --hash-mb 256 \
  --threads 1 \
  2>&1 | tee -a "$OUT_DIR/tournament.log"
