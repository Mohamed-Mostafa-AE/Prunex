# Website

This is the Vite project for the Prunex website. Vercel builds it from this folder using `npm run build` and publishes the contents of `dist/`.

The site includes a browser chessboard. The browser experience uses `chess.js` for game rules and a separate multi-threaded browser chess-engine component with NNUE-based position evaluation. This browser path is distinct from the independently implemented native C++20 engine.

The browser-engine bundle is a third-party component distributed under GPLv3. Its license, attribution, and corresponding-source references are retained with the shipped site. The Cburnett chess-piece artwork has its own license and attribution. Keep all of these notices with every distributed browser build.

The root MIT license applies to original Prunex contributions, including the website application's own code, except material identified with a separate license or notice. The Python training tools are separately licensed under GPL-3.0-or-later. The browser engine bundle remains under GPLv3, and Cburnett chess-piece artwork remains under GPL-2.0-or-later. Third-party dependencies, fonts, and assets retain their respective terms. The root MIT license does not relicense those materials. See `public/`, `tools/training/LICENSE`, and the site footer for the shipped notices.
