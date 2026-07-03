

import numpy as np
import warnings
warnings.filterwarnings("ignore")

# ── Optional imports ──────────────────────────────────────────────────────────
try:
    from prophet import Prophet
    import cmdstanpy, subprocess, os
    _stan_path = cmdstanpy.cmdstan_path()
    # Actually test the CmdStan binary — it may be installed but broken
    # (e.g. DLL load failure on Windows due to missing AVX / VC++ runtime)
    _stanc = os.path.join(_stan_path, "bin", "stanc.exe" if os.name == "nt" else "stanc")
    if not os.path.isfile(_stanc):
        _stanc = os.path.join(_stan_path, "bin", "stanc")
    _proc = subprocess.run([_stanc, "--version"], capture_output=True, timeout=10)
    if _proc.returncode != 0:
        raise RuntimeError(f"CmdStan binary test failed (exit {_proc.returncode})")
    HAS_PROPHET = True
except Exception as _e:
    HAS_PROPHET = False
    print(f"[Forecaster] Prophet/CmdStan unavailable: {_e}")

try:
    from statsmodels.tsa.statespace.sarimax import SARIMAX
    HAS_SARIMA = True
except ImportError:
    HAS_SARIMA = False

try:
    import xgboost as xgb
    HAS_XGB = True
except ImportError:
    HAS_XGB = False

try:
    import tensorflow as tf
    from tensorflow import keras
    # Quick sanity check that TF backend is functional
    tf.constant([1.0])
    HAS_LSTM = True
except Exception as _e:
    HAS_LSTM = False
    print(f"[Forecaster] TensorFlow/LSTM unavailable: {_e}")

from sklearn.metrics import mean_absolute_error
from sklearn.preprocessing import MinMaxScaler

# Trend+Fourier is always available (pure NumPy)
HAS_TREND_FOURIER = True



# ─────────────────────────────────────────────────────────────────────────────
# 1. SYNTHETIC HISTORY GENERATOR
#    Creates a plausible 48-month history anchored to the current snapshot.
# ─────────────────────────────────────────────────────────────────────────────
def generate_synthetic_history(aqi, water, livability, green, n_months=48, seed=42):
    """
    Given a single current reading, interpolate a realistic 48-month history.

    AQI:        Seasonal sine wave + slow upward drift (urban pollution trend)
                + Gaussian noise.
    Water:      Relatively stable around current value + small seasonal variation.
    Livability: Inversely mirrors AQI seasonal pattern.
    Green:      Very slow drift (afforestation / deforestation).

    Returns a list of dicts: [{"month_idx": 0, "aqi": ..., ...}, ...]
    """
    rng = np.random.default_rng(seed)
    months = np.arange(n_months)  # 0 = 48 months ago, n_months-1 = current

    # ── AQI ──────────────────────────────────────────────────────────────────
    # Seasonal: peaks in May-Jun (month 4-5 of year), dips Dec-Jan
    seasonal_aqi = 15 * np.sin(2 * np.pi * (months % 12) / 12 - np.pi / 2)
    # Backward trend: current reading is the latest point; add slight past-is-lower drift
    drift_aqi    = -0.3 * (n_months - 1 - months)  # linearly lower in the past
    noise_aqi    = rng.normal(0, 5, n_months)
    aqi_series   = np.clip(aqi + drift_aqi + seasonal_aqi + noise_aqi, 10, 500)

    # ── Water Safety ─────────────────────────────────────────────────────────
    seasonal_water = 3 * np.sin(2 * np.pi * (months % 12) / 12)
    drift_water    = 0.1 * (n_months - 1 - months)
    noise_water    = rng.normal(0, 2, n_months)
    water_series   = np.clip(water + drift_water + seasonal_water + noise_water, 0, 100)

    # ── Livability ────────────────────────────────────────────────────────────
    # Inversely correlated with AQI swing
    liv_series   = np.clip(livability - 0.4 * (aqi_series - aqi), 10, 100)
    noise_liv    = rng.normal(0, 2, n_months)
    liv_series  += noise_liv

    # ── Green Cover ──────────────────────────────────────────────────────────
    drift_green  = 0.05 * (n_months - 1 - months)
    noise_green  = rng.normal(0, 0.5, n_months)
    green_series = np.clip(green + drift_green + noise_green, 0, 100)

    history = []
    for i in range(n_months):
        history.append({
            "month_idx":  int(i),
            "aqi":        round(float(aqi_series[i]), 2),
            "water":      round(float(water_series[i]), 2),
            "livability": round(float(liv_series[i]), 2),
            "green":      round(float(green_series[i]), 2),
        })
    return history


