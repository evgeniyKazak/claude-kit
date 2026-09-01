#!/usr/bin/env node
// Render docs/boilerplate-architecture.html to docs/boilerplate-architecture.png.
// Uses puppeteer-core with a system Chrome (CI: the runner's preinstalled google-chrome).
// Usage: CHROME_PATH=/path/to/chrome node scripts/render-diagram-png.mjs [in.html] [out.png]
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import puppeteer from "puppeteer-core";

const inHtml = resolve(process.argv[2] ?? "docs/boilerplate-architecture.html");
const outPng = resolve(process.argv[3] ?? "docs/boilerplate-architecture.png");
const chrome =
  process.env.CHROME_PATH ||
  ["/usr/bin/google-chrome", "/usr/bin/chromium-browser", "/usr/bin/chromium"].find(existsSync);
if (!chrome) {
  console.error("No Chrome found. Set CHROME_PATH.");
  process.exit(1);
}
if (!existsSync(inHtml)) {
  console.error(`Input not found: ${inHtml}`);
  process.exit(1);
}

const browser = await puppeteer.launch({
  executablePath: chrome,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--force-color-profile=srgb", "--hide-scrollbars"],
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1680, height: 1050, deviceScaleFactor: 2 });
  await page.goto(`file://${inHtml}`, { waitUntil: "networkidle0", timeout: 60000 });
  await page.waitForSelector("svg", { timeout: 30000 });
  // let the viewer finish its initial fit/layout animation
  await new Promise((r) => setTimeout(r, 1500));
  const svg = await page.$("svg");
  const box = await svg.boundingBox();
  if (box && box.width > 100 && box.height > 100) {
    await svg.screenshot({ path: outPng });
  } else {
    await page.screenshot({ path: outPng, fullPage: false });
  }
  console.log(`rendered ${outPng}`);
} finally {
  await browser.close();
}
