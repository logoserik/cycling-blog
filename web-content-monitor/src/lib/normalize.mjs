/**
 * Normalize visible page text for stable hashing.
 * Ignores letter case and collapses whitespace.
 */
export function normalizeText(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Short, readable before/after snippet for Slack.
 */
export function diffSnippet(before, after, max = 280) {
  const a = before || "(empty)";
  const b = after || "(empty)";
  const clip = (s) => (s.length > max ? `${s.slice(0, max)}…` : s);
  return { before: clip(a), after: clip(b) };
}