# ─────────────────────────────────────────────────────────────────────────────
# 2. INDIVIDUAL MODEL TRAINERS
# ─────────────────────────────────────────────────────────────────────────────

def _prophet_forecast(train_series, horizon):
    """Train Prophet and forecast `horizon` steps ahead."""
    import pandas as pd
    from prophet import Prophet
    df = pd.DataFrame({"ds": pd.date_range("2021-01-01", periods=len(train_series), freq="MS"),
                        "y": train_series})
    # Try Newton (default) first; fall back to L-BFGS-B if optimizer fails
    for algo in ["newton", "lbfgs"]:
        try:
            m = Prophet(yearly_seasonality=True, weekly_seasonality=False, daily_seasonality=False,
                        seasonality_mode="additive", changepoint_prior_scale=0.1)
            m.fit(df, algorithm=algo)
            future = m.make_future_dataframe(periods=horizon, freq="MS")
            forecast = m.predict(future)
            return forecast["yhat"].values[-horizon:]
        except Exception:
            continue
    raise RuntimeError("Prophet failed with both Newton and L-BFGS-B optimizers")


def _sarima_forecast(train_series, horizon):
    """Train SARIMA(1,1,1)(1,1,1,12); falls back to ARIMA(2,1,2) with short series."""
    # Try seasonal SARIMA first
    for order, seas in [((1,1,1),(1,1,1,12)), ((1,1,1),(0,0,0,0)), ((2,1,2),(0,0,0,0))]:
        try:
            if seas[3] == 0:
                model = SARIMAX(train_series, order=order,
                                enforce_stationarity=False, enforce_invertibility=False)
            else:
                model = SARIMAX(train_series, order=order, seasonal_order=seas,
                                enforce_stationarity=False, enforce_invertibility=False)
            result = model.fit(disp=False, maxiter=200)
            fc = result.forecast(horizon)
            return np.array(fc)
        except Exception:
            continue
    raise RuntimeError("SARIMA/ARIMA failed all fallbacks")


def _xgb_lag_forecast(train_series, horizon, n_lags=12):
    """
    XGBoost regressor using lag features [t-1 … t-n_lags] + month index.
    Recursive multi-step forecasting.
    """
    series = np.array(train_series)
    X, y = [], []
    for i in range(n_lags, len(series)):
        X.append(list(series[i - n_lags:i]) + [i % 12])
        y.append(series[i])
    X, y = np.array(X), np.array(y)

    model = xgb.XGBRegressor(n_estimators=200, max_depth=4, learning_rate=0.05,
                              subsample=0.8, random_state=42, verbosity=0)
    model.fit(X, y)

    # Recursive forecast
    history = list(series)
    preds   = []
    for step in range(horizon):
        row = history[-n_lags:] + [(len(history)) % 12]
        p   = model.predict(np.array([row]))[0]
        preds.append(p)
        history.append(p)
    return np.array(preds)


def _lstm_forecast(train_series, horizon, window=12, epochs=80, seed=0):
    """Simple 2-layer stacked LSTM with MinMax scaling. Recursive forecast."""
    tf.random.set_seed(seed)
    scaler = MinMaxScaler()
    series = scaler.fit_transform(np.array(train_series).reshape(-1, 1)).flatten()

    X, y = [], []
    for i in range(window, len(series)):
        X.append(series[i - window:i])
        y.append(series[i])
    X = np.array(X).reshape(-1, window, 1)
    y = np.array(y)

    model = keras.Sequential([
        keras.layers.LSTM(64, input_shape=(window, 1), return_sequences=True),
        keras.layers.LSTM(32),
        keras.layers.Dense(1),
    ])
    model.compile(optimizer="adam", loss="mse")
    model.fit(X, y, epochs=epochs, batch_size=8, verbose=0)

    history = list(series)
    preds   = []
    for _ in range(horizon):
        row = np.array(history[-window:]).reshape(1, window, 1)
        p   = model.predict(row, verbose=0)[0, 0]
        preds.append(p)
        history.append(p)

    preds_inv = scaler.inverse_transform(np.array(preds).reshape(-1, 1)).flatten()
    return preds_inv


