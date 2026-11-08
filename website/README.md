# Website

This is the Vite project for Prunex Play. Vercel builds it from this folder using `npm run build` and publishes the contents of `dist/`.

The browser board uses `chess.js` for game rules and the Prunex 0.8.0 C++20 engine compiled to WebAssembly for opponent play, position evaluation, and game review. The browser worker loads the generated `prunex-wasm.js` module and its `prunex-wasm.wasm` binary from `public/engine/`. Both are built from the repository's native engine source and checked by the native/WebAssembly parity workflow.

The WebAssembly build is versioned through its C API. Browser searches use the native engine's time-bounded iterative-deepening search; the UI's opponent settings and review budgets are expressed as time limits, up to 30 seconds per position. The worker is dedicated to the browser session so a search can be interrupted by terminating and recreating the worker.

The root MIT license applies to original Prunex contributions. The Cburnett chess-piece artwork has its own GPL-2.0-or-later license and attribution; keep its notice and license in every distributed browser build. Other third-party dependencies, fonts, and assets retain their respective terms. See `public/pieces/`, `tools/training/LICENSE`, and the root `LICENSE`.
