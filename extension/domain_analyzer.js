/**
 * domain_analyzer.js
 * Rule-based domain/URL heuristics for phishing detection.
 * Returns a risk score 0-100 plus the list of triggered signals (for explainability
 * in the popup — showing *why* a site was flagged is important for a demo).
 */

// A small set of frequently-impersonated brands. Extend this list for your project.
const PROTECTED_BRANDS = [
  "paypal", "amazon", "microsoft", "apple", "google", "facebook",
  "instagram", "netflix", "chase", "bankofamerica", "wellsfargo",
  "ebay", "linkedin", "dhl", "fedex", "irs", "outlook", "office365",
];

// TLDs commonly abused in phishing campaigns (illustrative, not exhaustive).
const SUSPICIOUS_TLDS = [
  "zip", "mov", "xyz", "top", "gq", "tk", "ml", "cf", "ga", "work", "click",
];

// Cheap Levenshtein distance for typosquatting checks.
function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[a.length][b.length];
}

// Detect mixed-script homoglyph tricks (e.g. Cyrillic "а" instead of Latin "a").
function hasMixedScript(domain) {
  const hasLatin = /[a-z]/i.test(domain);
  const hasCyrillic = /[\u0400-\u04FF]/.test(domain);
  const hasGreek = /[\u0370-\u03FF]/.test(domain);
  return hasLatin && (hasCyrillic || hasGreek);
}

function getRegistrableLabel(hostname) {
  // crude "second-level domain" extraction; fine for a demo, not a full public-suffix parser
  const parts = hostname.split(".");
  if (parts.length < 2) return hostname;
  return parts[parts.length - 2];
}

function analyzeDomain(urlString) {
  const signals = [];
  let score = 0;
  let url;
  try {
    url = new URL(urlString);
  } catch (e) {
    return { score: 0, signals: ["Could not parse URL"], hostname: null };
  }

  const hostname = url.hostname.toLowerCase();
  const label = getRegistrableLabel(hostname);

  // 1. Not HTTPS
  if (url.protocol !== "https:") {
    score += 15;
    signals.push("Connection is not HTTPS");
  }

  // 2. IP address instead of domain name
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
    score += 25;
    signals.push("URL uses a raw IP address instead of a domain name");
  }

  // 3. "@" in URL (classic redirect trick: real-site.com@evil.com)
  if (urlString.includes("@")) {
    score += 20;
    signals.push('URL contains "@", which can be used to disguise the real destination');
  }

  // 4. Excessive subdomains
  const subdomainCount = hostname.split(".").length - 2;
  if (subdomainCount >= 3) {
    score += 10;
    signals.push(`Unusually many subdomains (${subdomainCount})`);
  }

  // 5. Excessive hyphens (common in generated phishing domains)
  const hyphenCount = (label.match(/-/g) || []).length;
  if (hyphenCount >= 2) {
    score += 10;
    signals.push(`Domain label has many hyphens ("${label}")`);
  }

  // 6. Suspicious TLD
  const tld = hostname.split(".").pop();
  if (SUSPICIOUS_TLDS.includes(tld)) {
    score += 10;
    signals.push(`Uses a TLD often associated with abuse (.${tld})`);
  }

  // 7. Mixed-script homoglyph attack
  if (hasMixedScript(hostname)) {
    score += 30;
    signals.push("Domain mixes character sets (possible homoglyph/IDN spoofing)");
  }

  // 8. Typosquatting against protected brands
  let closestBrand = null;
  let closestDistance = Infinity;
  for (const brand of PROTECTED_BRANDS) {
    if (label === brand) continue; // exact match, not typosquatting
    const distance = levenshtein(label, brand);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestBrand = brand;
    }
    // brand name appears as a substring but isn't the actual domain, e.g. paypal-secure-login
    if (label.includes(brand) && label !== brand) {
      score += 25;
      signals.push(`Domain contains brand name "${brand}" but is not the official domain`);
    }
  }
  if (closestBrand && closestDistance > 0 && closestDistance <= 2 && label.length > 3) {
    score += 30;
    signals.push(`Domain "${label}" is very similar to "${closestBrand}" (edit distance ${closestDistance}) — possible typosquat`);
  }

  // 9. Long, high-entropy-looking domain label (rough heuristic)
  if (label.length > 20) {
    score += 10;
    signals.push("Unusually long domain label");
  }

  score = Math.min(100, score);
  return { score, signals, hostname };
}

if (typeof module !== "undefined") {
  module.exports = { analyzeDomain };
}
