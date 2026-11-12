# Prunex offline training-data tools

This directory contains an offline corpus importer. It is **not** bundled into
the native engine or the browser client. The importer uses python-chess
(GPL-3.0-or-later) and python-zstandard (BSD-3-Clause). To keep licensing
boundaries clear, tools in this directory are distributed under GPL-3.0-or-later;
the original native C++ engine remains under the root MIT License.

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
remain distinct from the root MIT License covering original Prunex contributions.

## Annotate positions with the native Prunex evaluator

After compiling the native engine, annotate one corpus split with its own
static evaluation (not the browser-side expected-points calibration):

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

## Native static-evaluation calibration diagnostics

After annotating the train, validation, and test files separately with the
same compiled native executable, run:

    python tools/training/calibrate_native_eval.py \
      --train /data/prunex-corpus/positions-train-prunex-0.8.0.jsonl \
      --validation /data/prunex-corpus/positions-validation-prunex-0.8.0.jsonl \
      --test /data/prunex-corpus/positions-test-prunex-0.8.0.jsonl \
      --output /data/prunex-corpus/native-evaluation-calibration.json

The diagnostic fits a logistic expected-points curve using only the training
split. It reports raw-score, calibrated-score, and training-mean baseline
log-loss and Brier scores on validation and test data. Each game receives
equal total weight, so unusually long games do not dominate the fit.

The tool rejects overlapping game IDs, mismatched native executable hashes or
versions, invalid score perspectives, malformed labels, and undersized
splits. The held-out test split is evaluated only after fitting. The report is
diagnostic: it does not modify the C++ evaluator, produce engine weights, or
change the separate browser review calibration. A better calibration score
is not evidence of stronger play.


## Prepare an NNUE teacher-evaluation corpus

The Lichess Open Database publishes a CC0 position-evaluation archive containing
FENs and Stockfish teacher evaluations. Download the `lichess_db_eval.jsonl.zst`
archive from [database.lichess.org](https://database.lichess.org/). Keep the
archive outside Git, retain its SHA-256, and record its download date.

Run the streaming importer:

```bash
python tools/training/prepare_lichess_eval.py \
  --input /data/lichess_db_eval.jsonl.zst \
  --output-dir /data/prunex-corpus/lichess-eval-2026-11 \
  --dataset-name lichess-eval-2026-11 \
  --min-depth 16 \
  --min-knodes 1000
```

The importer chooses the first PV from the deepest qualifying evaluation,
skips mate-only labels, deduplicates identical positions before splitting,
and writes train/validation/test JSONL plus a manifest. The public
[Lichess fishnet-evals dataset card](https://huggingface.co/datasets/Lichess/fishnet-evals)
defines the source centipawn score as White-relative; the importer converts
it to side-to-move perspective using the FEN active colour. The manifest
records the source archive hash, CC0 license, score-schema reference, teacher
provenance, depth/node filters, output hashes, and filtering counters.

The output labels are Stockfish teacher scores; using them trains a
Prunex-owned model to reproduce a teacher signal. It does not, by itself,
demonstrate better chess.

Do not put the bulk corpus or trained weights in this repository. Keep the
original archive, manifest, training configuration, checkpoint, exported
model, and checksums together in versioned storage.


## Train an original Prunex HalfKP network

The native engine can load a Prunex-owned evaluation file through UCI's
`EvalFile` option. The quantized format is defined by `src/nnue.hpp` and starts with the
`PRUNEXQ1` header; it is not a Stockfish `.nnue` file and cannot load
Stockfish network weights.

Install the optional PyTorch dependency in addition to the base training tools:

```bash
python -m pip install -r tools/training/requirements-nnue.txt
```

Train from the licensed, White-relative Lichess corpus prepared above:

```bash
python tools/training/train_halfkp.py \
  --input-dir /data/prunex-corpus/lichess-eval-2026-11 \
  --output /data/prunex-models/prunex-halfkp-v1.nnue \
  --device cuda \
  --epochs 3 \
  --batch-size 512
```

The initial network uses shared HalfKP piece/king features, two perspectives,
and a compact dense head. Training applies straight-through fake quantization
to feature weights, dense weights, biases and clipped activations so the model
sees the same integer scales used by native inference. It is an original Prunex model implementation; the
feature-set concept follows the publicly documented HalfKP design. The model
is trained on Stockfish teacher centipawn evaluations, normalized to the
side-to-move perspective. The trainer writes the native network, a PyTorch
checkpoint, a training report and SHA-256 hashes. Keep all of those with the
corpus manifest and training settings.

The native engine keeps its handcrafted evaluator unless a valid Prunex
network is explicitly selected:

```text
setoption name EvalFile value /path/to/prunex-halfkp-v1.nnue
```

To return to the handcrafted evaluator:

```text
setoption name EvalFile value none
```

The native evaluator uses integer inference with int8 weights and quantized
activations, but it currently rebuilds both feature accumulators for every
evaluation. Incremental accumulator updates and SIMD kernels remain future
performance work; this is still a prototype rather than a production NNUE
implementation. Do not make a strength claim from training loss alone; benchmark
evaluation speed and run paired-colour matches before enabling a network in
a release.
