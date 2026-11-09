#!/usr/bin/env python3
"""Verify a native Stockfish executable against the Stockfish 2.0 bench signature."""
from __future__ import annotations
import argparse, hashlib, json, re, subprocess
from pathlib import Path

EXPECTED_NODES = 7_224_363

def run(command: list[str], input_text: str | None = None, timeout: int = 300) -> str:
    p = subprocess.run(command, input=input_text, text=True,
                       stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                       timeout=timeout, check=False)
    if p.returncode:
        raise RuntimeError(f"Command failed ({p.returncode}): {' '.join(command)}\n{p.stdout[-3000:]}")
    return p.stdout

def main() -> int:
    ap=argparse.ArgumentParser()
    ap.add_argument("--engine",required=True)
    ap.add_argument("--output",default=None)
    args=ap.parse_args()
    engine=Path(args.engine).resolve()
    if not engine.is_file(): ap.error(f"Engine does not exist: {engine}")
    uci=run([str(engine)],"uci\nquit\n",30)
    ids=re.findall(r"(?im)^\s*id name\s+(.+?)\s*$",uci)
    sf_id=next((x for x in ids if re.search(r"\bStockfish\s+2\.0\b",x,re.I)),None)
    bench=run([str(engine),"bench"],timeout=300)
    found=re.findall(r"(?im)^\s*(?:total\s+)?nodes\s+searched\s*[:=]\s*([0-9][0-9,]*)\s*$",bench)
    count=int(found[-1].replace(",","")) if found else None
    h=hashlib.sha256(engine.read_bytes()).hexdigest()
    result={
      "engine_path":str(engine),"sha256":h,"uci_id_names":ids,
      "matched_stockfish_2_0_id":sf_id,"bench_nodes":count,
      "expected_bench_nodes":EXPECTED_NODES,
      "identity_check_passed":sf_id is not None,
      "bench_signature_passed":count==EXPECTED_NODES,
      "verified_as_stockfish_2_0":sf_id is not None and count==EXPECTED_NODES,
      "official_source_tag":"official-stockfish/Stockfish@sf_2.0",
      "official_source_commit":"aa2de53a83ca5423c8c8007abf71f9afdf589d93",
      "verification_limit":"Practical UCI/build fingerprint, not a cryptographic publisher signature."
    }
    payload=json.dumps(result,indent=2)+"\n"
    print(payload,end="")
    if args.output: Path(args.output).write_text(payload,encoding="utf-8")
    return 0 if result["verified_as_stockfish_2_0"] else 2

if __name__=="__main__":
    raise SystemExit(main())
