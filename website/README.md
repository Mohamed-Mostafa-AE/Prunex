# Prunex Play — Vercel

## What the site contains

A minimal chess-playing page: the board, game status, move list, new game, undo, flip, and engine-strength selector. The footer alone carries the project description and contact links.

- GitHub: https://github.com/Mohamed-Mostafa-GT
- Email: mailto:mohamedhussam09@gmail.com

The browser engine is the Stockfish 4-derived Prunex 0.6.0 build, distributed under GPLv3. The WASM engine runs in a background Web Worker on the visitor's device. Chess legality and notation are handled locally with chess.js; moves and positions are not sent to a server.

## Deploy on Vercel

1. In Vercel, choose **Add New → Project** and import the private GitHub repository `Mohamed-Mostafa-GT/Prunex`.
2. Set **Root Directory** to `website`.
3. Select **Vite** as the framework (auto-detection is also supported).
4. Set Build Command to `npm run build` and Output Directory to `dist`.
5. Deploy. Subsequent commits under `website/` can deploy automatically through the Git integration.

No environment variables are required.

## WebAssembly / cross-origin isolation

The generated Emscripten assets live in `public/engine/`. They are built by `.github/workflows/website-engine-wasm.yml` from the official Stockfish 4 source tag with the Prunex C++ bridge. The generated JS and WASM are committed to the repository so Vercel does not need Emscripten in its build image.

`vercel.json` sets the COOP and COEP response headers required by the pthread-enabled WebAssembly runtime. The site uses same-origin assets and does not load remote fonts or remote chess scripts.

## Local development

```bash
cd website
npm install
npm run dev
```

The production build is checked by `.github/workflows/website-ci.yml`.
