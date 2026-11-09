# Website

This is the Vite project for the Prunex website. Vercel builds it from this folder using `npm run build` and publishes the contents of `dist/`.

The site includes a browser chessboard. `chess.js` provides the browser-side game rules, while the opponent and game-review worker load the native C++20 engine compiled to WebAssembly. The browser and desktop builds share the same engine source.

The browser engine assets are built from Prunex's C++ source. The Cburnett chess-piece artwork has its own licence and attribution; keep its notice with every distributed browser build.

The root MIT license applies to original Prunex contributions, including the website application and engine source, except material identified with a separate license or notice. The Python training tools are separately licensed under GPL-3.0-or-later, and Cburnett chess-piece artwork remains under GPL-2.0-or-later. Third-party dependencies, fonts, and datasets retain their respective terms. The root MIT license does not relicense those materials. See `public/pieces/`, `tools/training/LICENSE`, and the site footer for the shipped notices.
