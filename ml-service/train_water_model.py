
import os
import json
import warnings
warnings.filterwarnings("ignore")

import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from sklearn.model_selection import train_test_split, StratifiedKFold, cross_val_score
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score, f1_score, precision_score, recall_score,
    roc_auc_score, confusion_matrix, classification_report,
)
import xgboost as xgb
import joblib

# ── Paths ──────────────────────────────────────────────────────────────────────
SCRIPT_DIR   = os.path.dirname(os.path.abspath(__file__))
DATASET_PATH = os.path.join(SCRIPT_DIR, "..", "dataset", "water_quality_8000_1000_outliersx.xlsx")

MODEL_OUT    = os.path.join(SCRIPT_DIR, "water_model.pkl")
SCALER_OUT   = os.path.join(SCRIPT_DIR, "water_scaler.pkl")
FIG_OUT      = os.path.join(SCRIPT_DIR, "water_feature_importance.png")
META_OUT     = os.path.join(SCRIPT_DIR, "water_model_meta.json")

# ── Feature definition (order matters — must match inference) ──────────────────
FEATURES = ["pH", "Hardness", "Solids", "Sulfate", "Chloramines",
            "Conductivity", "Organic_carbon", "Trihalomethanes", "Turbidity"]
TARGET   = "Potability"

# ── 1. Load & clean ────────────────────────────────────────────────────────────
print("=" * 65)
print("   EnviroCheck — Water Quality Model Training")
print("=" * 65)
print(f"\n📂 Loading dataset from:\n   {DATASET_PATH}\n")

df = pd.read_excel(DATASET_PATH)
print(f"   Shape: {df.shape}")
print(f"   Columns: {list(df.columns)}\n")

# Drop metadata columns
to_drop = [c for c in ["Outlier", "District"] if c in df.columns]
if to_drop:
    df.drop(columns=to_drop, inplace=True)
    print(f"   Dropped: {to_drop}")

# Verify required columns exist
missing_cols = [c for c in FEATURES + [TARGET] if c not in df.columns]
if missing_cols:
    raise ValueError(f"Missing required columns: {missing_cols}")

# ── 2. Missing value imputation (mean per feature) ─────────────────────────────
print("\n📊 Missing values before imputation:")
print(df[FEATURES + [TARGET]].isnull().sum().to_string())

for feat in FEATURES:
    df[feat].fillna(df[feat].mean(), inplace=True)

df.dropna(subset=[TARGET], inplace=True)          # drop rows without label
df[TARGET] = df[TARGET].astype(int)

print(f"\n   Final shape after cleaning: {df.shape}")
print(f"   Class distribution:\n{df[TARGET].value_counts().to_string()}")

# ── 3. Split ───────────────────────────────────────────────────────────────────
X = df[FEATURES].values.astype(float)
y = df[TARGET].values

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.20, random_state=42, stratify=y
)
print(f"\n   Train: {X_train.shape[0]}  |  Test: {X_test.shape[0]}")

# ── 4. Scale ───────────────────────────────────────────────────────────────────
scaler = StandardScaler()
X_train_s = scaler.fit_transform(X_train)
X_test_s  = scaler.transform(X_test)

joblib.dump(scaler, SCALER_OUT)
print(f"\n💾 Scaler saved → {SCALER_OUT}")

# ── 5. Train models ────────────────────────────────────────────────────────────
scale_pos   = (y_train == 0).sum() / max((y_train == 1).sum(), 1)

models = {
    "Logistic Regression": LogisticRegression(
        max_iter=1000, random_state=42, class_weight="balanced"
    ),
    "Random Forest": RandomForestClassifier(
        n_estimators=200, max_depth=12, random_state=42,
        class_weight="balanced", n_jobs=-1
    ),
    "XGBoost": xgb.XGBClassifier(
        n_estimators=300, max_depth=6, learning_rate=0.05,
        subsample=0.8, colsample_bytree=0.8,
        scale_pos_weight=scale_pos,
        random_state=42, eval_metric="logloss",
        use_label_encoder=False,
    ),
}

results = {}
print("\n" + "=" * 65)
print("   Model Training Results")
print("=" * 65)

