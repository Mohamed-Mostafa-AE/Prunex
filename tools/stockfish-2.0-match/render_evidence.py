#!/usr/bin/env python3
"""Render retained legal PGNs into a move-sound MP4, poster, and offline viewer."""
from __future__ import annotations
import argparse, math, shutil, subprocess, tempfile, wave
from array import array
from pathlib import Path
import chess, chess.pgn, chess.svg, cairosvg
from PIL import Image, ImageDraw, ImageFont
from build_replay_viewer import load_games

RATE = 44100
CLASSIC = (430.0, 255.0, .072, .043, "triangle")


def font(size, bold=False):
    path = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
    return ImageFont.truetype(path, size) if Path(path).is_file() else ImageFont.load_default()


def board_image(board, size):
    svg = chess.svg.board(board=board, size=size, coordinates=True)
    import io
    return Image.open(io.BytesIO(cairosvg.svg2png(bytestring=svg.encode(), output_width=size, output_height=size))).convert("RGB")


def draw_frame(board, game_no, ply, label, result, path):
    canvas = Image.new("RGB", (1080, 900), "#091321")
    draw = ImageDraw.Draw(canvas)
    draw.text((48, 24), "PRUNEX 0.8.0 · 64-GAME MATCH", font=font(24, True), fill="#58dec7")
    draw.text((48, 59), f"GAME {game_no:02d} / 64 · PLY {ply:03d}", font=font(18, True), fill="#dce7f7")
    canvas.paste(board_image(board, 760), (160, 105))
    draw.text((48, 875), f"{label} · {result}", font=font(17), fill="#aebed3")
    canvas.save(path, quality=88)


def write_classic_audio(events, frames, fps, path):
    start_hz, end_hz, duration, volume, kind = CLASSIC
    pcm = array("h", [0]) * math.ceil(frames * RATE / fps)
    for frame, captured in events:
        d = duration * (1.12 if captured else 1.0)
        amp = volume * (1.08 if captured else 1.0)
        first = round(frame * RATE / fps)
        count = min(round(d * RATE), len(pcm) - first)
        phase = 0.0
        for j in range(max(0, count)):
            t = j / RATE
            freq = start_hz * math.exp(math.log(end_hz / start_hz) * t / d)
            phase = (phase + freq / RATE) % 1.0
            value = math.sin(2 * math.pi * phase) if kind == "sine" else 1.0 - 4.0 * abs(phase - .5)
            gain = (.0001 * math.exp(math.log(amp / .0001) * t / .004) if t < .004
                    else amp * math.exp(math.log(.0001 / amp) * (t - .004) / (d - .004)))
            idx = first + j
            pcm[idx] = max(-32768, min(32767, pcm[idx] + int(max(-1, min(1, value * gain)) * 32767)))
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(1); wav.setsampwidth(2); wav.setframerate(RATE); wav.writeframes(pcm.tobytes())


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pgn", required=True); parser.add_argument("--out", required=True)
    parser.add_argument("--fps", type=int, default=3); parser.add_argument("--expected-games", type=int, default=64)
    args = parser.parse_args()
    pgn = Path(args.pgn); out = Path(args.out); out.mkdir(parents=True, exist_ok=True)
    games = load_games(pgn, args.expected_games)
    frame_dir = out / "frames"; frame_dir.mkdir(exist_ok=True)
    events, finals, frame_no = [], [], 0
    with pgn.open(encoding="utf-8") as source:
        for number in range(1, args.expected_games + 1):
            game = chess.pgn.read_game(source); board = game.board()
            color, result = game.headers.get("PrunexColor", "unknown"), game.headers["Result"]
            draw_frame(board, number, 0, "Opening position", "IN PROGRESS", frame_dir / f"frame_{frame_no:06d}.jpg")
            frame_no += 1
            for ply, move in enumerate(game.mainline_moves(), 1):
                san, side, capture = board.san(move), "White" if board.turn else "Black", board.is_capture(move)
                board.push(move)
                state = result if ply == len(games[number - 1]["moves"]) else "IN PROGRESS"
                draw_frame(board, number, ply, f"{side}: {san} · Prunex {color}", state,
                           frame_dir / f"frame_{frame_no:06d}.jpg")
                events.append((frame_no, capture)); frame_no += 1
            finals.append((number, board.copy(), result, color))

    wav_path = out / "move-sounds.wav"; write_classic_audio(events, frame_no, args.fps, wav_path)
    video = out / "64-game-replay.mp4"
    subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
                    "-framerate", str(args.fps), "-i", str(frame_dir / "frame_%06d.jpg"),
                    "-i", str(wav_path), "-c:v", "libx264", "-preset", "veryfast", "-crf", "25",
                    "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-shortest",
                    "-movflags", "+faststart", str(video)], check=True)

    cols, rows = min(8, args.expected_games), math.ceil(args.expected_games / min(8, args.expected_games))
    poster = Image.new("RGB", (cols * 185 + 30, rows * 195 + 155), "#091321")
    draw = ImageDraw.Draw(poster)
    draw.text((35, 28), "PRUNEX 0.8.0 · 64 RECORDED GAMES", font=font(34, True), fill="#58dec7")
    draw.text((35, 82), "Final board position from each retained PGN · results per game",
              font=font(18), fill="#b0bfd4")
    for number, board, result, color in finals:
        idx = number - 1; x, y = 15 + idx % cols * 185, 130 + idx // cols * 195
        draw.rounded_rectangle((x, y, x + 175, y + 187), radius=10, fill="#14263d", outline="#365473")
        poster.paste(board_image(board, 150), (x + 12, y + 7))
        draw.text((x + 10, y + 160), f"G{number:02d}  {result}", font=font(14, True), fill="#eef4ff")
        draw.text((x + 10, y + 178), f"Prunex {color}", font=font(11), fill="#aebed3")
    poster.save(out / "64-game-final-positions.png", optimize=True)

    viewer = out / "replay.html"
    subprocess.run(["python3", str(Path(__file__).with_name("build_replay_viewer.py")),
                    "--pgn", str(pgn.resolve()), "--out", str(viewer),
                    "--expected-games", str(args.expected_games)], check=True)
    probe = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "a:0",
                            "-show_entries", "stream=codec_name",
                            "-of", "default=noprint_wrappers=1:nokey=1", str(video)],
                           capture_output=True, text=True, check=True)
    if not probe.stdout.strip():
        raise RuntimeError("MP4 does not contain the move-sound audio track.")
    shutil.rmtree(frame_dir); wav_path.unlink(missing_ok=True)
    print(f"Verified {len(games)} legal PGN games; rendered {frame_no} actual board positions.")
    print(f"MP4 audio codec: {probe.stdout.strip()}; video: {video}")
    print(f"Offline sound-enabled viewer: {viewer}")
    print(f"Final-position poster: {out / '64-game-final-positions.png'}")


if __name__ == "__main__":
    main()
