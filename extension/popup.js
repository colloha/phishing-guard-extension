function colorForScore(score) {
  if (score >= 75) return "var(--danger)";
  if (score >= 50) return "var(--warn)";
  return "var(--safe)";
}

function labelForScore(score) {
  if (score >= 75) return "High risk";
  if (score >= 50) return "Some risk signals";
  return "Looks OK";
}

function render(result) {
  const el = document.getElementById("content");

  if (!result) {
    el.innerHTML = `<div class="empty">No analysis yet for this tab. Try reloading the page.</div>`;
    return;
  }

  const color = colorForScore(result.combinedScore);
  const label = labelForScore(result.combinedScore);

  const signalsHtml = result.signals.length
    ? `<ul>${result.signals.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ul>`
    : `<p style="font-size:12px;color:var(--muted)">No specific warning signs found.</p>`;

  el.innerHTML = `
    <div class="score-block">
      <div class="score-ring" style="border-color:${color}; color:${color}">${result.combinedScore}</div>
      <div>
        <div class="score-label" style="color:${color}">${label}</div>
        <div class="score-sub">${escapeHtml(result.hostname || "")}</div>
      </div>
    </div>
    <div class="breakdown">
      <span>Domain: ${result.domainScore}/100</span>
      <span>Content: ${result.nlpScore}/100</span>
    </div>
    <div class="signals">
      <h2>Signals detected</h2>
      ${signalsHtml}
    </div>
  `;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

chrome.runtime.sendMessage({ type: "GET_ANALYSIS_FOR_ACTIVE_TAB" }, (result) => {
  render(result);
});
