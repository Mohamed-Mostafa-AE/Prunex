# Website

This is the Vite project for the Prunex website. Vercel builds it from this folder using `npm run build` and publishes the contents of `dist/`.

The site includes a browser chessboard. The browser demo uses chess.js to handle the game and Stockfish.js Lite as its opponent. That browser opponent is separate from the native C++ engine.

The pinned Stockfish.js package and its GPLv3 license are copied into the site during the build. The required license and piece artwork notices are kept in `public/`.
