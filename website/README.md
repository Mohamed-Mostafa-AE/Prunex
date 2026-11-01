# Prunex website

Vite application. Vercel project root: `website/`. Build: `npm run build`; output: `dist/`.

The site uses the provided Prunex logo and a midnight, cyan, and blue palette.

The independent main project is the C++20 chess engine built from scratch. The website's browser workspace is a separate interactive demonstration using chess.js and Stockfish.js Lite, not the native Prunex search core.

Stockfish.js and its GPLv3 license are installed/copied from pinned dependencies during the build; generated JS/WASM and archives are intentionally not stored in Git.

Vercel project settings: root `website`, Vite, `npm run build`, output `dist/`.
