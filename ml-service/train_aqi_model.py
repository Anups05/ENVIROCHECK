"""
EnviroCheck — AQI Model Training Script
========================================
Trains XGBoost and Random Forest regressors on air_quality_india_7000.csv.
Uses permutation importance + SHAP for interpretability.
Saves the best model as aqi_model.pkl and the scaler as aqi_scaler.pkl.
"""

import os
import sys
import warnings
import json
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")          # non-interactive backend for servers
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches

from sklearn.ensemble import RandomForestRegressor
from sklearn.inspection import permutation_importance
from sklearn.metrics import r2_score, mean_absolute_error, mean_squared_error
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LinearRegression
from xgboost import XGBRegressor
import joblib

try:
    import shap
    SHAP_AVAILABLE = True
except ImportError:
    SHAP_AVAILABLE = False
    warnings.warn("shap not installed — SHAP plots will be skipped.")

# ── Paths ────────────────────────────────────────────────────────────────────
SCRIPT_DIR   = os.path.dirname(os.path.abspath(__file__))
DATASET_DIR  = os.path.join(SCRIPT_DIR, "..", "dataset")
CSV_PATH     = os.path.join(DATASET_DIR, "air_quality_india_7000.csv")
MODEL_PATH   = os.path.join(SCRIPT_DIR, "aqi_model.pkl")
SCALER_PATH  = os.path.join(SCRIPT_DIR, "aqi_scaler.pkl")
META_PATH    = os.path.join(SCRIPT_DIR, "aqi_model_meta.json")
FI_PNG       = os.path.join(SCRIPT_DIR, "feature_importance.png")

# ── Feature configuration ────────────────────────────────────────────────────
FEATURES = [
    "PM2.5 (µg/m³)",
    "PM10 (µg/m³)",
    "NO₂ (µg/m³)",
    "SO₂ (µg/m³)",
    "CO (mg/m³)",
    "O₃ (µg/m³)",
    "NH₃ (µg/m³)",
    "Temperature (°C)",
    "Humidity (%)",
    "Wind Speed (km/h)",
    "Traffic Density (veh/hr)",
    "Industrial Activity (0-100)",
    "Green Cover (%)",
    "Population Density (per km²)",
    "Waste Management Score (0-10)",
]

TARGET   = "AQI"
DROP_COLS = ["Outlier", "Season", "City"]       # ignore metadata columns


# ────────────────────────────────────────────────────────────────────────────
def load_data(csv_path: str) -> pd.DataFrame:
    print(f"\n📂  Loading dataset from: {csv_path}")
    if not os.path.exists(csv_path):
        sys.exit(f"[ERROR] Dataset not found at {csv_path}")
    df = pd.read_csv(csv_path)
    print(f"    Rows: {len(df):,} | Columns: {df.shape[1]}")
    return df


def clean_data(df: pd.DataFrame) -> pd.DataFrame:
    # Drop metadata / irrelevant columns
    to_drop = [c for c in DROP_COLS if c in df.columns]
    df = df.drop(columns=to_drop)
    print(f"    Dropped columns: {to_drop}")

    # Fill missing numerics with column mean
    missing_before = df[FEATURES + [TARGET]].isnull().sum().sum()
    for col in FEATURES + [TARGET]:
        if col in df.columns:
            df[col] = df[col].fillna(df[col].mean())
    missing_after = df[FEATURES + [TARGET]].isnull().sum().sum()
    print(f"    Missing values: {missing_before} → {missing_after} (mean-imputed)")

    return df


