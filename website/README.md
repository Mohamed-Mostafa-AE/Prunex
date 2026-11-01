# Prunex website

Vite application. Vercel project root: `website/`. Build: `npm run build`; output: `dist/`.

The main Prunex project is an independently developed C++20 chess engine built from scratch. The browser workspace is a separate interactive demonstration using `chess.js` for legal move handling and Stockfish.js 19 Lite single-threaded WebAssembly as the browser opponent. It runs in a Web Worker. It is not the independent Prunex 0.5.1 engine.

The site uses the supplied Prunex logo at `public/prunex-logo.jpg`.

The Stockfish.js engine is a separate GPLv3-licensed upstream component. Its license is retained in `public/COPYING.txt`. The browser engine is installed from the pinned npm dependency during the Vite build; generated WASM/JS and copied source archives are not committed to this repository.

Vercel settings: root directory `website`, framework `Vite`, build command `npm run build`, output directory `dist`.
