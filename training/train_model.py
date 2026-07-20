"""
Trains a lightweight phishing-text classifier: TF-IDF features + Logistic Regression.
Exports the vocabulary, IDF weights, and model coefficients as a single JSON file
so the browser extension can run inference in pure JavaScript (no ML runtime needed).
"""
import json
import re
import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, confusion_matrix

DATA_PATH = "dataset.csv"
OUT_PATH =  "../model/nlp_model.json" 

df = pd.read_csv(DATA_PATH)
X_train, X_test, y_train, y_test = train_test_split(
    df["text"], df["label"], test_size=0.2, random_state=42, stratify=df["label"]
)

vectorizer = TfidfVectorizer(
    max_features=300,
    ngram_range=(1, 2),
    lowercase=True,
    stop_words="english",
)
X_train_vec = vectorizer.fit_transform(X_train)
X_test_vec = vectorizer.transform(X_test)

clf = LogisticRegression(max_iter=1000, C=1.0)
clf.fit(X_train_vec, y_train)

y_pred = clf.predict(X_test_vec)
acc = accuracy_score(y_test, y_pred)
prec = precision_score(y_test, y_pred)
rec = recall_score(y_test, y_pred)
f1 = f1_score(y_test, y_pred)
cm = confusion_matrix(y_test, y_pred)

print("=== Evaluation on held-out test set (synthetic data) ===")
print(f"Accuracy:  {acc:.3f}")
print(f"Precision: {prec:.3f}")
print(f"Recall:    {rec:.3f}")
print(f"F1:        {f1:.3f}")
print("Confusion matrix [[TN FP][FN TP]]:")
print(cm)
print("\nNOTE: these numbers are on synthetic template data — real-world")
print("performance on live phishing pages will differ. Re-train on a real")
print("labeled dataset before quoting any accuracy figure in your report.")

# --- Export vocab + idf + coefficients for JS inference ---
vocab = vectorizer.vocabulary_  # term -> index
idf = vectorizer.idf_.tolist()  # index-aligned
coef = clf.coef_[0].tolist()    # index-aligned, same order as tfidf features
intercept = float(clf.intercept_[0])

# invert vocab to index -> term list, sorted by index, for compactness/clarity
sorted_terms = sorted(vocab.items(), key=lambda kv: kv[1])
terms = [t for t, _ in sorted_terms]

export = {
    "terms": terms,             # feature index -> term (unigram or bigram string)
    "idf": idf,                 # feature index -> idf weight
    "coef": coef,                # feature index -> logistic regression weight
    "intercept": intercept,
    "ngram_max": 2,
    "note": "TF-IDF (sublinear=False, l2-normalized) + logistic regression. "
            "Trained on synthetic template data — retrain on real data before production use.",
    "metrics_on_synthetic_holdout": {
        "accuracy": round(acc, 4),
        "precision": round(prec, 4),
        "recall": round(rec, 4),
        "f1": round(f1, 4),
    },
}

with open(OUT_PATH, "w") as f:
    json.dump(export, f)

print(f"\nExported model to {OUT_PATH} ({len(terms)} features)")
