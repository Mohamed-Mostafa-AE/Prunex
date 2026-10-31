import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const failures = [];
const workers = [];

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
  await page.goto("http://127.0.0.1:4173/", { waitUntil: "networkidle" });
  await page.waitForTimeout(10000);

  const startup = await page.evaluate(() => ({
    engine: document.querySelector("#engine-state")?.textContent,
    status: document.querySelector("#status")?.textContent,
    isolated: window.crossOriginIsolated,
    sharedArrayBuffer: typeof SharedArrayBuffer !== "undefined",
    href: location.href
  }));

  if (startup.engine !== "Engine ready") {
    throw new Error("Prunex engine startup failed: " + JSON.stringify(startup) +
      "\nWorkers: " + JSON.stringify(workers) + "\nErrors: " + failures.join("\n"));
  }

  if (!startup.isolated || !startup.sharedArrayBuffer) {
    throw new Error("Threaded WebAssembly preconditions are missing: " + JSON.stringify(startup));
  }

  await page.locator('[data-square="e2"]').click();
  await page.locator('[data-square="e4"]').click();

  await page.waitForFunction(
    () => {
      const moves = [...document.querySelectorAll(".move-row")].map(row => row.textContent);
      return moves.some(row => row.includes("e4")) &&
        document.querySelector("#turn-label")?.textContent === "YOU · WHITE";
    },
    undefined,
    { timeout: 60000 }
  );

  const moveRows = await page.locator(".move-row").allTextContents();
  if (moveRows.length < 1) throw new Error("Move history did not record the opening moves.");
  if (failures.length) throw new Error(failures.join("\n"));

  console.log("PASS: WebAssembly engine loaded, e2e4 was accepted, Prunex replied, and history updated.");
} finally {
  await browser.close();
}
