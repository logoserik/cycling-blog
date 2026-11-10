import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { chromium } from "playwright";

/**
 * Open the target URL in a headed real Chrome window on your machine.
 * Complete any soft Cloudflare check yourself, then press Enter in the terminal
 * to save cookies/storage for later `npm run check` runs.
 *
 * This stays on one URL — it does not crawl.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
dotenv.config({ path: path.join(root, ".env") });

const TARGET_URL =
  process.env.TARGET_URL ||
  "https://www.britishmuseum.org/exhibitions/bayeux-tapestry";
const STORAGE_STATE_PATH = path.resolve(
  root,
  process.env.STORAGE_STATE_PATH || ".auth/storage-state.json",
);
const USER_AGENT = process.env.USER_AGENT || "";
const USE_SYSTEM_CHROME = ["1", "true", "yes"].includes(
  String(process.env.USE_SYSTEM_CHROME || "1").toLowerCase(),
);

async function main() {
  const launchOptions = { headless: false };
  if (USE_SYSTEM_CHROME) launchOptions.channel = "chrome";

  let browser;
  try {
    browser = await chromium.launch(launchOptions);
  } catch (err) {
    console.warn(
      `system Chrome unavailable (${err.message}); using bundled Chromium`,
    );
    browser = await chromium.launch({ headless: false });
  }

  const contextOptions = { viewport: { width: 1280, height: 900 } };
  if (USER_AGENT) contextOptions.userAgent = USER_AGENT;

  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  console.log(`Opening ${TARGET_URL}`);
  console.log(
    "If Cloudflare appears, wait or complete it in this window. Stay on this page.",
  );
  await page.goto(TARGET_URL, { waitUntil: "domcontentloaded", timeout: 60000 });

  process.stdin.resume();
  console.log("\nPress Enter here when the real exhibition page is visible…");
  await new Promise((resolve) => process.stdin.once("data", resolve));

  fs.mkdirSync(path.dirname(STORAGE_STATE_PATH), { recursive: true });
  await context.storageState({ path: STORAGE_STATE_PATH });
  console.log(`Saved storage state → ${STORAGE_STATE_PATH}`);
  await browser.close();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
