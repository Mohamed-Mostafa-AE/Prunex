# Website

This is the Vite project for the Prunex website. Vercel builds it from this folder using `npm run build` and publishes the contents of `dist/`.

The site includes a browser chessboard. The browser demo uses chess.js to handle the game and Stockfish.js 19 Full (multi-threaded) as its opponent and analysis engine. That browser experience is separate from the native C++ engine.

The pinned Stockfish.js package and its GPLv3 license are copied into the site during the build. The full browser build is approximately 94 MB and requires cross-origin isolation headers for shared-memory multithreading. The required license, corresponding-source links, and piece artwork notices are kept in `public/` and the site footer.


The root Apache-2.0 license covers the original native C++ engine and native tests only. Its patent grant and other permissions do not extend to third-party browser components or artwork. It does not relicense the browser engine bundle or the browser piece artwork. The browser build's GPLv3 engine notice, corresponding-source links, piece attribution, and separate piece license are retained as shipped.