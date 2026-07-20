# Phishing Guard — Student Security Project

A Chrome (Manifest V3) browser extension that scores web pages for phishing
risk in real time, using two independent signals:

1. **Domain analysis** (`extension/domain_analyzer.js`) — rule-based checks:
   typosquatting distance to a brand list, homoglyph/mixed-script detection,
   suspicious TLDs, raw-IP URLs, `@` redirects, excessive hyphens/subdomains.
2. **Lightweight NLP model** (`training/train_model.py` → `extension/nlp_scorer.js`) —
   TF-IDF + logistic regression trained on page/email text, exported to a
   16KB JSON file and run with plain JS (dot product + sigmoid). No ML
   runtime needed in the browser.

The two scores are combined (60% domain / 40% content) into a single 0–100
risk rating. Above 50 it shows a dismissible in-page banner; the popup shows
the full breakdown and the specific signals that were triggered — this
explainability is worth keeping for a demo, since "here's *why* it's
flagged" is more convincing than a bare number.

## Project layout

```
phishing-detector/
├── extension/              # Load this folder as an unpacked extension
│   ├── manifest.json
│   ├── background.js       # keeps latest result per tab for the popup
│   ├── content.js          # runs on every page, combines both scores
│   ├── domain_analyzer.js  # rule-based URL/domain heuristics
│   ├── nlp_scorer.js       # TF-IDF + logistic regression inference
│   ├── model/nlp_model.json
│   ├── popup.html / popup.js
│   └── icons/
├── training/
│   ├── generate_dataset.py # builds training/dataset.csv
│   ├── train_model.py      # trains + exports model/nlp_model.json
│   └── dataset.csv
└── model/nlp_model.json    # canonical copy of the trained model
```

## Loading the extension

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** → select the `extension/` folder
4. Visit any page — click the extension icon to see the risk breakdown

## Retraining the model

```bash
cd training
python3 generate_dataset.py   # regenerate dataset.csv (or replace with real data)
python3 train_model.py        # trains, prints metrics, writes model/nlp_model.json
cp ../model/nlp_model.json ../extension/model/nlp_model.json
```

## ⚠️ Honest limitations — read before quoting numbers in your report

- **The training data is synthetic**, built from ~24 templates with brand
  names swapped in (`training/generate_dataset.py`). The model hits 100%
  accuracy on its own held-out set because the templates are trivially
  separable — that number says nothing about real-world performance and
  **should not be quoted as a real detection rate.**
- To make a legitimate accuracy claim (e.g. for a demo or report), retrain
  on a real labeled corpus — for example the **Nazario phishing email
  corpus** for the positive class and a subset of the **Enron email
  dataset** for the negative class, or scraped page text from **PhishTank**
  URLs. Then report the metrics `train_model.py` prints (accuracy,
  precision, recall, F1, confusion matrix) — those are real once the data is.
- **Domain analyzer typosquat detection** compares the *whole* registrable
  label against known brands with edit distance ≤2. It catches things like
  `paypa1.com`, but misses brand names embedded in longer labels like
  `paypal-account-verify.com` unless the brand-substring check (a separate,
  cruder rule) fires. A stronger version would use a sliding-window edit
  distance or a proper public-suffix-list parser.
- **No real domain-age/WHOIS check** is included — that needs a paid or
  rate-limited API and can't run client-side without a backend. It's a
  natural "Phase 2" addition if you want to extend this.
- This is explicitly a **defensive, informational tool** — it warns and
  explains, it doesn't claim to "block 98.7% of attack vectors" or any
  other specific figure. Any accuracy claim in a report or demo should come
  from your own measured evaluation, not be assumed.

## Possible next steps for your CTEM roadmap

- Swap in a real dataset and re-measure precision/recall (false positives
  matter a lot here — warning on legitimate sites erodes trust fast).
- Add a small allowlist/denylist cache (`chrome.storage`) so repeat visits
  to a confirmed-safe site skip re-scoring.
- Log flagged domains locally to build your own "observed phishing attempts"
  dataset over time — useful evidence for a demo.
- Add a background check against a public blocklist API (e.g. Google Safe
  Browsing) as a third signal, since heuristic scores alone will have blind
  spots against brand-new domains with clean-looking text.