def add_derived_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Create interaction / derived features to distribute signal across features.
    These mirror what is computed at inference time in app.py.
    """
    # Raw-scale pollution composite — preserves linear signal the model needs
    df["_pollution_index"] = (
        df["PM2.5 (µg/m³)"]  * 0.35 +
        df["PM10 (µg/m³)"]   * 0.25 +
        df["NO₂ (µg/m³)"]    * 0.12 +
        df["SO₂ (µg/m³)"]    * 0.10 +
        df["CO (mg/m³)"]      * 8.0  +   # CO in mg/m³ is small, scale up
        df["O₃ (µg/m³)"]     * 0.08 +
        df["NH₃ (µg/m³)"]    * 0.10
    )
    # Urban stress index
    df["_urban_stress"] = (
        df["Traffic Density (veh/hr)"]     / 10000.0 * 0.4 +
        df["Industrial Activity (0-100)"]  / 100.0   * 0.4 +
        df["Population Density (per km²)"] / 20000.0 * 0.2
    )
    # Environmental resilience (higher = cleaner air)
    df["_env_resilience"] = (
        df["Green Cover (%)"]              / 100.0 * 0.5 +
        df["Waste Management Score (0-10)"]/ 10.0  * 0.3 +
        (df["Wind Speed (km/h)"] / 50.0).clip(0, 1) * 0.2
    )
    # PM ratio — captures when PM10 vs PM2.5 diverge (coarse vs fine particles)
    df["_pm_ratio"] = df["PM10 (µg/m³)"] / (df["PM2.5 (µg/m³)"] + 1.0)
    # Gaseous cocktail (NO2 * SO2 interaction)
    df["_gas_cocktail"] = df["NO₂ (µg/m³)"] * df["SO₂ (µg/m³)"] / 1000.0
    return df


DERIVED_FEATURE_NAMES = [
    "_pollution_index", "_urban_stress", "_env_resilience",
    "_pm_ratio", "_gas_cocktail",
]
ALL_FEATURES = FEATURES + DERIVED_FEATURE_NAMES


def build_feature_matrix(df: pd.DataFrame):
    missing = [f for f in FEATURES if f not in df.columns]
    if missing:
        sys.exit(f"[ERROR] Missing expected columns in CSV:\n  {missing}")

    df = add_derived_features(df)
    X = df[ALL_FEATURES].values.astype(float)
    y = df[TARGET].values.astype(float)
    return X, y


# ────────────────────────────────────────────────────────────────────────────
def train_models(X_train, y_train, X_test, y_test):
    results = {}

    # ── XGBoost ──────────────────────────────────────────────────────────────
    print("\n🚀  Training XGBoost Regressor …")
    xgb = XGBRegressor(
        n_estimators=400,
        max_depth=5,                   # constrained to avoid PM2.5 dominance
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.7,          # feature subsampling per tree
        colsample_bylevel=0.8,
        reg_alpha=0.1,
        reg_lambda=1.5,
        min_child_weight=5,
        random_state=42,
        n_jobs=-1,
        verbosity=0,
    )
    xgb.fit(X_train, y_train)
    xgb_pred = xgb.predict(X_test)
    xgb_r2   = r2_score(y_test, xgb_pred)
    xgb_mae  = mean_absolute_error(y_test, xgb_pred)
    xgb_rmse = np.sqrt(mean_squared_error(y_test, xgb_pred))
    results["XGBoost"] = dict(model=xgb, r2=xgb_r2, mae=xgb_mae, rmse=xgb_rmse, preds=xgb_pred)
    print(f"    R²={xgb_r2:.4f}  MAE={xgb_mae:.2f}  RMSE={xgb_rmse:.2f}")

    # ── Random Forest ─────────────────────────────────────────────────────────
    print("\n🌲  Training Random Forest Regressor …")
    rf = RandomForestRegressor(
        n_estimators=300,
        max_depth=10,                  # constrained
        max_features=0.6,              # feature subsampling
        min_samples_leaf=4,
        min_samples_split=8,
        random_state=42,
        n_jobs=-1,
    )
    rf.fit(X_train, y_train)
    rf_pred  = rf.predict(X_test)
    rf_r2    = r2_score(y_test, rf_pred)
    rf_mae   = mean_absolute_error(y_test, rf_pred)
    rf_rmse  = np.sqrt(mean_squared_error(y_test, rf_pred))
    results["RandomForest"] = dict(model=rf, r2=rf_r2, mae=rf_mae, rmse=rf_rmse, preds=rf_pred)
    print(f"    R²={rf_r2:.4f}  MAE={rf_mae:.2f}  RMSE={rf_rmse:.2f}")

    # ── Linear Regression ─────────────────────────────────────────────────────
    print("\n📈  Training Linear Regression …")
    lr = LinearRegression()
    lr.fit(X_train, y_train)
    lr_pred = lr.predict(X_test)
    lr_r2   = r2_score(y_test, lr_pred)
    lr_mae  = mean_absolute_error(y_test, lr_pred)
    lr_rmse = np.sqrt(mean_squared_error(y_test, lr_pred))
    results["LinearRegression"] = dict(model=lr, r2=lr_r2, mae=lr_mae, rmse=lr_rmse, preds=lr_pred)
    print(f"    R²={lr_r2:.4f}  MAE={lr_mae:.2f}  RMSE={lr_rmse:.2f}")

    return results


# ────────────────────────────────────────────────────────────────────────────
def plot_feature_importance(best_name, best_model, X_test, y_test):
    """
    Uses permutation importance so all features get a fair contribution score.
    """
    print("\n📊  Computing permutation importance …")
    perm = permutation_importance(
        best_model, X_test, y_test,
        n_repeats=15, random_state=42, n_jobs=-1
    )

    means = perm.importances_mean
    stds  = perm.importances_std

    # Friendly display names
    display_names = [
        "PM2.5", "PM10", "NO₂", "SO₂", "CO", "O₃", "NH₃",
        "Temperature", "Humidity", "Wind Speed",
        "Traffic Density", "Ind. Activity",
        "Green Cover", "Pop. Density", "Waste Mgmt",
        "Pollution Index", "Urban Stress", "Env. Resilience",
        "PM Ratio", "Gas Cocktail",
    ]

    sorted_idx = np.argsort(means)[::-1]          # descending

    palette = plt.cm.get_cmap("RdYlGn_r")
    colors  = [palette(i / len(sorted_idx)) for i in range(len(sorted_idx))]

    fig, ax = plt.subplots(figsize=(12, 8))
    bars = ax.bar(
        range(len(sorted_idx)),
        means[sorted_idx],
        yerr=stds[sorted_idx],
        color=colors,
        alpha=0.87,
        edgecolor="white",
        linewidth=0.5,
        capsize=3,
        error_kw={"elinewidth": 1, "ecolor": "grey"},
    )

    ax.set_xticks(range(len(sorted_idx)))
    ax.set_xticklabels(
        [display_names[i] for i in sorted_idx],
        rotation=40, ha="right", fontsize=9
    )
    ax.set_ylabel("Mean Permutation Importance (R² drop)", fontsize=11)
    ax.set_title(
        f"Feature Importance — {best_name} (Permutation Method)",
        fontsize=13, fontweight="bold", pad=14
    )
    ax.spines[["top", "right"]].set_visible(False)
    ax.grid(axis="y", linestyle="--", alpha=0.4)

    fig.tight_layout()
    fig.savefig(FI_PNG, dpi=150, bbox_inches="tight")
    plt.close(fig)
    print(f"    Saved → {FI_PNG}")

    # ── SHAP (if available) ───────────────────────────────────────────────────
    if SHAP_AVAILABLE:
        print("    Computing SHAP values …")
        shap_png = os.path.join(SCRIPT_DIR, "shap_summary.png")
        try:
            if best_name == "XGBoost":
                explainer = shap.TreeExplainer(best_model)
                shap_vals = explainer.shap_values(X_test[:500])
            else:
                explainer = shap.TreeExplainer(best_model)
                shap_vals = explainer.shap_values(X_test[:200])

            fig_shap, ax_shap = plt.subplots(figsize=(10, 7))
            shap.summary_plot(
                shap_vals, X_test[:len(shap_vals)],
                feature_names=display_names,
                show=False,
                plot_size=(10, 7),
            )
            plt.tight_layout()
            plt.savefig(shap_png, dpi=150, bbox_inches="tight")
            plt.close("all")
            print(f"    SHAP saved → {shap_png}")
        except Exception as exc:
            print(f"    [WARN] SHAP plots failed: {exc}")


# ────────────────────────────────────────────────────────────────────────────
def main():
    print("=" * 60)
    print("  EnviroCheck — AQI Model Training")
    print("=" * 60)

    df = load_data(CSV_PATH)
    df = clean_data(df)
    X, y = build_feature_matrix(df)

    print(f"\n🔀  Train/test split  80 / 20  (seed=42)")
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    # Scale
    scaler  = StandardScaler()
    X_train = scaler.fit_transform(X_train)
    X_test  = scaler.transform(X_test)

    results = train_models(X_train, y_train, X_test, y_test)

    # ── Select best ──────────────────────────────────────────────────────────
    best_name  = max(results, key=lambda k: results[k]["r2"])
    best_entry = results[best_name]
    best_model = best_entry["model"]

    print(f"\n🏆  Best model: {best_name}  (R²={best_entry['r2']:.4f})")

    # ── Save artefacts ───────────────────────────────────────────────────────
    joblib.dump(best_model, MODEL_PATH)
    joblib.dump(scaler,     SCALER_PATH)

    meta = {
        "model_name"   : best_name,
        "r2_score"     : round(best_entry["r2"],   4),
        "mae"          : round(best_entry["mae"],   4),
        "rmse"         : round(best_entry["rmse"],  4),
        "features"     : FEATURES,              # only the 15 user-input features
        "derived"      : DERIVED_FEATURE_NAMES,  # internal derived features
        "all_features" : ALL_FEATURES,           # combined (order matters!)
    }
    with open(META_PATH, "w") as f:
        json.dump(meta, f, indent=2)

    print(f"    aqi_model.pkl   → {MODEL_PATH}")
    print(f"    aqi_scaler.pkl  → {SCALER_PATH}")
    print(f"    aqi_model_meta.json → {META_PATH}")

    plot_feature_importance(best_name, best_model, X_test, y_test)

    # ── Summary table ────────────────────────────────────────────────────────
    print("\n" + "=" * 50)
    print(f"{'Model':<18} {'R²':>8} {'MAE':>8} {'RMSE':>8}")
    print("-" * 50)
    for name, res in results.items():
        marker = " ✅ BEST" if name == best_name else ""
        print(f"{name:<18} {res['r2']:>8.4f} {res['mae']:>8.2f} {res['rmse']:>8.2f}{marker}")
    print("=" * 50)
    print("\n✅  Training complete!\n")


if __name__ == "__main__":
    main()
