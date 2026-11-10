#!/usr/bin/env python3
"""Run a reproducible 64-game, color-balanced Prunex vs Stockfish 2.0 match."""
from __future__ import annotations
import argparse, hashlib, json, platform, time, re
from pathlib import Path
import chess
import chess.engine
import chess.pgn

# The disclosed Stockfish 2.0 node-limit patch polls both search and qsearch
# at intervals of at most 1,000 nodes.
STOCKFISH_2_NODE_POLL_INTERVAL = 1_000

OPENINGS = [
 ("Ruy Lopez", "e4 e5 Nf3 Nc6 Bb5 a6"),
 ("Sicilian Najdorf", "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6"),
 ("Queen's Gambit", "d4 d5 c4 e6 Nc3 Nf6"),
 ("King's Indian", "d4 Nf6 c4 g6 Nc3 Bg7"),
 ("English Opening", "c4 e5 Nc3 Nf6"),
 ("Reti", "Nf3 d5 g3 c5 Bg2 Nc6"),
 ("Nimzo-Indian", "d4 Nf6 c4 e6 Nc3 Bb4"),
 ("Caro-Kann", "e4 c6 d4 d5 Nc3 dxe4"),
 ("Slav Defence", "d4 d5 c4 c6 Nf3 Nf6"),
 ("Italian Game", "e4 e5 Nf3 Nc6 Bc4 Bc5"),
 ("Scotch Game", "e4 e5 Nf3 Nc6 d4 exd4"),
 ("Grunfeld Defence", "d4 Nf6 c4 g6 Nc3 d5"),
 ("Benoni Defence", "d4 Nf6 c4 c5 d5 e6"),
 ("Pirc Defence", "e4 d6 d4 Nf6 Nc3 g6"),
 ("French Defence", "e4 e6 d4 d5 Nc3 Bb4"),
 ("Petrov Defence", "e4 e5 Nf3 Nf6"),
]

def sha256(path: Path) -> str:
    h=hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda:f.read(1024*1024),b""): h.update(chunk)
    return h.hexdigest()

def opening_board(san_line: str) -> chess.Board:
    board=chess.Board()
    for san in san_line.split(): board.push_san(san)
    return board

def score_text(info: dict) -> str | None:
    score=info.get("score")
    return str(score) if score is not None else None


def node_budget_allowance(engine_name: str, requested_nodes: int) -> int:
    if engine_name == "Prunex":
        return 0
    if engine_name == "Stockfish 2.0":
        return min(requested_nodes, STOCKFISH_2_NODE_POLL_INTERVAL)
    raise ValueError(f"Unknown engine for node-budget validation: {engine_name}")


def validate_node_budget(engine_name: str, actual_nodes: int | None,
                         requested_nodes: int, game_number: int, ply: int) -> int:
    if not isinstance(actual_nodes, int) or actual_nodes < 0:
        raise RuntimeError(
            f"Missing or invalid node-count telemetry for {engine_name} "
            f"(game {game_number}, ply {ply})"
        )
    allowance = node_budget_allowance(engine_name, requested_nodes)
    maximum = requested_nodes + allowance
    if actual_nodes > maximum:
        raise RuntimeError(
            f"{engine_name} exceeded its node budget in game {game_number}, ply {ply}: "
            f"{actual_nodes} nodes; requested {requested_nodes}, "
            f"documented polling allowance {allowance}, maximum {maximum}"
        )
    return allowance


