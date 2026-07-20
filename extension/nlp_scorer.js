/**
 * nlp_scorer.js
 * Pure-JS inference for the TF-IDF + logistic regression model trained in
 * training/train_model.py. No ML runtime dependency — just a dot product
 * and a sigmoid, so it's fast enough to run on every page load.
 */

let MODEL = null; // loaded lazily via loadModel()

async function loadModel(modelUrl) {
  if (MODEL) return MODEL;
  const res = await fetch(modelUrl);
  MODEL = await res.json();
  // Build term -> feature index map once, for fast lookup
  MODEL.termIndex = {};
  MODEL.terms.forEach((t, i) => (MODEL.termIndex[t] = i));
  return MODEL;
}

function tokenize(text, ngramMax = 2) {
  const cleaned = text.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
  const words = cleaned.split(/\s+/).filter(Boolean);
  const tokens = [...words];
  for (let n = 2; n <= ngramMax; n++) {
    for (let i = 0; i + n <= words.length; i++) {
      tokens.push(words.slice(i, i + n).join(" "));
    }
  }
  return tokens;
}

function sigmoid(x) {
  return 1 / (1 + Math.exp(-x));
}

/**
 * Scores a block of page text. Returns { score: 0-100, probability: 0-1 }
 */
function scoreText(text, model) {
  if (!text || !text.trim()) return { score: 0, probability: 0 };

  const tokens = tokenize(text, model.ngram_max);
  const counts = {};
  for (const t of tokens) {
    if (model.termIndex[t] !== undefined) {
      counts[t] = (counts[t] || 0) + 1;
    }
  }

  // Build raw TF-IDF vector (only for matched terms — everything else is 0)
  const rawValues = {};
  let sumSquares = 0;
  for (const term in counts) {
    const idx = model.termIndex[term];
    const tf = counts[term];
    const val = tf * model.idf[idx];
    rawValues[idx] = val;
    sumSquares += val * val;
  }
  const norm = Math.sqrt(sumSquares) || 1; // l2 normalization, matches sklearn default

  // Dot product with logistic regression coefficients
  let z = model.intercept;
  for (const idxStr in rawValues) {
    const idx = Number(idxStr);
    const normalizedVal = rawValues[idx] / norm;
    z += normalizedVal * model.coef[idx];
  }

  const probability = sigmoid(z);
  return { score: Math.round(probability * 100), probability };
}

if (typeof module !== "undefined") {
  module.exports = { loadModel, scoreText, tokenize };
}
