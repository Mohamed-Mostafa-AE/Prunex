# Prunex Play — Vercel

The website is a small Vite application. Vercel project root: `website/`. Build command: `npm run build`. Output directory: `dist`.

The interactive chessboard uses chess.js for legal move validation and a local Stockfish 4-derived Prunex engine compiled to WebAssembly. The engine runs in a background worker on the visitor's device. No positions or moves are sent to a game server.

The site footer contains the project description and contact links:
- GitHub: https://github.com/Mohamed-Mostafa-GT
- Email: mohamedhussam09@gmail.com

The WebAssembly engine is built by `.github/workflows/website-engine-wasm.yml`. The build workflow commits its generated files under `public/engine/`; this lets Vercel deploy the static site without needing Emscripten in Vercel's build image.

Cross-origin isolation headers are configured in `vercel.json` because the legacy engine's pthread runtime uses shared WebAssembly memory.
