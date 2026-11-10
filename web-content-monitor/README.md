# Web content monitor (local Playwright POC)

Checks **one URL only** (no crawling). Compares normalized visible text to a saved baseline and posts Slack alerts when content changes or the check fails.

Default target: [British Museum – Bayeux Tapestry](https://www.britishmuseum.org/exhibitions/bayeux-tapestry)

## Behaviour

| Result | Action |
| --- | --- |
| First successful run | Save baseline + Slack: baseline saved |
| Text unchanged | No Slack message |
| Text changed | Slack: content changed (short before/after) + update baseline |
| Cloudflare / blank / timeout | Slack: check failed; **keep** existing baseline |

## Setup (on your machine)

```bash
cd web-content-monitor
cp .env.example .env
npm install
```

Edit `.env`:

1. Set `SLACK_WEBHOOK_URL` to an Incoming Webhook for `#erik-playground-web-content-monitor`.
2. Leave `TARGET_URL` as-is unless you change the page.
3. Prefer `USE_SYSTEM_CHROME=1` and run from your home/office network (residential IP).

### Optional: warm Cloudflare cookies on this machine

```bash
npm run auth:save
```

A Chrome window opens on the target URL. When the real page is visible, press Enter in the terminal. Cookies are saved to `.auth/storage-state.json` for later checks.

You can also set `CF_CLEARANCE` / `USER_AGENT` in `.env`, but a saved storage state from the same IP is more reliable.

## Run once

```bash
npm run check          # headless
npm run check:headed   # watch the browser
```

## Schedule (examples)

**macOS/Linux cron** (daily 09:00 Europe/London — adjust for your TZ):

```cron
0 9 * * * cd /path/to/cycling-blog/web-content-monitor && /usr/bin/npm run check >> data/cron.log 2>&1
```

**Windows Task Scheduler:** run `npm run check` in `web-content-monitor` daily.

## Notes

- Never commits secrets: `.env`, `data/`, and `.auth/` are gitignored.
- Challenge pages are never written into the baseline.
- This is intentionally a small local script — no Cursor cloud tokens required for daily runs.
