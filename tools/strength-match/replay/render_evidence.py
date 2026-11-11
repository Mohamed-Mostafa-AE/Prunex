#!/usr/bin/env python3
"""Render legal PGNs into a move-sound MP4, a position poster and an offline replay."""
from __future__ import annotations

import argparse
import math
import shutil
import subprocess
import wave
from array import array
from pathlib import Path

import cairosvg
import chess
import chess.pgn
import chess.svg
from PIL import Image, ImageDraw, ImageFont

from build_replay_viewer import load_games

RATE = 44100
CLASSIC = (430.0, 255.0, 0.072, 0.043, "triangle")


def font(size: int, bold: bool = False):
    path = (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
        if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
    )
    return ImageFont.truetype(path, size) if Path(path).is_file() else ImageFont.load_default()


def board_image(board: chess.Board, size: int) -> Image.Image:
    svg = chess.svg.board(board=board, size=size, coordinates=True)
    import io
    png = cairosvg.svg2png(
        bytestring=svg.encode(),
        output_width=size,
        output_height=size,
    )
    return Image.open(io.BytesIO(png)).convert("RGB")


def draw_frame(
    board: chess.Board,
    game_no: int,
    total_games: int,
    ply: int,
    label: str,
    result: str,
    path: Path,
    match_label: str,
) -> None:
    canvas = Image.new("RGB", (1080, 900), "#091321")
    draw = ImageDraw.Draw(canvas)
    heading = match_label if len(match_label) <= 66 else match_label[:63] + "..."
    draw.text((48, 24), f"PRUNEX · {heading}", font=font(23, True), fill="#58dec7")
    draw.text(
        (48, 59),
        f"GAME {game_no:02d} / {total_games:02d} · PLY {ply:03d}",
        font=font(18, True),
        fill="#dce7f7",
    )
    canvas.paste(board_image(board, 760), (160, 105))
    draw.text((48, 875), f"{label} · {result}", font=font(16), fill="#aebed3")
    canvas.save(path, quality=88)


