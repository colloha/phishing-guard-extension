/**
 * content.js
 * Runs on every page. Combines domain heuristics + NLP text score into a
 * single risk rating, reports it to the background worker (for the popup),
 * and shows an in-page banner if risk is high.
 */

// --- TRUSTED ALLOWLIST ---
const TRUSTED_DOMAINS = [
  "f5.com",
  "github.com",
  "google.com",
  "microsoft.com",
  "clouddocs.f5.com"
];

const RISK_THRESHOLD_WARN = 50;   // show a soft banner
const RISK_THRESHOLD_BLOCK = 75;  // show a full-page interstitial

const DOMAIN_WEIGHT = 0.4;
const NLP_WEIGHT = 0.6;

function extractPageText() {
  // Keep it cheap: visible body text, truncated. Real projects might also
  // pull meta description, page title, and specifically the text of any
  // <form> the user is about to submit data into.
  const text = document.body ? document.body.innerText || "" : "";
  return text.slice(0, 5000);
}

function hasCredentialForm() {
  const passwordFields = document.querySelectorAll('input[type="password"]');
  return passwordFields.length > 0;
}

function buildBanner(result) {
  const banner = document.createElement("div");
  banner.id = "__phishing_guard_banner__";
  banner.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; z-index: 2147483647;
    background: ${result.combinedScore >= RISK_THRESHOLD_BLOCK ? "#7f1d1d" : "#92400e"};
    color: #fff; font-family: system-ui, sans-serif; font-size: 14px;
    padding: 10px 16px; display: flex; align-items: center; justify-content: space-between;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  `;

  const label = result.combinedScore >= RISK_THRESHOLD_BLOCK
    ? "⚠ High phishing risk detected on this page"
    : "⚠ This page shows some phishing warning signs";

  banner.innerHTML = `
    <span><strong>${label}</strong> — risk score ${result.combinedScore}/100 (student project, informational only)</span>
  `;

  const dismiss = document.createElement("button");
  dismiss.textContent = "Dismiss";
  dismiss.style.cssText = "margin-left: 12px; background: rgba(255,255,255,0.2); border: none; color: #fff; padding: 4px 10px; border-radius: 4px; cursor: pointer;";
  dismiss.onclick = () => banner.remove();
  banner.appendChild(dismiss);

  return banner;
}

async function run() {
  const currentHostname = window.location.hostname;

  // 1. Check Allowlist First
  const isTrusted = TRUSTED_DOMAINS.some(trusted => 
    currentHostname === trusted || currentHostname.endsWith("." + trusted)
  );

  if (isTrusted) {
    console.log(`[Phishing Guard] ${currentHostname} is explicitly trusted. Skipping analysis.`);
    chrome.runtime.sendMessage({
      type: "PHISHING_ANALYSIS_RESULT",
      payload: {
        url: window.location.href,
        hostname: currentHostname,
        domainScore: 0,
        nlpScore: 0,
        combinedScore: 0,
        signals: ["Domain is explicitly trusted (Allowlist)"],
        timestamp: Date.now(),
      }
    });
    return; // Exit early, skipping NLP and Domain scoring
  }

  // 2. Standard Scoring (Runs only if NOT on allowlist)
  const domainResult = analyzeDomain(window.location.href);

  let nlpResult = { score: 0, probability: 0 };
  try {
    const modelUrl = chrome.runtime.getURL("model/nlp_model.json");
    const model = await loadModel(modelUrl);
    const pageText = extractPageText();
    nlpResult = scoreText(pageText, model);
  } catch (e) {
    console.warn("[Phishing Guard] NLP scoring failed:", e);
  }

  let combinedScore = Math.round(
    domainResult.score * DOMAIN_WEIGHT + nlpResult.score * NLP_WEIGHT
  );

  const signals = [...domainResult.signals];
  if (hasCredentialForm()) {
    signals.push("Page contains a password input field");
    // A credential form on an already-suspicious domain is a stronger signal
    if (domainResult.score >= 30) {
      combinedScore = Math.min(100, combinedScore + 10);
      signals.push("Credential form present on a domain with existing risk signals");
    }
  }
  if (nlpResult.score >= 60) {
    signals.push(`Page text resembles known phishing language patterns (${nlpResult.score}/100)`);
  }

  const result = {
    url: window.location.href,
    hostname: domainResult.hostname,
    domainScore: domainResult.score,
    nlpScore: nlpResult.score,
    combinedScore,
    signals,
    timestamp: Date.now(),
  };

  chrome.runtime.sendMessage({ type: "PHISHING_ANALYSIS_RESULT", payload: result });

  if (combinedScore >= RISK_THRESHOLD_WARN && !document.getElementById("__phishing_guard_banner__")) {
    const banner = buildBanner(result);
    document.documentElement.appendChild(banner);
  }
}

run();