def _trend_fourier_forecast(train_series, horizon):
    """
    Trend + Fourier Seasonality Decomposition (pure NumPy, no external deps).
    Fits: y(t) = a*t + b + Σ [Ak*sin(2πkt/12) + Bk*cos(2πkt/12)] for k=1..3
    Robust, deterministic, faster than LSTM, and accurate for seasonal environmental data.
    """
    train = np.array(train_series, dtype=float)
    n     = len(train)
    t_idx = np.arange(n, dtype=float)

    # Feature matrix: [trend, bias, sin/cos harmonics k=1,2,3]
    cols = [t_idx, np.ones(n)]
    for k in range(1, 4):
        cols.append(np.sin(2 * np.pi * k * t_idx / 12))
        cols.append(np.cos(2 * np.pi * k * t_idx / 12))
    X = np.column_stack(cols)  # shape (n, 8)

    # Ordinary least squares
    coeffs, _, _, _ = np.linalg.lstsq(X, train, rcond=None)

    # Forecast future time steps
    t_future = np.arange(n, n + horizon, dtype=float)
    cols_f   = [t_future, np.ones(horizon)]
    for k in range(1, 4):
        cols_f.append(np.sin(2 * np.pi * k * t_future / 12))
        cols_f.append(np.cos(2 * np.pi * k * t_future / 12))
    X_f = np.column_stack(cols_f)
    return X_f @ coeffs


# ─────────────────────────────────────────────────────────────────────────────
# 3. COMPETITION ENGINE
# ─────────────────────────────────────────────────────────────────────────────

def _compete_models(series, val_size=6, horizon=60):
    """
    Split series → train/val, train each available model, pick the best by MAE.
    Returns: (best_model_name, mae_scores_dict, future_forecast_array)
    """
    full   = np.array(series, dtype=float)
    train  = full[:-val_size]
    val    = full[-val_size:]

    results    = {}
    forecasts  = {}

    # Prophet
    if HAS_PROPHET:
        try:
            pred = _prophet_forecast(train, val_size)
            results["Prophet"] = round(float(mean_absolute_error(val, pred)), 3)
            # Full forecast for future
            full_pred = _prophet_forecast(full, horizon)
            forecasts["Prophet"] = full_pred
        except Exception as e:
            results["Prophet"] = {"error": str(e)}

    # SARIMA
    if HAS_SARIMA:
        try:
            pred = _sarima_forecast(train, val_size)
            results["SARIMA"] = round(float(mean_absolute_error(val, pred)), 3)
            full_pred = _sarima_forecast(full, horizon)
            forecasts["SARIMA"] = full_pred
        except Exception as e:
            results["SARIMA"] = {"error": str(e)}

    # XGBoost
    if HAS_XGB:
        try:
            pred = _xgb_lag_forecast(train, val_size)
            results["XGBoost"] = round(float(mean_absolute_error(val, pred)), 3)
            full_pred = _xgb_lag_forecast(full, horizon)
            forecasts["XGBoost"] = full_pred
        except Exception as e:
            results["XGBoost"] = {"error": str(e)}

    # LSTM
    if HAS_LSTM:
        try:
            pred = _lstm_forecast(train, val_size)
            results["LSTM"] = round(float(mean_absolute_error(val, pred)), 3)
            full_pred = _lstm_forecast(full, horizon)
            forecasts["LSTM"] = full_pred
        except Exception as e:
            results["LSTM"] = {"error": str(e)}

    # Trend + Fourier Decomposition (always available)
    if HAS_TREND_FOURIER:
        try:
            pred = _trend_fourier_forecast(train, val_size)
            results["Trend+Fourier"] = round(float(mean_absolute_error(val, pred)), 3)
            full_pred = _trend_fourier_forecast(full, horizon)
            forecasts["Trend+Fourier"] = full_pred
        except Exception as e:
            results["Trend+Fourier"] = {"error": str(e)}

    # Pick winner — lowest numeric MAE
    valid_results = {k: v for k, v in results.items() if isinstance(v, float)}
    if not valid_results:
        # All models failed → fallback linear extrapolation
        slope = float(full[-1] - full[-12]) / 12 if len(full) >= 12 else 0
        fallback = full[-1] + slope * np.arange(1, horizon + 1)
        return "Fallback (Linear)", results, fallback

    best_model = min(valid_results, key=valid_results.get)
    return best_model, results, forecasts[best_model]


