import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const failures = [];

page.on("pageerror", error => failures.push(error.message));
page.on("console", message => {
  if (message.type() === "error") failures.push(message.text());
});

try {
  await page.goto("http://127.0.0.1:4173/", { waitUntil: "networkidle" });
  await page.waitForFunction(
    () => document.querySelector("#engine-state")?.textContent === "Engine ready",
    { timeout: 60000 }
  );

  if (!await page.evaluate(() => window.crossOriginIsolated)) {
    throw new Error("The page is not cross-origin isolated; the threaded engine cannot run.");
  }

  await page.locator('[data-square="e2"]').click();
  await page.locator('[data-square="e4"]').click();

  await page.waitForFunction(
    () => {
      const moves = [...document.querySelectorAll(".move-row")].map(row => row.textContent);
      return moves.some(row => row.includes("e4")) &&
        document.querySelector("#turn-label")?.textContent === "YOU · WHITE";
    },
    { timeout: 60000 }
  );

  const moveRows = await page.locator(".move-row").allTextContents();
  if (moveRows.length < 1) throw new Error("Move history did not record the opening moves.");
  if (failures.length) throw new Error(failures.join("\n"));

  console.log("PASS: WebAssembly engine loaded, e2e4 was accepted, Prunex replied, and history updated.");
} finally {
  await browser.close();
}
