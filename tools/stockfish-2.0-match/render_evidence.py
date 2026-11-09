#!/usr/bin/env python3
"""Render a real PGN match into a move-by-move MP4 and 64-board poster."""
from __future__ import annotations
import argparse, subprocess, shutil
from pathlib import Path
import chess
import chess.pgn
import chess.svg
import cairosvg
from PIL import Image, ImageDraw, ImageFont

def font(size, bold=False):
    paths=[
      "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
      "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf"
    ]
    for p in paths:
        if Path(p).exists(): return ImageFont.truetype(p,size)
    return ImageFont.load_default()

def board_png(board, size):
    svg=chess.svg.board(board=board,size=size,coordinates=True)
    data=cairosvg.svg2png(bytestring=svg.encode("utf-8"),output_width=size,output_height=size)
    import io
    return Image.open(io.BytesIO(data)).convert("RGB")

def make_frame(board, game_no, ply, move_label, result, output):
    canvas=Image.new("RGB",(1080,900),"#091321")
    d=ImageDraw.Draw(canvas)
    d.text((48,24),"PRUNEX 0.8.0  vs  OFFICIAL STOCKFISH 2.0",font=font(24,True),fill="#58dec7")
    d.text((48,59),f"GAME {game_no:02d} / 64   ·   PLY {ply:03d}",font=font(18,True),fill="#dce7f7")
    canvas.paste(board_png(board,760),(160,105))
    d.text((48,875),f"{move_label}   ·   {result}",font=font(17),fill="#aebed3")
    canvas.save(output,quality=88)

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--pgn",required=True)
    ap.add_argument("--out",required=True)
    ap.add_argument("--fps",type=int,default=3)
    args=ap.parse_args()
    out=Path(args.out); out.mkdir(parents=True,exist_ok=True)
    frames=out/"frames"; frames.mkdir(exist_ok=True)
    games=[]
    with Path(args.pgn).open(encoding="utf-8") as f:
        while (g:=chess.pgn.read_game(f)) is not None: games.append(g)
    if len(games)!=64: raise SystemExit(f"Expected 64 completed games; found {len(games)}")
    frame_no=0
    finals=[]
    for game_no,game in enumerate(games,1):
        board=game.board()
        prunex_color=game.headers.get("PrunexColor","unknown")
        result=game.headers.get("Result","*")
        make_frame(board,game_no,0,"Opening position", "IN PROGRESS",frames/f"frame_{frame_no:06d}.jpg")
        frame_no+=1
        moves=list(game.mainline_moves())
        ply=0
        for move in moves:
            san=board.san(move)
            side="White" if board.turn else "Black"
            board.push(move); ply+=1
            label=f"{side}: {san}  ·  Prunex {prunex_color}"
            status=result if ply==len(moves) else "IN PROGRESS"
            make_frame(board,game_no,ply,label,status,frames/f"frame_{frame_no:06d}.jpg")
            frame_no+=1
        finals.append((game_no,board.copy(),result,prunex_color,game.headers.get("Opening","")))
    video=out/"64-game-replay.mp4"
    subprocess.run([
      "ffmpeg","-y","-hide_banner","-loglevel","error",
      "-framerate",str(args.fps),"-i",str(frames/"frame_%06d.jpg"),
      "-c:v","libx264","-preset","veryfast","-crf","25",
      "-pix_fmt","yuv420p","-movflags","+faststart",str(video)
    ],check=True)

    # Authentic 8×8 contact sheet: each miniature board is the final position
    # reached in its corresponding recorded PGN game.
    poster=Image.new("RGB",(1600,1760),"#091321")
    d=ImageDraw.Draw(poster)
    d.text((55,35),"PRUNEX 0.8.0  vs  STOCKFISH 2.0",font=font(36,True),fill="#58dec7")
    d.text((55,88),"64 recorded games · final board position per PGN · results shown per card",
           font=font(19),fill="#b0bfd4")
    cell_w,cell_h=185,195
    start_x,start_y=55,145
    for game_no,board,result,color,opening in finals:
        idx=game_no-1; col=idx%8; row=idx//8
        x=start_x+col*cell_w; y=start_y+row*cell_h
        d.rounded_rectangle((x,y,x+170,y+185),radius=10,fill="#14263d",outline="#365473",width=1)
        poster.paste(board_png(board,148),(x+11,y+8))
        d.text((x+10,y+160),f"G{game_no:02d}  {result}",font=font(14,True),fill="#eef4ff")
        d.text((x+10,y+177),f"Prunex {color}",font=font(11),fill="#aebed3")
    poster_path=out/"64-game-final-positions.png"
    poster.save(poster_path,optimize=True)
    shutil.rmtree(frames)
    print(f"Rendered {frame_no} actual PGN positions")
    print(f"Video: {video}")
    print(f"Poster: {poster_path}")

if __name__=="__main__": main()