# ─────────────────────────────────────────────────────────────────────────────
# 4. MAIN PUBLIC FUNCTION
# ─────────────────────────────────────────────────────────────────────────────

def run_forecast(aqi, water, livability, green, horizon_months=60, n_history=48):
    """
    Full pipeline:
      1. Generate synthetic history (n_history months)
      2. Compete 4 models per metric
      3. Aggregate monthly forecasts to yearly (next 5 years)
      4. Return structured result dict

    Returns:
    {
        "best_models":        { "aqi": "XGBoost", "water": "Prophet", ... },
        "mae_scores":         { "aqi": { "Prophet": 4.2, "XGBoost": 3.1, ... }, ...},
        "available_models":   ["Prophet", "SARIMA", "XGBoost", "LSTM"],
        "skipped_models":     [],
        "predictions":        [{ "year": 2026, "aqi": 142, "water": 68, "livability": 57, "green": 21 }, ...],
        "synthetic_history":  [{ "month_idx": 0, "aqi": ..., ... }, ...]
    }
    """
    history = generate_synthetic_history(aqi, water, livability, green, n_months=n_history)

    aqi_ser  = [h["aqi"] for h in history]
    wat_ser  = [h["water"] for h in history]
    liv_ser  = [h["livability"] for h in history]
    grn_ser  = [h["green"] for h in history]

    # Compete per metric
    best_aqi,  mae_aqi,  fc_aqi  = _compete_models(aqi_ser,  horizon=horizon_months)
    best_wat,  mae_wat,  fc_wat  = _compete_models(wat_ser,  horizon=horizon_months)
    best_liv,  mae_liv,  fc_liv  = _compete_models(liv_ser,  horizon=horizon_months)
    best_grn,  mae_grn,  fc_grn  = _compete_models(grn_ser,  horizon=horizon_months)

    # Aggregate monthly predictions → 5 yearly snapshots
    # horizon_months = 60 → 5 years × 12 months
    def yearly(fc_arr):
        arr = np.array(fc_arr)
        out = []
        for yr in range(5):
            chunk = arr[yr * 12:(yr + 1) * 12]
            out.append(float(np.mean(chunk)))
        return out

    aqi_yearly  = yearly(fc_aqi)
    wat_yearly  = yearly(fc_wat)
    liv_yearly  = yearly(fc_liv)
    grn_yearly  = yearly(fc_grn)

    predictions = []
    for i in range(5):
        predictions.append({
            "year":       2025 + i + 1,
            "aqi":        round(max(10, aqi_yearly[i]), 1),
            "water":      round(min(100, max(0, wat_yearly[i])), 1),
            "livability": round(min(100, max(10, liv_yearly[i])), 1),
            "green":      round(min(100, max(0, grn_yearly[i])), 1),
        })

    available = []
    skipped   = []
    for name, flag in [("Prophet", HAS_PROPHET), ("SARIMA", HAS_SARIMA), ("XGBoost", HAS_XGB), ("LSTM", HAS_LSTM), ("Trend+Fourier", HAS_TREND_FOURIER)]:
        (available if flag else skipped).append(name)

    return {
        "best_models":       {"aqi": best_aqi, "water": best_wat, "livability": best_liv, "green": best_grn},
        "mae_scores":        {"aqi": mae_aqi,  "water": mae_wat,  "livability": mae_liv,  "green": mae_grn},
        "available_models":  available,
        "skipped_models":    skipped,
        "predictions":       predictions,
        "synthetic_history": history,
    }
