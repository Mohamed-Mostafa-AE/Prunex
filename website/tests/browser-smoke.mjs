import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const vercelConfig = JSON.parse(readFileSync("vercel.json", "utf8"));
const contentSecurityPolicy = vercelConfig.headers
  ?.flatMap(rule => rule.headers || [])
  .find(header => header.key.toLowerCase() === "content-security-policy")?.value || "";
if (!contentSecurityPolicy.includes("https://ttcejatqtvphzenjkkbh.supabase.co") ||
    !contentSecurityPolicy.includes("wss://ttcejatqtvphzenjkkbh.supabase.co")) {
  throw new Error("Production CSP must allow this project's Supabase API and WebSocket endpoints.");
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const failures = [];
const workers = [];
const requests = [];
const baseUrl = process.env.PRUNEX_BASE_URL || "http://127.0.0.1:4173/";

page.on("request", request => requests.push(request.url()));
page.on("requestfailed", request => failures.push(
  "requestfailed: " + request.method() + " " + request.url() + " — " + (request.failure()?.errorText || "unknown")
));
page.on("response", response => {
  if (response.status() >= 400) {
    failures.push("http " + response.status() + ": " + response.request().method() + " " + response.url());
  }
});
page.on("pageerror", error => failures.push("pageerror: " + error.message));
page.on("worker", worker => {
  workers.push(worker.url());
  worker.on("console", message => failures.push("worker console: " + message.text()));
  worker.on("pageerror", error => failures.push("worker pageerror: " + error.message));
});
page.on("console", message => {
  if (message.type() === "error") {
    const location = message.location();
    failures.push("console: " + message.text() + (location.url ? " @ " + location.url : ""));
  }
});

try {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  for (const [path, expectedHeading] of [
    ["privacy.html", "Privacy Notice"],
    ["terms.html", "Terms of Use"]
  ]) {
    const response = await page.request.get(new URL(path, baseUrl).toString());
    if (!response.ok()) {
      throw new Error(path + " must be included in the production build (HTTP " + response.status() + ").");
    }
    const markup = await response.text();
    if (!markup.includes("<h1>" + expectedHeading + "</h1>")) {
      throw new Error(path + " did not return the expected legal document.");
    }
  }
  await page.waitForTimeout(10000);
  const requireCloudArchive = process.env.PRUNEX_REQUIRE_CLOUD === "true";
  const cloudEnvironmentConfigured = Boolean(
    process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  );
  if (requireCloudArchive && !cloudEnvironmentConfigured) {
    throw new Error("PRUNEX_REQUIRE_CLOUD is true, but a dedicated staging Supabase URL and publishable key were not supplied.");
  }
  const expectedArchiveStatus = requireCloudArchive
    ? "saved privately to your guest profile"
    : "Local game saving is available.";
  await page.waitForFunction(expected =>
    document.querySelector("#game-archive-note")?.textContent.includes(expected),
    expectedArchiveStatus,
    { timeout: 30000 }
  );
  const archiveStatus = await page.locator("#game-archive-note").innerText();
  if (!archiveStatus.includes(expectedArchiveStatus)) {
    throw new Error("The game archive did not reach its expected mode: " + archiveStatus);
  }
  for (const selector of ["#link-account-form", "#restore-account-form", "#delete-account-form", "#account-recovery-email", "#restore-account-email", "#delete-account-confirmation"]) {
    if (await page.locator(selector).count() !== 1) {
      throw new Error("Account recovery/deletion control missing: " + selector);
    }
  }
  if (await page.locator("#turnstile-widget-container").isVisible()) {
    throw new Error("Turnstile should stay hidden until guest registration actually requires verification.");
  }
  if (!(await page.locator("#defeat-sound").isChecked())) {
    throw new Error("The approved defeat sound should be enabled by default.");
  }
  await page.locator(".settings-group").nth(1).locator("summary").click();
  await page.locator(".settings-group").nth(2).locator("summary").click();
  if (!(await page.locator("#show-evaluation").isChecked())) {
    throw new Error("The evaluation bar should be visible by default.");
  }
  await page.locator("#show-evaluation").uncheck();
  if (await page.locator("#evaluation-column").isVisible()) {
    throw new Error("The evaluation bar should be fully removable from the board layout.");
  }
  await page.locator("#show-evaluation").check();
  if (!(await page.locator("#evaluation-column").isVisible())) {
    throw new Error("The evaluation bar should return when re-enabled.");
  }
  if (!(await page.evaluate(() => Boolean(window.AudioContext || window.webkitAudioContext)))) {
    throw new Error("The browser should support synthesized board sounds.");
  }
  if ((await page.locator("#nodes option").allTextContents()).some(label => /nodes/i.test(label))) {
    throw new Error("Opponent strength labels should not expose internal node counts.");
  }

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
  const standardsCopy = await page.locator("#analysis-standards").innerText();
  if (!standardsCopy.includes("Strength is earned in testing") || !standardsCopy.includes("45")) {
    throw new Error("The site should explain the current validation standard without claiming an unverified rating.");
  }
  if (await page.locator("#match-results").count()) {
    throw new Error("The unsupported historical rating comparison should not be presented as a current Prunex rating.");
  }
  if (!testingCopy.includes("44/44") || !testingCopy.includes("GCC 14.2 Release")) throw new Error("The regression test results are missing.");
  const favicon = await page.locator('link[rel="icon"]').getAttribute("href");
  if (favicon !== "/prunex-mark.png?v=4") throw new Error("Transparent Prunex mark is not configured as the favicon.");
  const markResponse = await page.request.get(new URL("/prunex-mark.png?v=4", baseUrl).toString());
  if (!markResponse.ok()) throw new Error("Transparent Prunex mark failed to load: " + markResponse.status());
  await page.locator("#site-theme-toggle").click();
  if (await page.locator("html").getAttribute("data-site-theme") !== "dark") throw new Error("Dark theme did not activate.");
  await page.reload({ waitUntil: "networkidle" });
  await page.locator(".settings-group").nth(1).locator("summary").click();
  if (await page.locator("html").getAttribute("data-site-theme") !== "dark") throw new Error("Dark theme preference was not persisted.");
  await page.locator("#site-theme-toggle").click();
  if (await page.locator("html").getAttribute("data-site-theme") !== "light") throw new Error("Light theme did not restore.");

  if (!launchLayout.boardWidth || launchLayout.boardWidth > 550 || launchLayout.boardWidth < 480) {
    throw new Error("Default board size is not launch-appropriate: " + JSON.stringify(launchLayout));
  }
  if (launchLayout.pieceImages !== 32) throw new Error("Cburnett SVG pieces did not render: " + JSON.stringify(launchLayout));

  const visiblePageText = await page.locator("body").innerText();
  if (/\b\d+(?:\.\d+)?k\s+nodes\b/i.test(visiblePageText)) {
    throw new Error("Internal node-count shorthand must not be shown in the interface.");
  }

  const startup = await page.evaluate(() => ({
    engine: document.querySelector("#engine-state")?.textContent,
    status: document.querySelector("#status")?.textContent
  }));
  if (startup.engine !== "Engine ready") {
    throw new Error("Engine startup failed: " + JSON.stringify(startup) +
      "\nWorkers: " + JSON.stringify(workers) + "\nErrors: " + failures.join("\n"));
  }
  if (await page.locator("#board-size-disclosure, #board-size").count()) {
    throw new Error("The redundant board-size disclosure and range slider should not be present.");
  }
  if (!(await page.locator("#resize-board").isVisible())) {
    throw new Error("The unobtrusive board-corner resize grip should remain available.");
  }
  const panelToggle = page.locator("#toggle-analysis-panel");
  await panelToggle.click();
  if (await page.locator("#analysis-panel").isVisible()) throw new Error("The game side panel should close.");
  if (await panelToggle.getAttribute("aria-expanded") !== "false") throw new Error("Side-panel toggle aria state should update.");
  await panelToggle.click();
  if (!(await page.locator("#analysis-panel").isVisible())) throw new Error("The game side panel should reopen.");
  if (await page.locator("#share-position-memory").isChecked()) throw new Error("Shared position-memory contribution should require opt-in.");
  if (await page.locator("#best-move-display").inputValue() !== "piece") {
    throw new Error("The best-move marker should default to the moving piece.");
  }
  if (await page.locator(".piece-quality-marker").count() !== 0) {
    throw new Error("Live play must not display game-review move-quality markers.");
  }
  if (await page.locator("#review-budget").inputValue() !== "15000") {
    throw new Error("Game review should default to the recommended 15-second per-position budget.");
  }
  const historyList = page.locator("#move-list");
  const historyBefore = await historyList.evaluate(el => el.getBoundingClientRect().height);
  const historyGrip = page.locator("#resize-move-history");
  const gripBox = await historyGrip.boundingBox();
  await page.mouse.move(gripBox.x + gripBox.width / 2, gripBox.y + gripBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(gripBox.x + gripBox.width / 2, gripBox.y + gripBox.height / 2 + 120, { steps: 8 });
  await page.mouse.up();
  const historyAfter = await historyList.evaluate(el => el.getBoundingClientRect().height);
  if (historyAfter < historyBefore + 70) {
    throw new Error("Move history should resize when its bottom handle is dragged: " + historyBefore + " → " + historyAfter);
  }
  const savedHistoryHeight = await page.evaluate(() => localStorage.getItem("prunex-move-history-height"));
  if (Number(savedHistoryHeight) !== Math.round(historyAfter)) {
    throw new Error("Move history height should persist after resizing.");
  }
  await page.locator("#best-move-display").evaluate(el => {
    for (let group = el.closest("details"); group; group = group.parentElement?.closest("details")) {
      group.open = true;
    }
  });
  await page.locator("#best-move-display").selectOption("arrow");
  await page.locator("#best-move-display").selectOption("off");
  if (await page.locator("#board .best-move-arrow").count()) {
    throw new Error("The arrow overlay must disappear when arrows are disabled.");
  }
  await page.locator("#best-move-display").selectOption("piece");
  if (await page.locator("#move-method").inputValue() !== "both") {
    throw new Error("Drag-or-click should be the default move method.");
  }
  await page.evaluate(() => { window.__prunexPieceBefore = document.querySelector('[data-square="e2"] .piece'); });
  await page.locator('[data-square="e2"]').click();
  const selectionStable = await page.evaluate(() =>
    window.__prunexPieceBefore === document.querySelector('[data-square="e2"] .piece')
  );
  if (!selectionStable) throw new Error("Selecting a piece must not rebuild or jerk the board pieces.");
  await page.locator('[data-square="e4"]').click();
  await page.waitForFunction(() =>
    [...document.querySelectorAll(".move-row")].some(row => row.textContent.includes("e4")),
    undefined,
    { timeout: 60000 }
  );
  await page.waitForFunction(() =>
    document.querySelector("#turn-label")?.textContent.includes("YOUR TURN"),
    undefined,
    { timeout: 60000 }
  );
  const latestMoveHighlights = await page.evaluate(() => {
    const destination = document.querySelector("#board .last-move-to");
    return {
      from: document.querySelectorAll("#board .last-move-from").length,
      to: document.querySelectorAll("#board .last-move-to").length,
      color: destination ? getComputedStyle(destination, "::after").backgroundColor : ""
    };
  });
  const highlightRgb = latestMoveHighlights.color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (latestMoveHighlights.from !== 1 || latestMoveHighlights.to !== 1 ||
      !highlightRgb || Number(highlightRgb[3]) <= Number(highlightRgb[1]) * 1.2) {
    throw new Error("The most recent move should have one origin and destination with a blue highlight: " + JSON.stringify(latestMoveHighlights));
  }
  await page.locator(".settings-group").nth(3).locator("summary").click();
  if (await page.locator("#sound-style option").count() !== 3) {
    throw new Error("The three refined Prunex move-sound profiles should be available.");
  }
  await page.locator("#sound-style").selectOption("soft");
  await page.locator("#preview-move-sound").click();
  await page.locator("#sound-style").selectOption("muted");
  await page.locator("#preview-move-sound").click();
  await page.locator("#sound-style").selectOption("classic");
  await page.locator("#preview-move-sound").click();
  await page.locator("#move-method").selectOption("both");
  await page.locator("#board").scrollIntoViewIfNeeded();
  await page.locator('[data-square="g1"]').scrollIntoViewIfNeeded();
  const knightStart = await page.locator('[data-square="g1"]').boundingBox();
  const knightEnd = await page.locator('[data-square="f3"]').boundingBox();
  await page.mouse.move(knightStart.x + knightStart.width / 2, knightStart.y + knightStart.height / 2);
  await page.mouse.down();
  await page.mouse.move(knightEnd.x + knightEnd.width / 2, knightEnd.y + knightEnd.height / 2, { steps: 8 });
  await page.mouse.up();
  await page.waitForFunction(() =>
    [...document.querySelectorAll(".move-row")].some(row => row.textContent.includes("Nf3")) &&
    document.querySelector("#turn-label")?.textContent.includes("YOUR TURN"),
    undefined,
    { timeout: 60000 }
  );

  await page.locator('#move-list .move-notation[data-ply="1"]').click();
  if (!(await page.locator("#turn-label").textContent()).includes("REVIEW · BLACK TO MOVE") ||
      !(await page.locator("#fen-input").inputValue()).includes(" b ")) {
    throw new Error("Clicking a move notation should navigate to the position immediately after that move.");
  }
  if (!(await page.locator('[data-square="e2"]').getAttribute("class")).includes("last-move-from") ||
      !(await page.locator('[data-square="e4"]').getAttribute("class")).includes("last-move-to")) {
    throw new Error("Move-history navigation should highlight both squares of the selected move.");
  }
  if (await page.locator("#return-live").count() !== 0) {
    throw new Error("The separate Back to live control should not be rendered.");
  }
  if (!(await page.locator("#move-prev").isEnabled()) || !(await page.locator("#move-next").isEnabled())) {
    throw new Error("Previous and next move arrows should be available while reviewing an interior position.");
  }
  await page.locator("#move-prev").click();
  if (!(await page.locator("#fen-input").inputValue()).includes(" w ") ||
      !/^0 \/ \d+$/.test(await page.locator("#move-position-label").textContent())) {
    throw new Error("Previous-move arrow should step back to the starting position.");
  }
  await page.locator("#move-next").click();
  if (!(await page.locator("#fen-input").inputValue()).includes(" b ")) {
    throw new Error("Next-move arrow should restore the next reviewed position.");
  }
  await page.keyboard.press("ArrowLeft");
  if (!(await page.locator("#fen-input").inputValue()).includes(" w ")) {
    throw new Error("Left arrow key should step back one move during review.");
  }
  await page.keyboard.press("ArrowRight");
  if (!(await page.locator("#fen-input").inputValue()).includes(" b ")) {
    throw new Error("Right arrow key should step forward one move during review.");
  }
  await page.locator("#move-next").click();
  if (!(await page.locator("#fen-input").inputValue()).includes(" w ")) {
    throw new Error("The selected review position should be ready for White to move.");
  }
  await page.locator('[data-square="b1"]').click();
  await page.locator('[data-square="c3"]').click();
  await page.waitForFunction(() =>
    document.querySelector('#move-list .move-notation[data-ply="3"]')?.textContent === "Nc3",
    undefined,
    { timeout: 60000 }
  );
  const branchedMoves = await page.locator("#move-list .move-notation").allTextContents();
  if (branchedMoves.includes("Nf3")) {
    throw new Error("Playing from a reviewed position should replace the old future line.");
  }
  await page.waitForFunction(() =>
    document.querySelector("#evaluation-label")?.textContent !== "…" &&
    document.querySelector("#analysis-status")?.textContent.startsWith("DEPTH"),
    undefined,
    { timeout: 60000 }
  );
  if (!(await page.locator("#evaluation-label").textContent()).trim()) {
    throw new Error("The engine evaluation readout should contain a score.");
  }

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
  const resultScope = await page.locator("#game-result-dialog").evaluate(element => {
    const frame = element.closest(".board-frame");
    const board = document.querySelector("#board");
    const overlayRect = element.getBoundingClientRect();
    const boardRect = board.getBoundingClientRect();
    const frameRect = frame.getBoundingClientRect();
    return {
      parentIsBoardFrame: element.parentElement === frame,
      ariaModal: element.getAttribute("aria-modal"),
      overlayMatchesBoard: Math.abs(overlayRect.left - boardRect.left) < 2 &&
        Math.abs(overlayRect.top - boardRect.top) < 2 &&
        Math.abs(overlayRect.width - boardRect.width) < 2 &&
        Math.abs(overlayRect.height - boardRect.height) < 2,
      overlayInsideFrame: overlayRect.left >= frameRect.left &&
        overlayRect.right <= frameRect.right &&
        overlayRect.top >= frameRect.top &&
        overlayRect.bottom <= frameRect.bottom,
      openNativeDialogs: document.querySelectorAll("dialog[open]").length
    };
  });
  if (!resultScope.parentIsBoardFrame || resultScope.ariaModal !== "false" ||
      !resultScope.overlayMatchesBoard || !resultScope.overlayInsideFrame ||
      resultScope.openNativeDialogs !== 0) {
    throw new Error("Game-result popup must be confined to the chessboard: " + JSON.stringify(resultScope));
  }

  await page.locator("#site-theme-toggle").click();
  if (await page.locator("html").getAttribute("data-site-theme") !== "dark" ||
      !(await page.locator("#game-result-dialog").isVisible())) {
    throw new Error("The page outside the chessboard should remain interactive while the result popup is open.");
  }
  await page.locator("#site-theme-toggle").click();
  await page.locator(".board-frame").screenshot({ path: "artifacts/game-result-draw-desktop.png" });
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
  const boardBeforeGrip = await page.locator(".board-frame").evaluate(el => Math.round(el.getBoundingClientRect().width));
  const resizeGrip = await page.locator("#resize-board").boundingBox();
  if (!resizeGrip) throw new Error("Board resize grip is unavailable.");
  await page.mouse.move(resizeGrip.x + resizeGrip.width / 2, resizeGrip.y + resizeGrip.height / 2);
  await page.mouse.down();
  await page.mouse.move(resizeGrip.x + resizeGrip.width / 2 + 90, resizeGrip.y + resizeGrip.height / 2 + 90, { steps: 8 });
  await page.mouse.up();
  const enlargedBoard = await page.locator(".board-frame").evaluate(el => Math.round(el.getBoundingClientRect().width));
  if (enlargedBoard <= boardBeforeGrip + 35) {
    throw new Error("Dragging the unobtrusive corner grip should resize the board: " + boardBeforeGrip + " -> " + enlargedBoard);
  }
  if (await page.locator(".opponent-label strong").textContent() !== "PRUNEX") throw new Error("Engine badge should identify the branded Prunex Play browser experience.");
  const engineNote = await page.locator(".engine-note").innerText();
  if (!engineNote.includes("PRUNEX") || /Stockfish/i.test(engineNote)) {
    throw new Error("The analysis panel should keep its focus on the Prunex experience.");
  }
  const licenseNote = await page.locator(".license-note").innerText();
  if (!licenseNote.includes("Stockfish.js 19 Full") || !licenseNote.includes("GPLv3")) {
    throw new Error("The browser engine's license and attribution notice is missing.");
  }
  const sharingCopy = await page.locator("body").innerText();
  if (!sharingCopy.includes("they do not retrain or change the native C++ engine")) {
    throw new Error("Shared position-memory opt-in must explain that it does not retrain the native engine.");
  }
  if (!requests.some(url => url.includes("/engine/stockfish-19.js")) ||
      !requests.some(url => url.includes("/engine/stockfish-19.wasm"))) {
    throw new Error("The full analysis worker and its WebAssembly network were not loaded.");
  }
  const workspaceBackground = await page.locator(".workspace").evaluate(el => getComputedStyle(el).backgroundColor);
  const avatarBackground = await page.locator(".engine-avatar").evaluate(el => getComputedStyle(el).backgroundColor);
  if (workspaceBackground !== avatarBackground) throw new Error("Transparent Prunex mark background should match the dark board section.");
  await page.locator("#piece-style").selectOption("letters");
  if (await page.locator("#board").getAttribute("data-pieces") !== "letters" || !(await page.locator("#board .piece-letters").count())) {
    throw new Error("Letter piece set did not render.");
  }
  if (await page.locator('#piece-style option[value="unicode"]').count()) {
    throw new Error("Unicode pieces should be removed; the SVG Staunton set is the default.");
  }
  await page.locator("#piece-style").selectOption("letters");
  const letterStyle = await page.locator("#board .piece-letters").first().evaluate(el => ({
    stroke: getComputedStyle(el).webkitTextStroke,
    shadow: getComputedStyle(el).textShadow
  }));
  if (letterStyle.shadow !== "none") {
    throw new Error("The Unicode contrast treatment must not affect letter pieces.");
  }
  await page.locator("#piece-style").selectOption("cburnett");
  if (await page.locator("#board .piece-svg use").count() !== 32) {
    throw new Error("The Staunton SVG set must remain unchanged.");
  }
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

  const screenshotCheckmateFen = "r1b1kbn1/pp1p1pp1/8/2p1n3/3pP3/3K1pq1/PPPB4/RN1Q1B2 w - - 0 1";
  await page.locator("#fen-input").fill(screenshotCheckmateFen);
  await page.locator("#load-fen").click();
  await page.waitForTimeout(100);
  const screenshotPositionState = await page.evaluate(() => ({
    feedback: document.querySelector("#fen-feedback")?.textContent,
    status: document.querySelector("#status")?.textContent,
    turn: document.querySelector("#turn-label")?.textContent,
    fen: document.querySelector("#fen-input")?.value,
    overlayHidden: document.querySelector("#game-result-dialog")?.hidden
  }));
  if (screenshotPositionState.overlayHidden ||
      screenshotPositionState.turn !== "CHECKMATE · YOU LOST" ||
      !screenshotPositionState.status?.includes("Checkmate")) {
    throw new Error("Screenshot position did not load as checkmate: " + JSON.stringify(screenshotPositionState));
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
  await page.locator(".board-frame").screenshot({ path: "artifacts/game-result-win-desktop.png" });
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
  await page.locator(".board-frame").screenshot({ path: "artifacts/game-result-loss-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator(".board-frame").screenshot({ path: "artifacts/game-result-loss-mobile.png" });
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
    board: document.querySelector("#board")?.getBoundingClientRect().width,
    reviewNavUnderBoard: document.querySelector(".board-stage")?.nextElementSibling?.classList.contains("move-navigation"),
    reviewControls: [...document.querySelectorAll(".move-nav-button")].map(button => Math.round(button.getBoundingClientRect().height))
  }));
  if (mobile.content > mobile.viewport + 1 || !mobile.board || mobile.board > mobile.viewport) {
    throw new Error("Mobile layout overflows: " + JSON.stringify(mobile));
  }
  if (!mobile.reviewNavUnderBoard || mobile.reviewControls.some(height => height < 42)) {
    throw new Error("Mobile review controls must sit directly under the board with finger-sized buttons: " + JSON.stringify(mobile));
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
    const resizeDisplay = await page.evaluate(() => ({
      board: getComputedStyle(document.querySelector("#resize-board")).display,
      history: getComputedStyle(document.querySelector("#resize-move-history")).display
    }));
    const expectsResize = device.width > 700;
    if (expectsResize && (resizeDisplay.board === "none" || resizeDisplay.history === "none")) {
      throw new Error("Tablet/laptop should retain resize affordances at " + device.name + ": " + JSON.stringify(resizeDisplay));
    }
    if (!expectsResize && (resizeDisplay.board !== "none" || resizeDisplay.history !== "none")) {
      throw new Error("Phone layouts must not show resize affordances at " + device.name + ": " + JSON.stringify(resizeDisplay));
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
      const board = document.querySelector("#board");
      const boardFrame = element.closest(".board-frame");
      const overlay = element.getBoundingClientRect();
      const boardRect = board.getBoundingClientRect();
      const frame = boardFrame.getBoundingClientRect();
      const panel = element.querySelector(".game-result-panel").getBoundingClientRect();
      return {
        overlay: { left: overlay.left, top: overlay.top, width: overlay.width, height: overlay.height },
        board: { left: boardRect.left, top: boardRect.top, width: boardRect.width, height: boardRect.height },
        frame: { left: frame.left, top: frame.top, width: frame.width, height: frame.height },
        overlayMatchesBoard: Math.abs(overlay.left - boardRect.left) < 2 &&
          Math.abs(overlay.top - boardRect.top) < 2 &&
          Math.abs(overlay.width - boardRect.width) < 2 &&
          Math.abs(overlay.height - boardRect.height) < 2,
        overlayInsideFrame: overlay.left >= frame.left &&
          overlay.right <= frame.right &&
          overlay.top >= frame.top &&
          overlay.bottom <= frame.bottom,
        panelInsideOverlay: panel.left >= overlay.left &&
          panel.right <= overlay.right &&
          panel.top >= overlay.top &&
          panel.bottom <= overlay.bottom,
        panelScrollsWhenNeeded: getComputedStyle(element.querySelector(".game-result-panel")).overflowY === "auto"
      };
    });
    if (!dialog.overlayMatchesBoard || !dialog.overlayInsideFrame ||
        !dialog.panelInsideOverlay || !dialog.panelScrollsWhenNeeded) {
      throw new Error("Result popup escaped its board at " + device.name + ": " + JSON.stringify(dialog));
    }
    if (device.name !== "modal-landscape") {
      await page.screenshot({ path: "artifacts/responsive-" + device.name + ".png" });
    }
  }
  await page.keyboard.press("Escape");
  if (await page.locator("#game-result-dialog").isVisible()) {
    throw new Error("Escape should dismiss the board-scoped result popup.");
  }

  await page.waitForFunction(() =>
    Number.parseInt(document.querySelector("#game-archive-count")?.textContent || "0", 10) >= 1,
    undefined,
    { timeout: 15000 }
  );
  if (!(await page.locator("#game-archive-list .archive-game").count())) {
    throw new Error("Completed games should be saved in the local game archive.");
  }

  await page.locator("#side").selectOption("w");
  await page.locator("#fen-input").fill("7k/5Q2/6K1/8/8/8/8/8 w - - 0 1");
  await page.locator("#load-fen").click();
  await page.locator('[data-square="f7"]').click();
  await page.locator('[data-square="g7"]').click();
  await page.locator("#game-result-dialog").waitFor({ state: "visible" });
  if (await page.locator("#turn-label").textContent() !== "CHECKMATE · YOU WON") {
    throw new Error("A one-move checkmate should update the turn indicator to a win.");
  }
  if (!(await page.locator("#review-budget").isVisible())) {
    await page.locator(".settings-group").nth(2).locator("summary").click();
  }
  await page.locator("#review-budget").evaluate(el => {
    for (let group = el.closest("details"); group; group = group.parentElement?.closest("details")) {
      group.open = true;
    }
  });
  await page.locator("#review-budget").selectOption("3000");
  await page.locator("#game-result-review").click();
  try {
    await page.waitForFunction(() => {
      const label = document.querySelector("#review-progress-label")?.textContent || "";
      return label.includes("Analysis complete") || label.includes("Game analysis failed");
    }, undefined, { timeout: 30000 });
  } catch (error) {
    const reviewState = await page.evaluate(() => ({
      progress: document.querySelector("#review-progress-label")?.textContent,
      summary: document.querySelector("#review-summary")?.textContent,
      engine: document.querySelector("#engine-state")?.textContent,
      status: document.querySelector("#status")?.textContent,
      busy: document.querySelector("#engine-state")?.dataset.busy,
      reviewVisible: !document.querySelector("#game-review-panel")?.hidden
    }));
    await page.screenshot({ path: "artifacts/game-review-debug.png" });
    throw new Error("Post-game analysis did not complete: " + JSON.stringify(reviewState) +
      "; browser errors: " + failures.join(" | ") + "; " + error.message);
  }
  if ((await page.locator("#review-progress-label").textContent()).includes("Game analysis failed")) {
    throw new Error("Post-game analysis failed: " + await page.locator("#review-progress-label").textContent());
  }
  if (!(await page.locator("#move-list .move-grade").count()) ||
      !(await page.locator("#review-summary").innerText()).includes("%")) {
    throw new Error("Post-game review should grade the played move and calculate player accuracy.");
  }
  if (!(await page.locator("#review-method-note").textContent()).includes("expected points")) {
    throw new Error("The review should disclose its expected-points evaluation method.");
  }
  const pointLossData = await page.locator("#move-list .move-grade").evaluateAll(nodes =>
    nodes.map(node => Number(node.dataset.expectedPointLoss)).filter(Number.isFinite)
  );
  if (!pointLossData.length || pointLossData.some(value => value < 0 || value > 1)) {
    throw new Error("Move grades should store valid expected-point losses between 0 and 1.");
  }
  if (await page.locator(".piece-quality-marker").count() < 1) {
    throw new Error("Game Review should render move-quality markers on the reviewed board position.");
  }
  const moveGrades = await page.locator("#move-list .move-grade").allTextContents();
  if (!moveGrades.some(grade => ["BEST","BRILLIANT","EXCELLENT","GOOD","INACCURACY","MISTAKE","BLUNDER","MISS"].includes(grade))) {
    throw new Error("Game Review should use the expanded move-quality classification vocabulary.");
  }
  const accuracyValues = await page.locator(".review-player strong").allTextContents();
  if (accuracyValues.some(value => Number.parseFloat(value) > 100 || Number.parseFloat(value) < 0)) {
    throw new Error("Review accuracy must remain between 0% and 100%.");
  }
  if (!(await page.locator("#review-progress-label").textContent()).includes("deepest depth") ||
      !(await page.locator("#review-depth").textContent()).includes("AVG DEPTH")) {
    throw new Error("Game review should expose the deepest and average completed engine depth.");
  }

  const archivedCountBeforeReload = await page.locator("#game-archive-list .archive-game").count();
  if (archivedCountBeforeReload < 1) throw new Error("At least one completed game should be archived before reload.");
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForFunction(expectedCount =>
    document.querySelector("#game-archive-note")?.textContent.includes("Local game saving is available.") &&
    document.querySelectorAll("#game-archive-list .archive-game").length >= expectedCount,
    archivedCountBeforeReload,
    { timeout: 30000 }
  );

  await page.setViewportSize({ width: 1440, height: 900 });
  const analysisSettingsDesktop = page.locator(".settings-group").nth(2);
  if (!(await page.locator("#board-annotations").isVisible())) {
    await analysisSettingsDesktop.locator("summary").click();
  }
  await page.locator("#board-annotations").check();
  const arrowStart = await page.locator('[data-square="a1"]').boundingBox();
  const arrowEnd = await page.locator('[data-square="a3"]').boundingBox();
  if (!arrowStart || !arrowEnd) throw new Error("Annotation test squares are not visible.");
  await page.mouse.move(arrowStart.x + arrowStart.width / 2, arrowStart.y + arrowStart.height / 2);
  await page.mouse.down({ button: "right" });
  await page.mouse.move(arrowEnd.x + arrowEnd.width / 2, arrowEnd.y + arrowEnd.height / 2, { steps: 8 });
  await page.mouse.up({ button: "right" });
  if (!(await page.locator(".annotation-layer .annotation-arrow").count())) {
    throw new Error("Right-click drag should draw an annotation arrow.");
  }
  await page.locator("#clear-marks").click();

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
    await touchPage.waitForFunction(
      () => document.querySelector("#engine-state")?.textContent === "Engine ready",
      undefined,
      { timeout: 60000 }
    );
    const panelToggle = touchPage.locator("#toggle-analysis-panel");
    if (await panelToggle.getAttribute("aria-expanded") !== "true") await panelToggle.tap();
    await touchPage.locator(".board-frame").scrollIntoViewIfNeeded();
    const scrollBeforeMove = await touchPage.evaluate(() => window.scrollY);
    await touchPage.locator('[data-square="e2"]').click();
    await touchPage.locator('[data-square="e4"]').click();
    await touchPage.waitForFunction(
      () => [...document.querySelectorAll(".move-row")].some(row => row.textContent.includes("e4")),
      undefined,
      { timeout: 60000 }
    );
    const scrollAfterMove = await touchPage.evaluate(() => window.scrollY);
    if (Math.abs(scrollAfterMove - scrollBeforeMove) > 3) {
      throw new Error("Making a move with the side panel open must not scroll the page to move history: " +
        scrollBeforeMove + " -> " + scrollAfterMove);
    }
    await touchPage.waitForFunction(
      () => [...document.querySelectorAll("#game-archive-list .archive-game")]
        .some(row => row.textContent.includes("IN PROGRESS")),
      undefined,
      { timeout: 30000 }
    );
    const activeGameRows = await touchPage.locator("#game-archive-list .archive-game").count();
    await touchPage.reload({ waitUntil: "networkidle" });
    await touchPage.waitForFunction(
      count => document.querySelectorAll("#game-archive-list .archive-game").length >= count &&
        [...document.querySelectorAll("#game-archive-list .archive-game")]
          .some(row => row.textContent.includes("IN PROGRESS")),
      activeGameRows,
      { timeout: 30000 }
    );
    const analysisSettings = touchPage.locator(".settings-group").nth(2);
    if (!(await touchPage.locator("#board-annotations").isVisible())) {
      await analysisSettings.locator("summary").tap();
    }
    await touchPage.locator("#board-annotations").check();
    await touchPage.locator('[data-square="a1"]').tap();
    await touchPage.locator('[data-square="a3"]').tap();
    if (!(await touchPage.locator(".annotation-layer .annotation-arrow").count())) {
      throw new Error("Touch annotations should draw an arrow after tapping an origin and destination.");
    }
    await touchPage.locator("#clear-marks").tap();

    // Enter a review position from move history, then play directly on the board.
    // The board move itself must branch from the selected FEN with no resume button.
    await touchPage.locator('[data-square="e2"]').tap();
    await touchPage.locator('[data-square="e4"]').tap();
    await touchPage.waitForFunction(() =>
      [...document.querySelectorAll(".move-row")].some(row => row.textContent.includes("e4"))
    );
    const firstAvailableMove = touchPage.locator("#move-list .move-notation").first();
    if (await firstAvailableMove.count()) await firstAvailableMove.tap();
    const reviewState = await touchPage.evaluate(() => ({
      reviewing: !!document.querySelector("#move-position-label")?.textContent?.trim(),
      boardSquares: document.querySelectorAll("#board .square").length,
      buttons: [...document.querySelectorAll("button")].map(button => button.textContent.trim().toLowerCase())
    }));
    if (reviewState.boardSquares !== 64) throw new Error("Board should stay interactive during review.");
    if (reviewState.buttons.some(label => label.includes("back to live"))) {
      throw new Error("A separate Back to live action must not be present.");
    }
  } finally {
    await touchContext.close();
  }

  if (failures.length) throw new Error(failures.join("\\n"));
  console.log("PASS: startup, human move and engine reply, compact board, resizing, three piece sets, themes, FEN import and validation, reset, black-side play, mobile review navigation, touch annotations, and responsive layout.");
} finally {
  await browser.close();
}
