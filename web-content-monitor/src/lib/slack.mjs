/**
 * Post a plain-text message via Slack Incoming Webhook.
 * No-ops with a console warning if SLACK_WEBHOOK_URL is unset (useful for dry runs).
 */
export async function sendSlack(webhookUrl, text) {
  if (!webhookUrl) {
    console.warn("[slack] SLACK_WEBHOOK_URL not set — message not sent:");
    console.warn(text);
    return { ok: false, skipped: true };
  }

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Slack webhook failed (${res.status}): ${body}`);
  }

  return { ok: true };
}
