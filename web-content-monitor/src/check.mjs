import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { chromium } from "playwright";
import { isCloudflareChallenge } from "./lib/cloudflare.mjs";
import { diffSnippet, normalizeText } from "./lib/normalize.mjs";
import { sendSlack } from "./lib/slack.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
dotenv.config({ path: path.join(root, ".env") });

const TARGET_URL =
  process.env.TARGET_URL ||
  "https://www.britishmuseum.org/exhibitions/bayeux-tapestry";
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL || "";
const SLACK_CHANNEL =
  process.env.SLACK_CHANNEL || "#erik-playground-web-content-monitor";
const HEADED = ["1", "true", "yes"].includes(
  String(process.env.HEADED || "0").toLowerCase(),
);
const USE_SYSTEM_CHROME = ["1", "true", "yes"].includes(
  String(process.env.USE_SYSTEM_CHROME || "1").toLowerCase(),
);
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS || 45000);
const USER_AGENT = process.env.USER_AGENT || "";
const CF_CLEARANCE = process.env.CF_CLEARANCE || "";
const BASELINE_PATH = path.resolve(
  root,
  process.env.BASELINE_PATH || "data/baseline.json",
);
const STORAGE_STATE_PATH = path.resolve(
  root,
  process.env.STORAGE_STATE_PATH || ".auth/storage-state.json",
);

