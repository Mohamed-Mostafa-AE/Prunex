import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const failures = [];

page.on("pageerror", error => failures.push("pageerror: " + error.message));
page.on("worker", worker => {
  worker.on("console", message => failures.push("worker console: " + message.text()));
  worker.on("pageerror", error => failures.push("worker pageerror: " + error.message));
});
page.on("console", message => {
  if (message.type() === "error") failures.push(message.text());
});

try {
  await page.goto("http://127.0.0.1:4173/", { waitUntil: "networkidle" });
  await page.waitForFunction(
    () => {
      const state = document.querySelector("#engine-state")?.textContent;
      const status = document.querySelector("#status")?.textContent || "";
      return state === "Engine ready" || status.startsWith("Engine failed") || status.startsWith("Engine worker failed");
    },
    undefined,
    { timeout: 60000 }
  );

  const startup = await page.evaluate(() => ({
    engine: document.querySelector("#engine-state")?.textContent,
    status: document.querySelector("#status")?.textContent,
    isolated: window.crossOriginIsolated
  }));
  if (startup.engine !== "Engine ready") {
    throw new Error("Prunex engine startup failed: " + JSON.stringify(startup) + "\n" + failures.join("\n"));
  }

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
