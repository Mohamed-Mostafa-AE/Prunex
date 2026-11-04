# Prunex offline training-data tools

This directory contains an offline corpus importer. It is **not** bundled into
the native engine or the browser client. The importer uses python-chess
(GPL-3.0-or-later) and python-zstandard (BSD-3-Clause). To keep licensing
boundaries clear, tools in this directory are distributed under GPL-3.0-or-later;
the native C++ engine remains under the root Apache-2.0 license.

## Install

Use Python 3.10 or later in a virtual environment:

```bash
python -m venv .venv
# Linux/macOS
source .venv/bin/activate
# Windows PowerShell
# .venv\Scripts\Activate.ps1
python -m pip install -r tools/training/requirements.txt
```

## Import a licensed Lichess standard-game export

Download an archive from [Lichess Open Database](https://database.lichess.org/).
The monthly standard rated database exports are CC0. Keep the downloaded
archive and its checksum outside Git. Example:

```bash
python tools/training/ingest_pgn.py \
  --input /data/lichess_db_standard_rated_2026-10.pgn.zst \
  --output-dir /data/prunex-corpus/lichess-2026-10 \
  --dataset-name lichess-standard-rated-2026-10 \
  --source-name "Lichess Open Database — Standard Rated" \
  --source-url https://database.lichess.org/ \
  --license-id CC0-1.0 \
  --license-url https://creativecommons.org/publicdomain/zero/1.0/ \
  --attribution "Lichess Open Database; monthly standard rated game export" \
  --downloaded-at 2026-11-04
```

The importer streams the PGN/Zstandard file and writes:
- `positions-train.jsonl`
- `positions-validation.jsonl`
- `positions-test.jsonl`
- `corpus-manifest.json`

The deterministic split is by complete game by default. Use
`--split-group event` for a tournament/broadcast archive when event headers
are reliable and you want all games from the same event in one split.

Every output row includes its source URL, license ID, source game hash,
position FEN, played UCI/SAN move, side-to-move result, ratings and split.
The manifest includes source archive SHA-256, file hashes, importer settings,
filtering counters and output counts. The importer rejects malformed,
illegal, non-standard-variant and unfinished-result PGNs, and removes exact
duplicate game mainlines.

## Important label limitation

A PGN's played move and final result are not an engine's best move or a
trusted evaluation of each position. These exports are suitable for corpus
preparation, outcome modelling, move-prediction experiments and subsequent
native-engine annotation. Do not treat game results as ground-truth centipawn
scores. Candidate changes to native evaluation must still pass tactical
tests and controlled engine matches before deployment.

Do not upload this bulk corpus to the production Supabase game tables. Those
tables are for players' private games/reviews and consent-based small shared
position samples. Keep the corpus in versioned local/object storage with its
manifest and source license obligations.

## Licensing

The importer is GPL-3.0-or-later because it uses python-chess, which is
GPL-3.0-or-later. The zstandard Python package is BSD-3-Clause. Their licenses
remain distinct from the Apache-2.0 license covering the native C++ engine.

## Annotate positions with the native Prunex evaluator

After compiling the native engine, annotate one corpus split with its own
static evaluation (not the separate browser engine):

```bash
python tools/training/annotate_native.py \
  --engine ./build/prunex \
  --input /data/prunex-corpus/lichess-2026-10/positions-train.jsonl \
  --output /data/prunex-corpus/lichess-2026-10/positions-train-prunex-0.8.0.jsonl \
  --engine-version "Prunex 0.8.0"
```

The native engine's custom UCI `eval` command reports a static score in
centipawns from the side-to-move perspective. The annotator records the
engine binary SHA-256 with every row. It does not search for a best move and
does not train or modify the engine. Use these measurements to inspect the
current evaluator and prepare controlled tuning experiments; an annotation
pass is not a strength improvement.
