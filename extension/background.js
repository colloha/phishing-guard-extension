/**
 * background.js
 * MV3 service worker. Keeps the latest analysis result per tab in memory
 * so the popup can display it on demand.
 */

const resultsByTab = new Map();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "PHISHING_ANALYSIS_RESULT" && sender.tab) {
    resultsByTab.set(sender.tab.id, message.payload);
  }
  if (message.type === "GET_ANALYSIS_FOR_ACTIVE_TAB") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      const result = tab ? resultsByTab.get(tab.id) : null;
      sendResponse(result || null);
    });
    return true; // keep the message channel open for the async sendResponse
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  resultsByTab.delete(tabId);
});