for name, model in models.items():
    print(f"\n🤖 Training: {name}")
    model.fit(X_train_s, y_train)
    y_pred = model.predict(X_test_s)
    y_prob = model.predict_proba(X_test_s)[:, 1]

    acc       = accuracy_score(y_test, y_pred)
    f1        = f1_score(y_test, y_pred)
    precision = precision_score(y_test, y_pred)
    recall    = recall_score(y_test, y_pred)
    roc_auc   = roc_auc_score(y_test, y_prob)

    results[name] = {
        "model":     model,
        "accuracy":  acc,
        "f1":        f1,
        "precision": precision,
        "recall":    recall,
        "roc_auc":   roc_auc,
    }

    print(f"   Accuracy : {acc:.4f}  ({acc*100:.2f}%)")
    print(f"   F1 Score : {f1:.4f}")
    print(f"   Precision: {precision:.4f}")
    print(f"   Recall   : {recall:.4f}")
    print(f"   ROC-AUC  : {roc_auc:.4f}")

# ── 6. Pick best model by F1 ───────────────────────────────────────────────────
best_name = max(results, key=lambda n: results[n]["f1"])
best      = results[best_name]
best_model = best["model"]

print("\n" + "=" * 65)
print(f"   🏆 Best Model: {best_name}")
print(f"      F1 Score : {best['f1']:.4f}")
print(f"      Accuracy : {best['accuracy']:.4f}")
print(f"      ROC-AUC  : {best['roc_auc']:.4f}")
print("=" * 65)

# ── 7. Confusion matrix ────────────────────────────────────────────────────────
y_pred_best = best_model.predict(X_test_s)
cm = confusion_matrix(y_test, y_pred_best)
print("\n📊 Confusion Matrix (best model):")
print(f"   TN={cm[0,0]}  FP={cm[0,1]}")
print(f"   FN={cm[1,0]}  TP={cm[1,1]}")
print("\n" + classification_report(y_test, y_pred_best, target_names=["Not Potable", "Potable"]))

# ── 8. Feature importance plot ─────────────────────────────────────────────────
if hasattr(best_model, "feature_importances_"):
    importances = best_model.feature_importances_
else:
    # Logistic regression: use absolute coefficients
    importances = np.abs(best_model.coef_[0])

sorted_idx = np.argsort(importances)[::-1]
sorted_feats  = [FEATURES[i] for i in sorted_idx]
sorted_import = importances[sorted_idx]

fig, ax = plt.subplots(figsize=(10, 6))
colors = plt.cm.RdYlGn(np.linspace(0.3, 0.9, len(sorted_feats)))
bars = ax.barh(sorted_feats[::-1], sorted_import[::-1], color=colors[::-1], edgecolor="white", linewidth=0.8)
ax.set_xlabel("Importance Score", fontsize=12)
ax.set_title(f"Water Quality Feature Importance\n({best_name})", fontsize=14, fontweight="bold")
ax.grid(axis="x", alpha=0.3)
for bar, val in zip(bars, sorted_import[::-1]):
    ax.text(bar.get_width() + 0.001, bar.get_y() + bar.get_height() / 2,
            f"{val:.4f}", va="center", fontsize=9, color="#333")
plt.tight_layout()
plt.savefig(FIG_OUT, dpi=150, bbox_inches="tight")
plt.close()
print(f"\n📈 Feature importance chart saved → {FIG_OUT}")

# ── 9. Save model & metadata ───────────────────────────────────────────────────
joblib.dump(best_model, MODEL_OUT)
print(f"💾 Best model saved  → {MODEL_OUT}")

meta = {
    "model_name":   best_name,
    "features":     FEATURES,
    "target":       TARGET,
    "accuracy":     round(best["accuracy"], 4),
    "f1_score":     round(best["f1"],       4),
    "precision":    round(best["precision"],4),
    "recall":       round(best["recall"],   4),
    "roc_auc":      round(best["roc_auc"],  4),
    "train_size":   int(X_train.shape[0]),
    "test_size":    int(X_test.shape[0]),
    "all_models": {
        n: {
            "accuracy": round(r["accuracy"], 4),
            "f1":       round(r["f1"],       4),
            "roc_auc":  round(r["roc_auc"],  4),
        }
        for n, r in results.items()
    },
}

with open(META_OUT, "w") as f:
    json.dump(meta, f, indent=2)
print(f"📋 Metadata saved    → {META_OUT}")

print("\n✅ Training complete!\n")