def write_classic_audio(
    events: list[tuple[int, bool]],
    frames: int,
    fps: int,
    path: Path,
) -> None:
    start_hz, end_hz, duration, volume, kind = CLASSIC
    pcm = array("h", [0]) * math.ceil(frames * RATE / fps)

    for frame, captured in events:
        move_duration = duration * (1.12 if captured else 1.0)
        amplitude = volume * (1.08 if captured else 1.0)
        first = round(frame * RATE / fps)
        count = min(round(move_duration * RATE), len(pcm) - first)
        phase = 0.0

        for offset in range(max(0, count)):
            elapsed = offset / RATE
            frequency = start_hz * math.exp(
                math.log(end_hz / start_hz) * elapsed / move_duration
            )
            phase = (phase + frequency / RATE) % 1.0
            sample = (
                math.sin(2 * math.pi * phase)
                if kind == "sine" else 1.0 - 4.0 * abs(phase - 0.5)
            )
            if elapsed < 0.004:
                gain = 0.0001 * math.exp(
                    math.log(amplitude / 0.0001) * elapsed / 0.004
                )
            else:
                gain = amplitude * math.exp(
                    math.log(0.0001 / amplitude)
                    * (elapsed - 0.004) / (move_duration - 0.004)
                )
            index = first + offset
            pcm[index] = max(
                -32768,
                min(
                    32767,
                    pcm[index] + int(max(-1, min(1, sample * gain)) * 32767),
                ),
            )

    with wave.open(str(path), "wb") as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(RATE)
        output.writeframes(pcm.tobytes())


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pgn", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--fps", type=int, default=3)
    parser.add_argument("--expected-games", type=int, default=24)
    parser.add_argument("--match-label", default="Prunex Strength Ladder")
    args = parser.parse_args()

    if args.fps < 1 or args.fps > 12:
        parser.error("--fps must be between 1 and 12")

    pgn_path = Path(args.pgn)
    output = Path(args.out)
    output.mkdir(parents=True, exist_ok=True)
    games = load_games(pgn_path, args.expected_games)
    frame_dir = output / "frames"
    frame_dir.mkdir(exist_ok=True)
    events: list[tuple[int, bool]] = []
    final_positions: list[tuple[int, chess.Board, str, str]] = []
    frame_number = 0

    with pgn_path.open(encoding="utf-8") as source:
        for game_number in range(1, args.expected_games + 1):
            record = chess.pgn.read_game(source)
            if record is None:
                raise RuntimeError(f"PGN ended before game {game_number}.")
            board = record.board()
            result = record.headers["Result"]
            color = record.headers["PrunexColor"].title()

            draw_frame(
                board, game_number, args.expected_games, 0,
                "Opening position", "IN PROGRESS",
                frame_dir / f"frame_{frame_number:06d}.jpg",
                args.match_label,
            )
            frame_number += 1

            moves = list(record.mainline_moves())
            for ply, move in enumerate(moves, 1):
                san = board.san(move)
                side = "White" if board.turn == chess.WHITE else "Black"
                captured = board.is_capture(move)
                board.push(move)
                move_status = result if ply == len(moves) else "IN PROGRESS"
                draw_frame(
                    board, game_number, args.expected_games, ply,
                    f"{side}: {san} · Prunex {color}", move_status,
                    frame_dir / f"frame_{frame_number:06d}.jpg",
                    args.match_label,
                )
                events.append((frame_number, captured))
                frame_number += 1

            final_positions.append((game_number, board.copy(), result, color))

    wav_path = output / "move-sounds.wav"
    write_classic_audio(events, frame_number, args.fps, wav_path)
    video_path = output / "replay.mp4"
    subprocess.run(
        [
            "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
            "-framerate", str(args.fps),
            "-i", str(frame_dir / "frame_%06d.jpg"),
            "-i", str(wav_path),
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "25",
            "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k",
            "-shortest", "-movflags", "+faststart", str(video_path),
        ],
        check=True,
    )

    columns = min(8, args.expected_games)
    rows = math.ceil(args.expected_games / columns)
    poster = Image.new(
        "RGB", (columns * 185 + 30, rows * 195 + 155), "#091321"
    )
    draw = ImageDraw.Draw(poster)
    poster_title = f"PRUNEX · {args.match_label} · {args.expected_games} GAMES"
    if len(poster_title) > 72:
        poster_title = poster_title[:69] + "..."
    draw.text((35, 28), poster_title, font=font(25, True), fill="#58dec7")
    draw.text(
        (35, 82),
        "Final position from each completed PGN record",
        font=font(18),
        fill="#b0bfd4",
    )

    for number, board, result, color in final_positions:
        index = number - 1
        x = 15 + index % columns * 185
        y = 130 + index // columns * 195
        draw.rounded_rectangle(
            (x, y, x + 175, y + 187),
            radius=10,
            fill="#14263d",
            outline="#365473",
        )
        poster.paste(board_image(board, 150), (x + 12, y + 7))
        draw.text(
            (x + 10, y + 160),
            f"G{number:02d}  {result}",
            font=font(14, True),
            fill="#eef4ff",
        )
        draw.text(
            (x + 10, y + 178),
            f"Prunex {color}",
            font=font(11),
            fill="#aebed3",
        )

    poster_path = output / "final-positions.png"
    poster.save(poster_path, optimize=True)
    replay_path = output / "replay.html"
    subprocess.run(
        [
            "python3",
            str(Path(__file__).with_name("build_replay_viewer.py")),
            "--pgn", str(pgn_path.resolve()),
            "--out", str(replay_path),
            "--expected-games", str(args.expected_games),
            "--match-label", args.match_label,
        ],
        check=True,
    )

    probe = subprocess.run(
        [
            "ffprobe", "-v", "error", "-select_streams", "a:0",
            "-show_entries", "stream=codec_name",
            "-of", "default=noprint_wrappers=1:nokey=1",
            str(video_path),
        ],
        capture_output=True,
        text=True,
        check=True,
    )
    if not probe.stdout.strip():
        raise RuntimeError("MP4 does not contain a move-sound audio track.")

    shutil.rmtree(frame_dir)
    wav_path.unlink(missing_ok=True)
    print(
        f"Verified {len(games)} legal PGN games; rendered "
        f"{frame_number} board positions."
    )
    print(f"MP4 audio codec: {probe.stdout.strip()}")
    print(f"Video: {video_path}")
    print(f"Offline replay: {replay_path}")
    print(f"Final-position poster: {poster_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
