import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
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

  await page.locator("#theme").selectOption("violet");
  if (await page.locator("#board").getAttribute("data-theme") !== "violet") {
    throw new Error("Board theme did not update.");
  }

  await page.locator("#fen-input").fill("8/8/8/8/8/8/4k3/7K w - - 0 1");
  await page.locator("#load-fen").click();
  await page.waitForFunction(() => document.querySelectorAll("#board .piece").length === 2);
  if (!(await page.locator("#status").textContent()).includes("Draw")) {
    throw new Error("Custom FEN position failed.");
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

  await page.setViewportSize({ width: 390, height: 844 });
  const mobile = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
    board: document.querySelector("#board")?.getBoundingClientRect().width
  }));
  if (mobile.content > mobile.viewport + 1 || !mobile.board || mobile.board > mobile.viewport) {
    throw new Error("Mobile layout overflows: " + JSON.stringify(mobile));
  }

  if (failures.length) throw new Error(failures.join("\n"));
  console.log("PASS: startup, human move and engine reply, theme, FEN import and validation, reset, black-side play, and mobile layout.");
} finally {
  await browser.close();
}
