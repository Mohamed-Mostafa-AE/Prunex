import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const failures = [];
const workers = [];
const baseUrl = process.env.PRUNEX_BASE_URL || "http://127.0.0.1:4173/";

page.on("pageerror", error => failures.push("pageerror: " + error.message));
page.on("worker", worker => {
  workers.push(worker.url());
  worker.on("console", message => failures.push("worker console: " + message.text()));
  worker.on("pageerror", error => failures.push("worker pageerror: " + error.message));
});
page.on("console", message => {
  if (message.type() === "error") failures.push("console: " + message.text());
});

try {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.waitForTimeout(10000);

  const launchLayout = await page.evaluate(() => ({
    heroSpecimen: document.querySelector(".hero-specimen"),
    boardWidth: document.querySelector(".board-frame")?.getBoundingClientRect().width,
    pieceImages: document.querySelectorAll("#board .piece-svg use").length
  }));
  if (!launchLayout.heroSpecimen) throw new Error("The project specimen should render in the hero.");
  if (await page.locator(".nav-logo").getAttribute("src") !== "/prunex-mark.png?v=4") throw new Error("Transparent Prunex mark is missing from navigation.");
  if (!(await page.locator(".engine-avatar img").count())) throw new Error("Prunex mark is missing from the engine badge.");
  if ((await page.locator(".engine-avatar img").getAttribute("alt")) !== "Prunex logo") throw new Error("Engine badge logo alt text is missing.");
  await page.waitForFunction(() => { const img = document.querySelector(".engine-avatar img"); return img && img.complete && img.naturalWidth > 0; });
  if (await page.locator("#theme option").count() !== 2) throw new Error("Only the two blue board themes should be available.");
  if (await page.locator("#about .about-mark").count()) throw new Error("The about section should explain engine architecture, not repeat the logo.");
  if (!(await page.locator("#about .architecture-card").count())) throw new Error("Engine architecture panel is missing.");
  if (!(await page.locator(".architecture-header").innerText()).includes("PRUNEX 0.8.0")) throw new Error("Architecture card should show Prunex 0.8.0.");
  if ((await page.locator(".architecture-header").innerText()).includes("0.5.1")) throw new Error("Stale Prunex 0.5.1 version remains in architecture card.");
  if (!(await page.locator("#testing .benchmark-card-top").innerText()).includes("PRUNEX 0.8.0")) throw new Error("Benchmark card should show the current Prunex version.");
  if (!(await page.locator("#testing").count())) throw new Error("The testing section is missing.");
  const testingCopy = await page.locator("#testing").innerText();
  const matchCopy = await page.locator("#match-results").innerText();
  if (!matchCopy.includes("63–1–0") || !matchCopy.includes("99.22%") || !matchCopy.includes("≈3,904 Elo")) {
    throw new Error("The Stockfish 2.0 match result and estimate are missing.");
  }
  if (!matchCopy.includes("Stockfish 19")) throw new Error("The benchmark engine provenance is missing.");
  if (!testingCopy.includes("44/44") || !testingCopy.includes("GCC 14.2 Release")) throw new Error("The regression test results are missing.");
  const favicon = await page.locator('link[rel="icon"]').getAttribute("href");
  if (favicon !== "/prunex-mark.png?v=4") throw new Error("Transparent Prunex mark is not configured as the favicon.");
  const markResponse = await page.request.get(new URL("/prunex-mark.png?v=4", baseUrl).toString());
  if (!markResponse.ok()) throw new Error("Transparent Prunex mark failed to load: " + markResponse.status());
  await page.locator("#site-theme-toggle").click();
  if (await page.locator("html").getAttribute("data-site-theme") !== "dark") throw new Error("Dark theme did not activate.");
  await page.reload({ waitUntil: "networkidle" });
  if (await page.locator("html").getAttribute("data-site-theme") !== "dark") throw new Error("Dark theme preference was not persisted.");
  await page.locator("#site-theme-toggle").click();
  if (await page.locator("html").getAttribute("data-site-theme") !== "light") throw new Error("Light theme did not restore.");

  if (!launchLayout.boardWidth || launchLayout.boardWidth > 550 || launchLayout.boardWidth < 480) {
    throw new Error("Default board size is not launch-appropriate: " + JSON.stringify(launchLayout));
  }
  if (launchLayout.pieceImages !== 32) throw new Error("Cburnett SVG pieces did not render: " + JSON.stringify(launchLayout));

  const startup = await page.evaluate(() => ({
    engine: document.querySelector("#engine-state")?.textContent,
    status: document.querySelector("#status")?.textContent
  }));
  if (startup.engine !== "Engine ready") {
    throw new Error("Engine startup failed: " + JSON.stringify(startup) +
      "\nWorkers: " + JSON.stringify(workers) + "\nErrors: " + failures.join("\n"));
  }

  await page.locator('[data-square="e2"]').click();
  await page.locator('[data-square="e4"]').click();
  await page.waitForFunction(() =>
    [...document.querySelectorAll(".move-row")].some(row => row.textContent.includes("e4")) &&
    document.querySelector("#turn-label")?.textContent.includes("YOUR TURN"),
    undefined,
    { timeout: 60000 }
  );

  await page.locator("#theme").selectOption("ice");
  if (await page.locator("#board").getAttribute("data-theme") !== "ice") {
    throw new Error("Board theme did not update.");
  }

  await page.locator("#fen-input").fill("8/8/8/8/8/8/4k3/7K w - - 0 1");
  await page.locator("#load-fen").click();
  await page.waitForFunction(() => document.querySelectorAll("#board .piece").length === 2);
  if (!(await page.locator("#status").textContent()).includes("Draw")) {
    throw new Error("Custom FEN position failed.");
  }
  await page.locator("#game-result-dialog").waitFor({ state: "visible" });
  if (await page.locator("#game-result-title").textContent() !== "A diplomatic solution.") {
    throw new Error("Draw result headline is incorrect.");
  }
  if (await page.locator("#game-result-subtitle").textContent() !== "Nobody gets to brag today.") {
    throw new Error("Draw result subheading is incorrect.");
  }
  if (await page.locator("#game-result-copy").textContent() !== "A hard-fought game, and a mutually agreed refusal to lose.") {
    throw new Error("Draw result copy is incorrect.");
  }
  await page.screenshot({ path: "artifacts/game-result-draw-desktop.png" });
  await page.locator("#game-result-review").click();
  if (await page.locator("#game-result-dialog").isVisible()) {
    throw new Error("Review moves should dismiss the result dialog.");
  }

  await page.locator("#fen-input").fill("not a fen");
  await page.locator("#load-fen").click();
  if (!(await page.locator("#fen-feedback").textContent()).length) {
    throw new Error("Invalid FEN was not rejected.");
  }

  await page.locator("#reset-position").click();
  await page.waitForFunction(() => document.querySelectorAll("#board .piece").length === 32);

  await page.locator("#side").selectOption("b");
  await page.waitForFunction(
    () => document.querySelector("#turn-label")?.textContent.includes("YOUR TURN · BLACK"),
    undefined,
    { timeout: 60000 }
  );


  await page.setViewportSize({ width: 1440, height: 768 });
  await page.locator("#board-size").evaluate(el => { el.value = "590"; el.dispatchEvent(new Event("input", { bubbles: true })); });
  const boardAt590 = await page.locator(".board-frame").evaluate(el => Math.round(el.getBoundingClientRect().width));
  if (boardAt590 < 580 || boardAt590 > 600) throw new Error("Board should reach 590px at a 768px viewport height: " + boardAt590);
  await page.locator("#board-size").evaluate(el => { el.value = "640"; el.dispatchEvent(new Event("input", { bubbles: true })); });
  const enlargedBoard = await page.locator(".board-frame").evaluate(el => Math.round(el.getBoundingClientRect().width));
  if (enlargedBoard < 630 || enlargedBoard > 650 || enlargedBoard <= boardAt590 + 35) {
    throw new Error("Board size slider must distinguish 590px from 640px: " + boardAt590 + " -> " + enlargedBoard);
  }
  if (await page.locator(".opponent-label strong").textContent() !== "Prunex 0.8.0") throw new Error("Engine badge should identify the browser build as Prunex 0.8.0.");
  const engineNote = await page.locator(".engine-note").innerText();
  if (!engineNote.includes("Stockfish 19 Lite")) throw new Error("Browser engine attribution should identify Stockfish 19 Lite.");
  const workspaceBackground = await page.locator(".workspace").evaluate(el => getComputedStyle(el).backgroundColor);
  const avatarBackground = await page.locator(".engine-avatar").evaluate(el => getComputedStyle(el).backgroundColor);
  if (workspaceBackground !== avatarBackground) throw new Error("Transparent Prunex mark background should match the dark board section.");
  await page.locator("#piece-style").selectOption("letters");
  if (await page.locator("#board").getAttribute("data-pieces") !== "letters" || !(await page.locator("#board .piece-letters").count())) {
    throw new Error("Letter piece set did not render.");
  }
  await page.locator("#piece-style").selectOption("unicode");
  if (!(await page.locator("#board .piece-unicode").count())) throw new Error("Unicode piece set did not render.");
  await page.locator("#piece-style").selectOption("cburnett");
  if (await page.locator("#board .piece-svg use").count() !== 32) throw new Error("Cburnett SVG piece set did not restore.");
  await page.locator("#coordinates").uncheck();
  if (!(await page.locator("#board").evaluate(el => el.classList.contains("no-coordinates")))) throw new Error("Coordinate toggle did not update.");
  await page.locator("#legal-moves").uncheck();
  await page.locator("#theme").selectOption("blue");
  await page.locator("#flip").click();
  if (!(await page.locator("#board").evaluate(el => el.querySelector('[data-square="h1"]') !== null))) throw new Error("Board flip failed.");
  await page.locator("#side").selectOption("w");
  await page.locator("#fen-input").fill("7k/P7/8/8/8/8/8/7K w - - 0 1");
  await page.locator("#load-fen").click();
  await page.locator('[data-square="a7"]').click();
  await page.locator('[data-square="a8"]').click();
  await page.locator('[data-promotion="n"]').click();
  if (!(await page.locator("#fen-input").inputValue()).startsWith("N6k/")) throw new Error("Knight promotion failed.");
  await page.locator("#game-result-dialog").waitFor({ state: "visible" });
  if (await page.locator("#game-result-title").textContent() !== "A diplomatic solution.") {
    throw new Error("King-and-knight promotion position should be scored as a draw.");
  }
  await page.locator("#game-result-review").click();

  const checkmateFen = "7k/6Q1/5K2/8/8/8/8/8 b - - 0 1";
  await page.locator("#fen-input").fill(checkmateFen);
  await page.locator("#load-fen").click();
  await page.locator("#game-result-dialog").waitFor({ state: "visible" });
  if (await page.locator("#game-result-title").textContent() !== "Well, well, well." ||
      await page.locator("#game-result-subtitle").textContent() !== "The engine has been humbled." ||
      await page.locator("#game-result-copy").textContent() !== "A strong move, a stronger finish. Prunex will be reviewing this game in its next performance evaluation.") {
    throw new Error("Win result copy is incorrect.");
  }
  await page.screenshot({ path: "artifacts/game-result-win-desktop.png" });
  await page.locator("#game-result-review").click();

  await page.locator("#side").selectOption("b");
  await page.waitForFunction(
    () => document.querySelector("#turn-label")?.textContent.includes("YOUR TURN · BLACK"),
    undefined,
    { timeout: 60000 }
  );
  await page.locator("#fen-input").fill(checkmateFen);
  await page.locator("#load-fen").click();
  await page.locator("#game-result-dialog").waitFor({ state: "visible" });
  if (await page.locator("#game-result-title").textContent() !== "That's unfortunate." ||
      await page.locator("#game-result-subtitle").textContent() !== "Prunex takes this one." ||
      await page.locator("#game-result-copy").textContent() !== "Looks like the engine had the better day. Bad news: Prunex is still improving, so this might not be your last defeat.") {
    throw new Error("Loss result copy is incorrect.");
  }
  await page.screenshot({ path: "artifacts/game-result-loss-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "artifacts/game-result-loss-mobile.png" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.locator("#game-result-new-game").click();
  await page.waitForFunction(
    () => document.querySelector("#turn-label")?.textContent.includes("YOUR TURN · BLACK"),
    undefined,
    { timeout: 60000 }
  );
  await page.locator("#side").selectOption("w");
  await page.locator("#reset-position").click();

  await page.setViewportSize({ width: 390, height: 844 });
  const mobile = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
    board: document.querySelector("#board")?.getBoundingClientRect().width
  }));
  if (mobile.content > mobile.viewport + 1 || !mobile.board || mobile.board > mobile.viewport) {
    throw new Error("Mobile layout overflows: " + JSON.stringify(mobile));
  }

  const deviceViewports = [
    { width: 280, height: 653, name: "foldable-compact" },
    { width: 320, height: 568, name: "phone-small" },
    { width: 360, height: 800, name: "phone-compact" },
    { width: 390, height: 844, name: "phone-tall" },
    { width: 540, height: 720, name: "split-screen-phone" },
    { width: 600, height: 800, name: "compact-tablet" },
    { width: 673, height: 841, name: "foldable-unfolded" },
    { width: 768, height: 1024, name: "tablet-portrait" },
    { width: 800, height: 800, name: "square-display" },
    { width: 844, height: 390, name: "phone-landscape" },
    { width: 1024, height: 768, name: "tablet-landscape" },
    { width: 1024, height: 1024, name: "square-tablet" },
    { width: 1080, height: 1920, name: "kiosk-portrait" },
    { width: 1280, height: 800, name: "laptop" },
    { width: 1920, height: 1080, name: "desktop" },
    { width: 2560, height: 1440, name: "wide-desktop" }
  ];
  const screenshotViewports = new Set([
    "phone-small", "split-screen-phone", "foldable-unfolded",
    "tablet-portrait", "square-tablet", "phone-landscape",
    "desktop", "wide-desktop"
  ]);

  for (const device of deviceViewports) {
    await page.setViewportSize({ width: device.width, height: device.height });
    const layout = await page.evaluate(() => {
      const root = document.documentElement;
      const app = document.querySelector("#app")?.getBoundingClientRect();
      const workspace = document.querySelector(".workspace")?.getBoundingClientRect();
      const board = document.querySelector(".board-frame")?.getBoundingClientRect();
      const sections = [
        ".topbar", ".nav-links", ".top-actions", ".hero", ".principles",
        ".workspace", ".board-frame", ".editor-panel", ".about-section",
        ".benchmark-section", ".match-section", ".footer"
      ];
      const outside = sections.flatMap(selector => {
        const element = document.querySelector(selector);
        if (!element) return [];
        const rect = element.getBoundingClientRect();
        return rect.left < -1 || rect.right > root.clientWidth + 1
          ? [{ selector, left: Math.round(rect.left), right: Math.round(rect.right) }]
          : [];
      });
      return {
        viewport: root.clientWidth,
        documentWidth: Math.max(root.scrollWidth, document.body.scrollWidth),
        app: app ? { left: Math.round(app.left), right: Math.round(app.right) } : null,
        workspaceWidth: workspace ? Math.round(workspace.width) : null,
        board: board ? { width: Math.round(board.width), height: Math.round(board.height) } : null,
        outside
      };
    });

    if (layout.documentWidth > device.width + 1 || layout.app?.left < -1 ||
        layout.app?.right > device.width + 1 || layout.outside.length) {
      throw new Error("Responsive overflow at " + device.name + " (" +
        device.width + "x" + device.height + "): " + JSON.stringify(layout));
    }
    if (!layout.board || Math.abs(layout.board.width - layout.board.height) > 1 ||
        layout.board.width > layout.workspaceWidth + 1) {
      throw new Error("Chessboard sizing failed at " + device.name + ": " + JSON.stringify(layout));
    }
    if (screenshotViewports.has(device.name)) {
      await page.screenshot({
        path: "artifacts/responsive-" + device.name + ".png",
        fullPage: ["phone-small", "tablet-portrait", "square-tablet", "desktop"].includes(device.name)
      });
    }
  }

  await page.locator("#side").selectOption("w");
  await page.locator("#fen-input").fill("7k/6Q1/5K2/8/8/8/8/8 b - - 0 1");
  await page.locator("#load-fen").click();
  await page.locator("#game-result-dialog").waitFor({ state: "visible" });
  for (const device of [
    { width: 280, height: 560, name: "modal-compact" },
    { width: 320, height: 568, name: "modal-phone" },
    { width: 844, height: 390, name: "modal-landscape" }
  ]) {
    await page.setViewportSize({ width: device.width, height: device.height });
    const dialog = await page.locator("#game-result-dialog").evaluate(element => {
      const rect = element.getBoundingClientRect();
      return {
        left: Math.round(rect.left), right: Math.round(rect.right),
        top: Math.round(rect.top), bottom: Math.round(rect.bottom),
        width: Math.round(rect.width), height: Math.round(rect.height),
        viewportWidth: document.documentElement.clientWidth,
        viewportHeight: document.documentElement.clientHeight
      };
    });
    if (dialog.left < 4 || dialog.top < 4 ||
        dialog.right > device.width - 4 || dialog.bottom > device.height - 4) {
      throw new Error("Result dialog escapes the viewport at " + device.name + ": " + JSON.stringify(dialog));
    }
    if (device.name !== "modal-landscape") {
      await page.screenshot({ path: "artifacts/responsive-" + device.name + ".png" });
    }
  }
  await page.locator("#game-result-close").click();

  const touchContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true
  });
  const touchPage = await touchContext.newPage();
  try {
    await touchPage.goto(baseUrl, { waitUntil: "domcontentloaded" });
    const touchTargets = await touchPage.evaluate(() => ({
      coarsePointer: matchMedia("(pointer: coarse)").matches,
      themeToggle: parseFloat(getComputedStyle(document.querySelector(".theme-toggle")).minHeight),
      topCta: parseFloat(getComputedStyle(document.querySelector(".top-cta")).minHeight),
      boardButton: parseFloat(getComputedStyle(document.querySelector(".board-toolbar .button")).minHeight),
      promotionButton: parseFloat(getComputedStyle(document.querySelector(".promotion-options button")).minHeight),
      navLink: parseFloat(getComputedStyle(document.querySelector(".nav-links a")).minHeight)
    }));
    if (!touchTargets.coarsePointer || touchTargets.themeToggle < 44 ||
        touchTargets.topCta < 44 || touchTargets.boardButton < 42 ||
        touchTargets.promotionButton < 44 || touchTargets.navLink < 40) {
      throw new Error("Touch target sizing failed: " + JSON.stringify(touchTargets));
    }
  } finally {
    await touchContext.close();
  }

  if (failures.length) throw new Error(failures.join("\\n"));
  console.log("PASS: startup, human move and engine reply, compact board, resizing, three piece sets, themes, FEN import and validation, reset, black-side play, and mobile layout.");
} finally {
  await browser.close();
}