function londonNow() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (type) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("day")} ${get("month")} ${get("year")}, ${get("hour")}:${get("minute")} Europe/London`;
}

function hashText(text) {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

function readBaseline() {
  if (!fs.existsSync(BASELINE_PATH)) return null;
  return JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8"));
}

function writeBaseline(payload) {
  fs.mkdirSync(path.dirname(BASELINE_PATH), { recursive: true });
  fs.writeFileSync(BASELINE_PATH, JSON.stringify(payload, null, 2));
}

function domainFromUrl(url) {
  return new URL(url).hostname;
}

/**
 * Visible body text only — never follow links / crawl.
 * Strips common consent chrome when present as separate nodes.
 */
async function extractVisibleText(page) {
  return page.evaluate(() => {
    const reject = /cookie|consent|newsletter|subscribe|privacy/i;
    const clone = document.body ? document.body.cloneNode(true) : null;
    if (!clone) return "";

    for (const el of clone.querySelectorAll(
      '[id*="cookie" i], [class*="cookie" i], [id*="consent" i], [class*="consent" i], [aria-label*="cookie" i], dialog, [role="dialog"]',
    )) {
      const label = `${el.id} ${el.className} ${el.getAttribute("aria-label") || ""}`;
      if (reject.test(label) || el.tagName === "DIALOG" || el.getAttribute("role") === "dialog") {
        el.remove();
      }
    }

    return (clone.innerText || clone.textContent || "").trim();
  });
}

async function openTargetPage(browser) {
  const contextOptions = {
    viewport: { width: 1280, height: 900 },
  };
  if (USER_AGENT) contextOptions.userAgent = USER_AGENT;
  if (fs.existsSync(STORAGE_STATE_PATH)) {
    contextOptions.storageState = STORAGE_STATE_PATH;
  }

  const context = await browser.newContext(contextOptions);

  if (CF_CLEARANCE) {
    await context.addCookies([
      {
        name: "cf_clearance",
        value: CF_CLEARANCE,
        domain: domainFromUrl(TARGET_URL),
        path: "/",
        httpOnly: true,
        secure: true,
        sameSite: "None",
      },
    ]);
  }

  const page = await context.newPage();
  // Single navigation only — never click links or open other pages.
  await page.goto(TARGET_URL, {
    waitUntil: "domcontentloaded",
    timeout: TIMEOUT_MS,
  });

  // Allow soft Cloudflare interstitial time to clear on the same URL.
  const deadline = Date.now() + TIMEOUT_MS;
  while (Date.now() < deadline) {
    const title = await page.title().catch(() => "");
    const bodyText = await page.locator("body").innerText().catch(() => "");
    const challenged = isCloudflareChallenge({
      title,
      bodyText,
      url: page.url(),
    });
    if (!challenged) break;
    await page.waitForTimeout(1500);
  }

  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});

  return { context, page };
}

async function main() {
  console.log(`[check] target=${TARGET_URL}`);
  console.log(`[check] headed=${HEADED} systemChrome=${USE_SYSTEM_CHROME}`);

  const launchOptions = {
    headless: !HEADED,
  };
  if (USE_SYSTEM_CHROME) {
    launchOptions.channel = "chrome";
  }

  let browser;
  try {
    browser = await chromium.launch(launchOptions);
  } catch (err) {
    if (USE_SYSTEM_CHROME) {
      console.warn(
        `[check] system Chrome unavailable (${err.message}); falling back to bundled Chromium`,
      );
      browser = await chromium.launch({ headless: !HEADED });
    } else {
      throw err;
    }
  }

  let outcome = "ok";
  let detail = "";

  try {
    const { context, page } = await openTargetPage(browser);
    const title = await page.title().catch(() => "");
    const rawText = await extractVisibleText(page);
    const url = page.url();

    if (
      isCloudflareChallenge({ title, bodyText: rawText, url }) ||
      !rawText.trim()
    ) {
      outcome = "failed";
      detail = isCloudflareChallenge({ title, bodyText: rawText, url })
        ? "Cloudflare challenge blocked the page"
        : "Blank or empty page body";

      const when = londonNow();
      await sendSlack(
        SLACK_WEBHOOK_URL,
        [
          `Checker ran, but the check failed. (${SLACK_CHANNEL})`,
          `URL: ${TARGET_URL}`,
          `Reason: ${detail}`,
          `Time: ${when}`,
          "Existing baseline kept (not overwritten).",
        ].join("\n"),
      );
      console.error(`[check] FAILED: ${detail}`);
      await context.close();
      process.exitCode = 2;
      return;
    }

    const normalized = normalizeText(rawText);
    const hash = hashText(normalized);
    const when = londonNow();
    const baseline = readBaseline();

    if (!baseline) {
      writeBaseline({
        url: TARGET_URL,
        hash,
        text: normalized,
        savedAt: new Date().toISOString(),
        savedAtLondon: when,
      });
      await sendSlack(
        SLACK_WEBHOOK_URL,
        [
          `Checker baseline saved. No change to report yet. (${SLACK_CHANNEL})`,
          `URL: ${TARGET_URL}`,
          `Time: ${when}`,
        ].join("\n"),
      );
      console.log("[check] baseline saved");
      await context.close();
      return;
    }

    if (baseline.hash === hash) {
      console.log("[check] unchanged — no Slack message");
      await context.close();
      return;
    }

    const { before, after } = diffSnippet(baseline.text, normalized);
    writeBaseline({
      url: TARGET_URL,
      hash,
      text: normalized,
      savedAt: new Date().toISOString(),
      savedAtLondon: when,
      previousHash: baseline.hash,
    });

    await sendSlack(
      SLACK_WEBHOOK_URL,
      [
        `Website content changed. (${SLACK_CHANNEL})`,
        `URL: ${TARGET_URL}`,
        `Time: ${when}`,
        `Before: ${before}`,
        `After: ${after}`,
      ].join("\n"),
    );
    console.log("[check] content changed — Slack alert sent");
    await context.close();
  } catch (err) {
    outcome = "failed";
    detail = err.message || String(err);
    const when = londonNow();
    await sendSlack(
      SLACK_WEBHOOK_URL,
      [
        `Checker ran, but the check failed. (${SLACK_CHANNEL})`,
        `URL: ${TARGET_URL}`,
        `Reason: ${detail}`,
        `Time: ${when}`,
        "Existing baseline kept (not overwritten).",
      ].join("\n"),
    );
    console.error(`[check] FAILED: ${detail}`);
    process.exitCode = 2;
  } finally {
    await browser?.close();
    console.log(`[check] done outcome=${outcome}`);
  }
}

main();
