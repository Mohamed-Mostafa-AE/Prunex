# Website

This is the Vite project for the Prunex website. Vercel builds it from this folder using `npm run build` and publishes the contents of `dist/`.

The site includes a browser chessboard. The browser experience uses `chess.js` for game rules and a separate multi-threaded browser chess-engine component with NNUE-based position evaluation. This browser path is distinct from the independently implemented native C++20 engine.

The browser-engine bundle is a third-party component distributed under GPLv3. Its license, attribution, and corresponding-source references are retained with the shipped site. The Cburnett chess-piece artwork has its own license and attribution. Keep all of these notices with every distributed browser build.

The root Apache-2.0 license covers the original native C++ engine and native tests only. Its patent grant and other permissions do not extend to third-party browser components or artwork. It does not relicense the browser engine bundle or the browser piece artwork. See `public/` and the site footer for the shipped notices.