def play_one(prunex, stockfish, opening: chess.Board, prunex_color: chess.Color,
             nodes: int, game_number: int, repetition: int, opening_name: str):
    board=opening.copy()
    game=chess.pgn.Game()
    game.setup(board)
    game.headers["Event"]="Prunex vs Stockfish 2.0 (node-limit polling patch) — 64-game match"
    game.headers["Site"]="Automated reproducibility run"
    game.headers["Round"]=str(game_number)
    game.headers["White"]="Prunex 0.8.0" if prunex_color else "Stockfish 2.0 (node-limit patch)"
    game.headers["Black"]="Stockfish 2.0 (node-limit patch)" if prunex_color else "Prunex 0.8.0"
    game.headers["Opening"]=opening_name
    game.headers["Repetition"]=str(repetition)
    game.headers["TimeControl"]=f"{nodes} nodes per move"
    game.headers["PrunexColor"]="White" if prunex_color else "Black"
    node=game
    per_move=[]
    plies=0
    game_token=object()
    while plies < 300:
        outcome=board.outcome(claim_draw=True)
        if outcome is not None: break
        is_prunex=(board.turn==prunex_color)
        engine=prunex if is_prunex else stockfish
        before=board.fen()
        san=board.san
        result=engine.play(board,chess.engine.Limit(nodes=nodes),
                           game=game_token,info=chess.engine.INFO_ALL)
        if result.move not in board.legal_moves:
            raise RuntimeError(f"Illegal move from {'Prunex' if is_prunex else 'Stockfish 2.0'}: {result.move}")
        move_san=san(result.move)
        info=result.info or {}
        node_report=re.search(r"node-limit (\d+)/(\d+)",str(info.get("string","")))
        actual_nodes=int(node_report.group(1)) if node_report else info.get("nodes")
        engine_name="Prunex" if is_prunex else "Stockfish 2.0"
        node_allowance=validate_node_budget(
            engine_name,actual_nodes,nodes,game_number,plies+1
        )
        per_move.append({
          "ply":plies+1,"side":engine_name,
          "fen_before":before,"uci":result.move.uci(),"san":move_san,
          "nodes":actual_nodes,"requested_node_limit":nodes,
          "permitted_node_overshoot":node_allowance,
          "nodes_over_requested":max(0,actual_nodes-nodes),
          "node_limit_report":info.get("string"),
          "depth":info.get("depth"),"nps":info.get("nps"),
          "score":score_text(info),"pv":[m.uci() for m in info.get("pv",[])],
        })
        board.push(result.move)
        node=node.add_variation(result.move)
        plies+=1
    outcome=board.outcome(claim_draw=True)
    if outcome is None:
        result_text="1/2-1/2"
        termination="Ply limit adjudication (draw)"
    else:
        result_text=board.result(claim_draw=True)
        termination=outcome.termination.name
    game.headers["Result"]=result_text
    game.headers["Termination"]=termination
    game.headers["PlyCount"]=str(plies)
    return game, {
      "game":game_number,"opening":opening_name,"repetition":repetition,
      "prunex_color":"white" if prunex_color else "black",
      "result":result_text,"termination":termination,"plies":plies,
      "moves_uci":[m.uci() for m in board.move_stack],
      "per_move_search":per_move,
    }

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--prunex",required=True)
    ap.add_argument("--stockfish",required=True)
    ap.add_argument("--nodes",type=int,default=1_000_000)
    ap.add_argument("--stockfish-hash-mb",type=int,default=256)
    ap.add_argument("--out",default="verified-stockfish-2.0-64")
    args=ap.parse_args()
    if args.nodes<1000: ap.error("--nodes must be at least 1000")
    out=Path(args.out); out.mkdir(parents=True,exist_ok=True)
    prunex_path=Path(args.prunex).resolve()
    stockfish_path=Path(args.stockfish).resolve()
    started=time.time()
    wins=draws=losses=0
    records=[]
    pgn_path=out/"all-games.pgn"
    jsonl_path=out/"games.jsonl"

    with chess.engine.SimpleEngine.popen_uci(str(prunex_path),timeout=60) as prunex, \
         chess.engine.SimpleEngine.popen_uci(str(stockfish_path),timeout=60) as stockfish, \
         pgn_path.open("w",encoding="utf-8") as pgn_file, \
         jsonl_path.open("w",encoding="utf-8") as jsonl_file:
        prunex_id=prunex.id.get("name","")
        stockfish_id=stockfish.id.get("name","")
        if "Prunex 0.8.0" not in prunex_id:
            raise RuntimeError(f"Unexpected Prunex UCI identity: {prunex_id!r}")
        if "Stockfish 2.0" not in stockfish_id:
            raise RuntimeError(f"Unexpected Stockfish UCI identity: {stockfish_id!r}")
        required={"Hash","Threads"}
        missing=required-set(stockfish.options)
        if missing: raise RuntimeError(f"Stockfish 2.0 lacks expected UCI options: {sorted(missing)}")
        stockfish.configure({"Hash":args.stockfish_hash_mb,"Threads":1})

        game_number=0
        for opening_name,san_line in OPENINGS:
            start=opening_board(san_line)
            for repetition in (1,2):
                for prunex_color in (chess.WHITE,chess.BLACK):
                    game_number+=1
                    game,record=play_one(prunex,stockfish,start,prunex_color,
                                         args.nodes,game_number,repetition,opening_name)
                    pgn_file.write(str(game)+"\n\n"); pgn_file.flush()
                    jsonl_file.write(json.dumps(record,ensure_ascii=False)+"\n")
                    jsonl_file.flush()
                    result=record["result"]
                    if result=="1/2-1/2": draws+=1
                    else:
                        prunex_won=(result=="1-0" and prunex_color==chess.WHITE) or (result=="0-1" and prunex_color==chess.BLACK)
                        if prunex_won: wins+=1
                        else: losses+=1
                    records.append({k:record[k] for k in ("game","opening","repetition","prunex_color","result","termination","plies")})
                    print(f"game {game_number:02d}/64 | {opening_name} | Prunex {record['prunex_color']} | {result} | {record['termination']}",flush=True)

        metadata={
          "event":"Prunex 0.8.0 vs official Stockfish 2.0",
          "games_completed":game_number,"wins":wins,"draws":draws,"losses":losses,
          "points":wins+draws/2,"score_percent":round((wins+draws/2)/game_number*100,2),
          "nodes_per_move_requested":args.nodes,
          "node_limit_policy":{
            "prunex":"strict; actual nodes must not exceed the requested limit",
            "stockfish_2_0":(
              "A disclosed patch polls both main search and quiescence search at intervals "
              f"of at most {STOCKFISH_2_NODE_POLL_INTERVAL} nodes; actual per-move "
              "counts are retained and validated against this bounded allowance"
            ),
            "stockfish_2_0_max_poll_overshoot_nodes":STOCKFISH_2_NODE_POLL_INTERVAL,
          },
          "stockfish_hash_mb":args.stockfish_hash_mb,
          "stockfish_threads":1,"prunex_threads":1,
          "prunex_tt_entries":262144,"prunex_tt_config":"fixed native table: TT_BITS=18; no UCI Hash option",
          "opening_count":len(OPENINGS),"repetitions_per_opening":2,
          "color_balance":{"prunex_white":32,"prunex_black":32},
          "prunex_uci_id":prunex_id,"stockfish_uci_id":stockfish_id,
          "prunex_executable":str(prunex_path),"prunex_sha256":sha256(prunex_path),
          "stockfish_executable":str(stockfish_path),"stockfish_sha256":sha256(stockfish_path),
          "stockfish_source":"official-stockfish/Stockfish tag sf_2.0 with the disclosed node-limit polling patch",
          "stockfish_source_commit":"aa2de53a83ca5423c8c8007abf71f9afdf589d93",
          "stockfish_source_patch":"tools/stockfish-2.0-match/patches/stockfish-2-node-budget.patch",
          "stockfish_source_patch_sha256":__import__("os").environ.get("STOCKFISH_SOURCE_PATCH_SHA256","unknown"),
          "stockfish_source_patch_scope":"node-limit polling in main search and quiescence search; evaluation, move generation, and search scoring are unchanged",
          "git_commit":__import__("os").environ.get("GITHUB_SHA","unknown"),
          "python":platform.python_version(),"python_chess":chess.__version__,
          "elapsed_seconds":round(time.time()-started,1),
          "game_records":records,
          "interpretation":"A controlled 64-game match record, not an Elo estimate or proof of general superiority. Prunex uses its fixed 262,144-entry TT; Stockfish Hash is set to the recorded value."
        }
        (out/"summary.json").write_text(json.dumps(metadata,indent=2)+"\n",encoding="utf-8")
        print(json.dumps({k:v for k,v in metadata.items() if k!="game_records"},indent=2))

if __name__=="__main__": main()
