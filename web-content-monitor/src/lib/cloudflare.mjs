const CHALLENGE_PATTERNS = [
  /just a moment/i,
  /checking your browser/i,
  /attention required/i,
  /cf-browser-verification/i,
  /challenge-platform/i,
  /enable javascript and cookies to continue/i,
  /sorry, you have been blocked/i,
  /cloudflare/i,
];

/**
 * Detect Cloudflare challenge / block pages from title + body text.
 * Challenge HTML must never be stored as a content baseline.
 */
export function isCloudflareChallenge({ title = "", bodyText = "", url = "" }) {
  const haystack = `${title}\n${bodyText}\n${url}`;
  const strongSignals = [
    /just a moment/i.test(title),
    /attention required/i.test(title),
    /cf-browser-verification/i.test(bodyText),
    /challenge-platform/i.test(bodyText),
    /cdn-cgi\/challenge/i.test(url),
  ];
  if (strongSignals.some(Boolean)) return true;

  // "cloudflare" alone in footer copy is not enough; require another phrase.
  const hits = CHALLENGE_PATTERNS.filter((re) => re.test(haystack)).length;
  return hits >= 2;
}
