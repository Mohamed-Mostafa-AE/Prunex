# Prunex Play — Vercel

Vite application. Vercel project root: `website/`. Build: `npm run build`; output: `dist`.

The chessboard uses chess.js for legal move validation. The browser opponent runs Stockfish.js 19 lite single-threaded WebAssembly in a dedicated worker. It runs locally in the visitor's browser; moves are not sent to a game server.

The footer contains the project description and contact links:
- GitHub: https://github.com/Mohamed-Mostafa-GT
- Email: mohamedhussam09@gmail.com

The Stockfish engine is a separate GPLv3-licensed upstream component. Its license and corresponding upstream source archive are published alongside the browser engine.

The page does not require cross-origin isolation because it uses the single-threaded WASM engine.
