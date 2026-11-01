import { copyFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const source = join(root, "node_modules", "stockfish", "bin");
const target = join(root, "public", "engine");
mkdirSync(target, { recursive: true });

for (const name of ["stockfish-19-lite-single.js", "stockfish-19-lite-single.wasm"]) {
  copyFileSync(join(source, name), join(target, name));
}
// The upstream license is committed at public/COPYING.txt.
console.log("Copied Stockfish.js 19 lite single-threaded browser engine.");
