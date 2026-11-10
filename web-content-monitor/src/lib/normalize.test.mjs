import assert from "node:assert/strict";
import { diffSnippet, normalizeText } from "./normalize.mjs";
import { isCloudflareChallenge } from "./cloudflare.mjs";

assert.equal(normalizeText("  Hello   World\n"), "hello world");
assert.equal(diffSnippet("a".repeat(10), "b".repeat(10)).before.length, 10);
assert.equal(
  isCloudflareChallenge({
    title: "Just a moment...",
    bodyText: "Checking your browser",
    url: "https://example.com",
  }),
  true,
);
assert.equal(
  isCloudflareChallenge({
    title: "Bayeux Tapestry",
    bodyText: "Exhibition at the British Museum. Privacy policy.",
    url: "https://www.britishmuseum.org/exhibitions/bayeux-tapestry",
  }),
  false,
);

console.log("normalize/cloudflare tests passed");
