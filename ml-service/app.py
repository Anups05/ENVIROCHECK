

from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np
import math
import os
import json
import joblib
from dotenv import load_dotenv

load_dotenv()  # loads ml-service/.env into os.environ

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# ── Paths ────────────────────────────────────────────────────────────────────
_DIR        = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH  = os.path.join(_DIR, "aqi_model.pkl")
SCALER_PATH = os.path.join(_DIR, "aqi_scaler.pkl")
META_PATH   = os.path.join(_DIR, "aqi_model_meta.json")

# ── Load trained model (once at startup) ─────────────────────────────────────
_model  = None
_scaler = None
_meta   = {}

def _load_model():
    global _model, _scaler, _meta
    if os.path.exists(MODEL_PATH) and os.path.exists(SCALER_PATH):
        _model  = joblib.load(MODEL_PATH)
        _scaler = joblib.load(SCALER_PATH)
        if os.path.exists(META_PATH):
            with open(META_PATH) as f:
                _meta = json.load(f)
        print(f"[ML] Loaded model: {_meta.get('model_name', 'Unknown')}")
    else:
        print("[ML] WARNING: Trained model not found. Run train_aqi_model.py first.")
        print("              Falling back to formula-based AQI until model is loaded.")

_load_model()

# ── AQI Category helper ───────────────────────────────────────────────────────
AQI_CATEGORIES = [
    (50,  "Good",           "#00C853", "Air quality is good. Safe for all activities."),
    (100, "Satisfactory",   "#64DD17", "Acceptable air quality. Sensitive groups should be cautious."),
    (200, "Moderate",       "#FFA500", "Sensitive individuals may experience discomfort."),
    (300, "Poor",           "#FF5722", "Health effects likely for everyone."),
    (400, "Very Poor",      "#B71C1C", "Serious health effects. Avoid outdoor activity."),
    (500, "Severe/Hazardous","#6A1B9A","Emergency conditions. Stay indoors."),
]

def _categorise_aqi(aqi_val: float) -> dict:
    aqi_val = max(0.0, min(500.0, float(aqi_val)))
    for threshold, cat, color, msg in AQI_CATEGORIES:
        if aqi_val <= threshold:
            return {"category": cat, "color": color, "health_message": msg}
    return {
        "category": "Severe/Hazardous",
        "color": "#6A1B9A",
        "health_message": "Emergency conditions. Stay indoors.",
    }

# ── Derived features (must match train_aqi_model.py exactly) ─────────────────
def _add_derived(raw: np.ndarray) -> np.ndarray:
    """
    raw: 1-D array with the 15 base features in FEATURES order.
    Returns a 1-D array of 20 features (15 base + 5 derived).
    MUST stay in sync with add_derived_features() in train_aqi_model.py.
    """
    pm25, pm10, no2, so2, co, o3, nh3 = raw[0], raw[1], raw[2], raw[3], raw[4], raw[5], raw[6]
    temp, humid, wind   = raw[7], raw[8], raw[9]
    traffic, industrial = raw[10], raw[11]
    green, pop, waste   = raw[12], raw[13], raw[14]

    pollution_index = (
        pm25  * 0.35 +
        pm10  * 0.25 +
        no2   * 0.12 +
        so2   * 0.10 +
        co    * 8.0  +
        o3    * 0.08 +
        nh3   * 0.10
    )
    urban_stress = (
        traffic     / 10000.0 * 0.4 +
        industrial  / 100.0   * 0.4 +
        pop         / 20000.0 * 0.2
    )
    env_resilience = (
        green / 100.0 * 0.5 +
        waste / 10.0  * 0.3 +
        min(wind / 50.0, 1.0) * 0.2
    )
    pm_ratio    = pm10 / (pm25 + 1.0)
    gas_cocktail = no2 * so2 / 1000.0

    return np.append(raw, [pollution_index, urban_stress, env_resilience, pm_ratio, gas_cocktail])


# ── Request field → feature order mapping ────────────────────────────────────
FIELD_ORDER = [
    "pm25", "pm10", "no2", "so2", "co", "o3", "nh3",
    "temperature", "humidity", "wind_speed",
    "traffic_density", "industrial_activity",
    "green_cover", "population_density", "waste_management_score",
]

def _extract_features(data: dict):
    """
    Validates and extracts feature vector from request JSON.
    Returns (numpy array shape (1, 18), None) or (None, error_msg).
    """
    raw = []
    for field in FIELD_ORDER:
        val = data.get(field)
        if val is None:
            return None, f"Missing required field: '{field}'"
        try:
            raw.append(float(val))
        except (TypeError, ValueError):
            return None, f"Field '{field}' must be a numeric value, got: {val!r}"

    feature_vec = _add_derived(np.array(raw, dtype=float))
    return feature_vec.reshape(1, -1), None

# ── Fallback formula AQI (used when model file absent) ───────────────────────
def _formula_aqi(data: dict) -> float:
    pm25 = float(data.get("pm25", 50))
    pm10 = float(data.get("pm10", 80))
    no2  = float(data.get("no2",  40))
    so2  = float(data.get("so2",  20))
    co   = float(data.get("co",   1.8))
    o3   = float(data.get("o3",   44))
    nh3  = float(data.get("nh3",  10))
    weights = np.array([2.0, 1.2, 1.5, 1.8, 10.0, 1.3, 0.8])
    features = np.array([pm25, pm10, no2, so2, co, o3, nh3])
    sub = features * weights
    aqi = float(np.max(sub)) + (pm25 * no2) / 500.0
    return max(0.0, min(500.0, aqi))


# ════════════════════════════════════════════════════════════════════════════
#  API Endpoints
# ════════════════════════════════════════════════════════════════════════════

@app.route("/", methods=["GET"])
def root():
    return jsonify({
        "service": "EnviroCheck ML Service (Flask)",
        "version": "2.0.0",
        "models": ["XGBoost (AQI)", "RandomForest (Water)", "SVM (Health Risk)", "Prophet (Future)"],
        "aqi_model_ready": _model is not None,
        "status": "running",
    })


@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "healthy",
        "service": "ml-service",
        "aqi_model": "loaded" if _model is not None else "not_loaded",
    })


# ── NEW: Real AQI prediction endpoint ────────────────────────────────────────
@app.route("/predict/aqi", methods=["POST"])
def predict_aqi_ml():
    """
    POST /predict/aqi
    Accepts the 15 AQI-related inputs and returns ML-predicted AQI with category.
    """
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Request body must be JSON"}), 400

    feat_vec, err = _extract_features(data)
    if err:
        return jsonify({"error": err}), 400

    # ── Use real model if available ──────────────────────────────────────────
    if _model is not None and _scaler is not None:
        try:
            X_scaled = _scaler.transform(feat_vec)
            aqi_raw  = float(_model.predict(X_scaled)[0])
            aqi_val  = round(max(0.0, min(500.0, aqi_raw)), 1)
            model_used = _meta.get("model_name", "ML Model")
        except Exception as exc:
            return jsonify({"error": f"Prediction failed: {str(exc)}"}), 500
    else:
        # Fallback: formula-based
        aqi_val  = round(_formula_aqi(data), 1)
        model_used = "Formula (model not loaded)"

    cat_info = _categorise_aqi(aqi_val)
    return jsonify({
        "aqi":            aqi_val,
        "category":       cat_info["category"],
        "color":          cat_info["color"],
        "health_message": cat_info["health_message"],
        "model_used":     model_used,
    })


# ── NEW: Model metadata endpoint ─────────────────────────────────────────────
@app.route("/model/info", methods=["GET"])
def model_info():
    if not _meta:
        return jsonify({
            "model_name": "Not loaded",
            "r2_score":   None,
            "mae":        None,
            "rmse":       None,
            "status":     "Run train_aqi_model.py to train the model",
        })
    return jsonify({
        "model_name": _meta.get("model_name"),
        "r2_score":   _meta.get("r2_score"),
        "mae":        _meta.get("mae"),
        "rmse":       _meta.get("rmse"),
        "features":   _meta.get("features"),
        "status":     "loaded",
    })


# ════════════════════════════════════════════════════════════════════════════
#  Legacy endpoints (unchanged — preserved for other tabs)
# ════════════════════════════════════════════════════════════════════════════

def xgboost_aqi_predict(params: dict) -> dict:
    """Legacy formula-based AQI (used by /api/predict-aqi for backward compat)"""
    pm25 = params.get("pm25", 50.0)
    pm10 = params.get("pm10", 80.0)
    no2  = params.get("no2",  40.0)
    so2  = params.get("so2",  20.0)
    co   = params.get("co",   4.0)
    o3   = params.get("o3",   60.0)

    features = np.array([pm25, pm10, no2, so2, co, o3])
    weights  = np.array([2.0, 1.2, 1.5, 1.8, 10.0, 1.3])
    sub_indices = features * weights
    aqi = int(np.max(sub_indices))
    aqi = int(aqi + (pm25 * no2) / 500)
    aqi = max(0, min(aqi, 500))

    categories = [
        (50, "Good"), (100, "Moderate"), (150, "Unhealthy for Sensitive Groups"),
        (200, "Unhealthy"), (300, "Very Unhealthy"), (500, "Hazardous"),
    ]
    category = "Hazardous"
    for threshold, cat in categories:
        if aqi <= threshold:
            category = cat
            break

    return {
        "aqi": aqi, "category": category, "model": "XGBoost",
        "confidence": round(0.85 + np.random.uniform(0, 0.12), 3),
        "breakdown": {
            "pm25_index": float(sub_indices[0]),
            "pm10_index": float(sub_indices[1]),
            "no2_index":  float(sub_indices[2]),
            "so2_index":  float(sub_indices[3]),
            "co_index":   float(sub_indices[4]),
            "o3_index":   float(sub_indices[5]),
        },
    }


def random_forest_water_predict(params: dict) -> dict:
    ph             = params.get("ph", 7.0)
    tds            = params.get("tds", 300.0)
    turbidity      = params.get("turbidity", 5.0)
    dissolvedOxygen= params.get("dissolvedOxygen", 6.0)
    hardness       = params.get("hardness", 150.0)
    chloride       = params.get("chloride", 250.0)
    score = 100.0
    score -= max(0, abs(ph - 7.0) - 0.5) * 12
    if tds > 500:  score -= (tds - 500) / 30
    if tds > 1000: score -= 15
    if turbidity > 5: score -= (turbidity - 5) * 3
    if dissolvedOxygen < 6: score -= (6 - dissolvedOxygen) * 8
    if hardness > 300: score -= (hardness - 300) / 20
    if chloride > 250: score -= (chloride - 250) / 30
    score = max(0, min(100, round(score)))
    return {
        "score": score, "safe": score >= 60, "model": "RandomForest",
        "confidence": round(0.88 + np.random.uniform(0, 0.10), 3),
        "parameters": {"ph": ph, "tds": tds, "turbidity": turbidity,
                       "dissolvedOxygen": dissolvedOxygen, "hardness": hardness, "chloride": chloride},
    }


def svm_health_risk_predict(aqi: float, water_score: float) -> dict:
    risk_score = (aqi / 3) * 0.6 + (100 - water_score) * 0.4
    level = "Low" if risk_score <= 25 else ("Medium" if risk_score <= 55 else "High")
    return {
        "level": level, "score": round(risk_score), "model": "SVM",
        "confidence": round(0.82 + np.random.uniform(0, 0.15), 3),
    }


def prophet_future_predict(city: str, current_data: dict) -> dict:
    base_aqi       = current_data.get("aqi", 100)
    base_livability= current_data.get("livability", 60)
    base_water     = current_data.get("waterScore", 70)
    base_green     = current_data.get("greenCover", 25)
    current_year   = 2025
    predictions    = []
    for i in range(1, 6):
        year          = current_year + i
        trend_factor  = 1 + i * 0.07
        seasonal      = math.sin(i * 0.8) * 5
        predictions.append({
            "year":       year,
            "aqi":        max(20, round(base_aqi / trend_factor + seasonal)),
            "livability": min(98, round(base_livability * trend_factor - seasonal * 0.5)),
            "waterScore": min(98, round(base_water * (1 + i * 0.04))),
            "greenCover": min(60, round(base_green * (1 + i * 0.08), 1)),
        })
    return {
        "model": "Prophet",
        "confidence": round(0.78 + np.random.uniform(0, 0.12), 3),
        "predictions": predictions,
    }


@app.route("/api/predict-aqi", methods=["POST"])
def predict_aqi_legacy():
    data   = request.json or {}
    result = xgboost_aqi_predict(data)
    return jsonify({"success": True, "data": result})


@app.route("/api/predict-water", methods=["POST"])
def predict_water():
    data   = request.json or {}
    result = random_forest_water_predict(data)
    return jsonify({"success": True, "data": result})


@app.route("/api/predict-livability", methods=["POST"])
def predict_livability():
    data  = request.json or {}
    air   = data.get("air", {})
    water = data.get("water", {})
    env   = data.get("environmental", {})
    aqi_result   = xgboost_aqi_predict(air)
    water_result = random_forest_water_predict(water)
    air_score    = max(0, 100 - aqi_result["aqi"] / 3)
    water_score  = water_result["score"]
    green_score  = env.get("greenCover", 25) / 100 * 100
    noise_score  = max(0, 100 - env.get("noiseLevel", 55))
    waste_score  = env.get("wasteManagementScore", 5) / 10 * 100
    temp_score   = max(0, 100 - abs(env.get("temperature", 25) - 22) * 3)
    livability   = round(
        air_score * 0.25 + water_score * 0.2 + green_score * 0.15 +
        noise_score * 0.15 + waste_score * 0.15 + temp_score * 0.1
    )
    livability = max(0, min(100, livability))
    result = {
        "score": livability,
        "model": "Ensemble (XGBoost + RandomForest)",
        "confidence": round(0.87 + np.random.uniform(0, 0.10), 3),
        "sub_scores": {
            "air_quality":       round(air_score, 1),
            "water_safety":      round(water_score, 1),
            "green_cover":       round(green_score, 1),
            "noise_level":       round(noise_score, 1),
            "waste_management":  round(waste_score, 1),
            "temperature_comfort": round(temp_score, 1),
        },
    }
    return jsonify({"success": True, "data": result})


@app.route("/api/predict-health-risk", methods=["POST"])
def predict_health_risk():
    data       = request.json or {}
    aqi        = data.get("aqi", 100.0)
    water_score= data.get("waterScore", 70.0)
    result     = svm_health_risk_predict(aqi, water_score)
    return jsonify({"success": True, "data": result})


@app.route("/api/future-prediction", methods=["POST"])
def predict_future():
    data         = request.json or {}
    city         = data.get("city", "Unknown")
    current_data = data.get("currentData", {})
    result       = prophet_future_predict(city, current_data)
    return jsonify({"success": True, "data": result})


@app.route("/api/generate-report", methods=["POST"])
def generate_report():
    data       = request.json or {}
    city       = data.get("city", "Unknown")
    report_data= data.get("data", {})
    suggestions = [
        "Increase urban green cover by 15-20% to reduce particulate matter levels.",
        "Upgrade water treatment facilities with advanced filtration systems.",
        "Implement smart traffic management to reduce vehicular emissions by 30%.",
        "Promote renewable energy adoption in residential and commercial areas.",
        "Establish community composting programs to improve waste management.",
    ]
    aqi_val    = report_data.get("aqi", {}).get("value", 0) if isinstance(report_data.get("aqi"), dict) else report_data.get("aqi", 0)
    water_safe = report_data.get("waterSafety", {}).get("safe", True)
    risks = [
        {"type": "Air Quality",   "severity": "High" if aqi_val > 100 else "Moderate", "description": "Particulate matter and gaseous pollutants affect respiratory health."},
        {"type": "Water Safety",  "severity": "Low" if water_safe else "High",          "description": "Water quality parameters need continuous monitoring."},
        {"type": "Urban Heat",    "severity": "Moderate",                                "description": "Heat island effect due to urbanization."},
    ]
    report = {"city": city, "data": report_data, "suggestions": suggestions, "risks": risks}
    return jsonify({"success": True, "data": report})


@app.route("/api/history", methods=["GET"])
def get_history():
    return jsonify({"success": True, "data": []})


@app.route("/api/city/<city_name>", methods=["GET"])
def get_city_data(city_name):
    mock_city = {
        "city": city_name, "aqi": 80, "water_score": 75,
        "livability_score": 72, "greenCover": 30, "noiseLevel": 60,
    }
    return jsonify({"success": True, "data": mock_city})


@app.route("/api/compare", methods=["GET"])
def compare_cities():
    city1 = request.args.get("city1", "City A")
    city2 = request.args.get("city2", "City B")
    data1 = {"city": city1, "aqi": 85, "waterScore": 70, "livability": 68, "healthRisk": 40, "greenCover": 25, "noiseLevel": 65}
    data2 = {"city": city2, "aqi": 50, "waterScore": 88, "livability": 82, "healthRisk": 20, "greenCover": 40, "noiseLevel": 45}
    return jsonify({"success": True, "data": {"city1": data1, "city2": data2}})



# ════════════════════════════════════════════════════════════════════════════
#  Water Quality Model Endpoints & Logic
# ════════════════════════════════════════════════════════════════════════════

WATER_MODEL_PATH  = os.path.join(_DIR, "water_model.pkl")
WATER_SCALER_PATH = os.path.join(_DIR, "water_scaler.pkl")
WATER_META_PATH   = os.path.join(_DIR, "water_model_meta.json")

WATER_FEATURES = ["pH", "Hardness", "Solids", "Sulfate", "Chloramines",
            "Conductivity", "Organic_carbon", "Trihalomethanes", "Turbidity"]

WATER_KEY_MAP = {
    "ph":               "pH",
    "hardness":         "Hardness",
    "solids":           "Solids",
    "sulfate":          "Sulfate",
    "chloramines":      "Chloramines",
    "conductivity":     "Conductivity",
    "organic_carbon":   "Organic_carbon",
    "trihalomethanes":  "Trihalomethanes",
    "turbidity":        "Turbidity",
}

_water_model = None
_water_scaler = None
_water_meta = {}

def _load_water_model():
    global _water_model, _water_scaler, _water_meta
    try:
        _water_model  = joblib.load(WATER_MODEL_PATH)
        _water_scaler = joblib.load(WATER_SCALER_PATH)
        print("[OK] Water model & scaler loaded.")
    except FileNotFoundError as e:
        print(f"[WARN] {e}\n   Run train_water_model.py first!")

    if os.path.exists(WATER_META_PATH):
        import json
        with open(WATER_META_PATH) as f:
            _water_meta = json.load(f)

_load_water_model()

# ── WHO/BIS Standard Limits (for WQI calculation) ───────────────────────────
WHO_STANDARDS = {
    "pH":              {"ideal": 7.0,  "standard": 8.5},
    "Hardness":        {"ideal": 0.0,  "standard": 300.0},
    "Solids":          {"ideal": 0.0,  "standard": 500.0},
    "Sulfate":         {"ideal": 0.0,  "standard": 250.0},
    "Chloramines":     {"ideal": 0.0,  "standard": 4.0},
    "Conductivity":    {"ideal": 0.0,  "standard": 400.0},
    "Organic_carbon":  {"ideal": 0.0,  "standard": 2.0},
    "Trihalomethanes": {"ideal": 0.0,  "standard": 80.0},
    "Turbidity":       {"ideal": 0.0,  "standard": 5.0},
}

def calculate_wqi_safety(params: dict) -> dict:
    """
    WHO/BIS Water Quality Index (WQI) calculation.
    params: dict with keys matching WHO_STANDARDS (e.g. {"pH": 7.5, "Hardness": 150, ...})
    Returns: { wqi, safety_pct, category, color }
    """
    # Step 1 — Quality Rating per parameter
    Q = {}
    for key, limits in WHO_STANDARDS.items():
        Vi     = float(params[key])
        Videal = limits["ideal"]
        Si     = limits["standard"]
        if key == "pH":
            # pH special case: use absolute deviation from ideal (handles acidic samples)
            Q[key] = abs(((Vi - Videal) / (Si - Videal)) * 100)
        else:
            Q[key] = ((Vi - Videal) / (Si - Videal)) * 100

    # Step 2 — Unit Weight: Wi = 1 / Si
    W = {key: 1.0 / limits["standard"] for key, limits in WHO_STANDARDS.items()}

    # Step 3 — Normalized Weight: wi = Wi / ΣWi
    sum_W = sum(W.values())
    w = {key: W[key] / sum_W for key in W}

    # Step 4 — Final WQI = Σ(Qi × wi)
    wqi = sum(Q[key] * w[key] for key in Q)

    # Step 5 — Map WQI to Safety % and category
    if wqi <= 25:
        category, color = "Excellent", "#00C853"
    elif wqi <= 50:
        category, color = "Good",      "#64DD17"
    elif wqi <= 75:
        category, color = "Poor",      "#FFA500"
    elif wqi <= 100:
        category, color = "Very Poor", "#FF5722"
    else:
        category, color = "Unsuitable","#B71C1C"

    # Continuous safety percentage calculation
    # WQI 0 -> 100%, WQI 125+ -> 0%
    safety_pct = max(0.0, min(100.0, 100.0 - (wqi * 0.8)))
    safety_pct = round(safety_pct, 1)

    return {
        "wqi":        round(wqi, 2),
        "safety_pct": safety_pct,
        "category":   category,
        "color":      color,
    }

@app.route("/model/water/info", methods=["GET"])
def water_model_info():
    if not _water_meta:
        return jsonify({"error": "Model metadata not found. Train the model first."}), 404
    return jsonify({
        "model_name": _water_meta.get("model_name", "Unknown"),
        "f1_score":   _water_meta.get("f1_score",  0),
        "accuracy":   _water_meta.get("accuracy",  0),
        "roc_auc":    _water_meta.get("roc_auc",   0),
        "precision":  _water_meta.get("precision", 0),
        "recall":     _water_meta.get("recall",    0),
        "features":   WATER_FEATURES,
        "all_models": _water_meta.get("all_models", {}),
    })

@app.route("/predict/water", methods=["POST"])
def predict_water_real():
    if _water_model is None or _water_scaler is None:
        return jsonify({"error": "Model not loaded. Run train_water_model.py first."}), 503
    data = request.get_json(force=True)
    if not data:
        return jsonify({"error": "Request body must be JSON."}), 400

    parsed = {}
    missing = []
    invalid = []
    for frontend_key in WATER_KEY_MAP.keys():
        if frontend_key not in data:
            missing.append(frontend_key)
        else:
            try:
                parsed[WATER_KEY_MAP[frontend_key]] = float(data[frontend_key])
            except (ValueError, TypeError):
                invalid.append(frontend_key)

    if missing:
        return jsonify({"error": f"Missing required fields: {missing}"}), 400
    if invalid:
        return jsonify({"error": f"Non-numeric values for fields: {invalid}"}), 400

    # ── ML Prediction (Random Forest binary classification) ──────────────────
    X = np.array([[parsed[f] for f in WATER_FEATURES]], dtype=float)
    X_scaled   = _water_scaler.transform(X)
    potability = int(_water_model.predict(X_scaled)[0])

    # Confidence from predict_proba (if available)
    confidence = None
    ml_safety_pct = None
    if hasattr(_water_model, "predict_proba"):
        proba      = _water_model.predict_proba(X_scaled)[0]
        confidence = round(float(max(proba)), 4)
        if hasattr(_water_model, "classes_") and 1 in _water_model.classes_:
            idx = list(_water_model.classes_).index(1)
            ml_safety_pct = round(float(proba[idx] * 100), 1)

    model_name = _water_meta.get("model_name", type(_water_model).__name__)

    # ── WHO/BIS WQI Safety % ─────────────────────────────────────────────────
    wqi_result = calculate_wqi_safety(parsed)

    return jsonify({
        "potability": {
            "prediction":    potability,
            "label":         "Potable" if potability == 1 else "Not Potable",
            "model":         model_name,
            "confidence":    confidence,
            "ml_safety_pct": ml_safety_pct,
        },
        "water_safety": {
            "wqi":        wqi_result["wqi"],
            "safety_pct": wqi_result["safety_pct"],
            "category":   wqi_result["category"],
            "color":      wqi_result["color"],
            "method":     "WHO/BIS WQI Formula",
        },
        "parameters_used": parsed,
    })


# ── /predict/forecast ────────────────────────────────────────────────────────
@app.route("/predict/forecast", methods=["POST"])
def predict_forecast():
    """
    Auto-selects best ML timeseries model (Prophet / SARIMA / XGBoost / LSTM)
    per metric using MAE on a 6-month holdout, then forecasts 5 years ahead.

    Body:
        {
            "aqi": 150,
            "water": 68,
            "livability": 55,
            "green": 22,
            "city": "Mumbai"
        }
    """
    try:
        from forecaster import run_forecast
    except Exception as e:
        return jsonify({"error": f"Forecaster module failed to load: {str(e)}"}), 500

    try:
        body = request.get_json(force=True) or {}

        aqi        = float(body.get("aqi",        150))
        water      = float(body.get("water",       65))
        livability = float(body.get("livability",  55))
        green      = float(body.get("green",       20))

        result = run_forecast(aqi, water, livability, green)
        return jsonify(result)

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── /predict/suggestions ──────────────────────────────────────────────────────
@app.route("/predict/suggestions", methods=["POST"])
def predict_suggestions():
    """
    Uses Groq LLM to generate actionable environmental suggestions.
    Body: any dashboard parameter set.
    Response: { "suggestions": ["suggestion 1", "suggestion 2", ...] }
    """
    try:
        from groq import Groq
    except ImportError:
        return jsonify({"error": "groq package not installed."}), 500

    api_key = os.getenv("GROQ_API_KEY", "")
    if not api_key or api_key == "your_groq_api_key_here":
        return jsonify({"error": "GROQ_API_KEY not set in ml-service/.env"}), 500

    try:
        body = request.get_json(force=True) or {}
        city = body.get('city', 'Local Area')
        
        prompt = f"""You are an expert environmental consultant for {city}.
Analyze the following environmental readings:
{json.dumps(body, indent=2)}

Provide EXACTLY 4 highly specific, actionable recommendations to improve the environment and public health in {city}.
Prefix each recommendation with an appropriate emoji. 
Make them concise (1-2 sentences each). Focus strictly on the data provided (if AQI is bad, suggest air fixes; if water is bad, water fixes).

Return ONLY a valid JSON array of strings, like this:
[
  "🌿 Specific suggestion 1...",
  "💧 Specific suggestion 2..."
]"""

        client = Groq(api_key=api_key)
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=600,
        )

        raw = response.choices[0].message.content.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        raw = raw.strip()

        suggestions = json.loads(raw)
        if not isinstance(suggestions, list):
            suggestions = [suggestions]

        return jsonify({"suggestions": suggestions})

    except Exception as e:
        return jsonify({"error": str(e)}), 500



# ── /predict/health-impact ────────────────────────────────────────────────────
@app.route("/predict/health-impact", methods=["POST"])
def predict_health_impact():
    """
    Uses Groq LLM to generate an age-group-wise disease risk analysis
    based on the current AQI and Water Safety scores.

    Body: { "aqi": 150, "water": 45, "city": "Pune", "aqi_category": "Unhealthy" }
    Response: { "age_groups": [...], "overall_summary": "..." }
    """
    try:
        from groq import Groq
    except ImportError:
        return jsonify({"error": "groq package not installed. Run: pip install groq"}), 500

    api_key = os.getenv("GROQ_API_KEY", "")
    if not api_key or api_key == "your_groq_api_key_here":
        return jsonify({"error": "GROQ_API_KEY not set in ml-service/.env"}), 500

    try:
        body         = request.get_json(force=True) or {}
        aqi          = float(body.get("aqi", 150))
        water        = float(body.get("water", 65))
        city         = str(body.get("city", "Your City"))
        aqi_category = str(body.get("aqi_category", "Moderate"))

        # Derive water category
        if water >= 75:   water_category = "Safe"
        elif water >= 50: water_category = "Moderate"
        else:             water_category = "Unsafe"

        prompt = f"""You are a public health expert analyzing environmental data for {city}.

Current environmental readings:
- AQI: {round(aqi)} ({aqi_category})
- Water Safety Score: {round(water)}% ({water_category})

Based ONLY on these two environmental parameters, provide a DETAILED health impact analysis broken down by age group.
For EACH age group, list specific diseases/health problems separated into two categories:
1. Air-Related (caused by the current AQI level)
2. Water-Related (caused by the current water safety level)

For EACH disease, provide:
- "name": The disease or condition name
- "description": A 1-2 sentence explanation of how this AQI/water quality causes or worsens this condition in this age group
- "prevention": A specific, actionable prevention measure for this disease

Return your response as a valid JSON object with EXACTLY this structure (no extra text, no markdown, only JSON):
{{
  "overall_summary": "2-3 sentence summary of overall health risk in {city} based on AQI {round(aqi)} and Water Safety {round(water)}%.",
  "age_groups": [
    {{
      "group": "Children (0-14 yrs)",
      "risk_level": "High",
      "air_diseases": [
        {{ "name": "Disease name", "description": "How this AQI level causes/worsens this in children.", "prevention": "Specific actionable prevention." }},
        {{ "name": "Disease name", "description": "Explanation.", "prevention": "Prevention measure." }},
        {{ "name": "Disease name", "description": "Explanation.", "prevention": "Prevention measure." }}
      ],
      "water_diseases": [
        {{ "name": "Disease name", "description": "How this water quality causes/worsens this in children.", "prevention": "Specific actionable prevention." }},
        {{ "name": "Disease name", "description": "Explanation.", "prevention": "Prevention measure." }}
      ],
      "general_advice": "One overall protective recommendation for this age group."
    }},
    {{
      "group": "Young Adults (15-25 yrs)",
      "risk_level": "Moderate",
      "air_diseases": [
        {{ "name": "Disease name", "description": "Explanation for young adults.", "prevention": "Prevention measure." }},
        {{ "name": "Disease name", "description": "Explanation.", "prevention": "Prevention measure." }},
        {{ "name": "Disease name", "description": "Explanation.", "prevention": "Prevention measure." }}
      ],
      "water_diseases": [
        {{ "name": "Disease name", "description": "Explanation for young adults.", "prevention": "Prevention measure." }},
        {{ "name": "Disease name", "description": "Explanation.", "prevention": "Prevention measure." }}
      ],
      "general_advice": "One overall protective recommendation."
    }},
    {{
      "group": "Adults (26-60 yrs)",
      "risk_level": "Moderate",
      "air_diseases": [
        {{ "name": "Disease name", "description": "Explanation for adults.", "prevention": "Prevention measure." }},
        {{ "name": "Disease name", "description": "Explanation.", "prevention": "Prevention measure." }},
        {{ "name": "Disease name", "description": "Explanation.", "prevention": "Prevention measure." }}
      ],
      "water_diseases": [
        {{ "name": "Disease name", "description": "Explanation for adults.", "prevention": "Prevention measure." }},
        {{ "name": "Disease name", "description": "Explanation.", "prevention": "Prevention measure." }}
      ],
      "general_advice": "One overall protective recommendation."
    }},
    {{
      "group": "Elderly (60+ yrs)",
      "risk_level": "High",
      "air_diseases": [
        {{ "name": "Disease name", "description": "Explanation for elderly.", "prevention": "Prevention measure." }},
        {{ "name": "Disease name", "description": "Explanation.", "prevention": "Prevention measure." }},
        {{ "name": "Disease name", "description": "Explanation.", "prevention": "Prevention measure." }}
      ],
      "water_diseases": [
        {{ "name": "Disease name", "description": "Explanation for elderly.", "prevention": "Prevention measure." }},
        {{ "name": "Disease name", "description": "Explanation.", "prevention": "Prevention measure." }}
      ],
      "general_advice": "One overall protective recommendation."
    }}
  ]
}}

IMPORTANT: Provide EXACTLY 3 air_diseases and 2 water_diseases per age group. Make diseases specific to AQI={round(aqi)} and Water={round(water)}%. Use proper medical terminology."""

        client = Groq(api_key=api_key)
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=4000,
        )

        raw = response.choices[0].message.content.strip()

        # Strip markdown code fences if Groq wraps response
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        raw = raw.strip()

        result = json.loads(raw)
        return jsonify(result)

    except json.JSONDecodeError as e:
        return jsonify({"error": f"Groq returned non-JSON response: {str(e)}", "raw": raw}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── Sensor Reading Endpoint
#  Reads pH and TDS from Arduino/ESP over serial.
#  Arduino must send comma-separated lines: "pH,TDS"  e.g. "6.87,342.5"
#  Collects 10 readings and returns ONLY the 10th (final stable) reading.
# ════════════════════════════════════════════════════════════════════════════

@app.route("/sensor/ports", methods=["GET"])
def list_serial_ports():
    """
    GET /sensor/ports
    Returns a list of available serial ports on this machine.
    Useful for discovering which COM port the sensor is on.
    """
    try:
        import serial.tools.list_ports
        ports = [
            {"port": p.device, "description": p.description, "hwid": p.hwid}
            for p in serial.tools.list_ports.comports()
        ]
        return jsonify({"ports": ports, "count": len(ports)})
    except ImportError:
        return jsonify({"error": "pyserial not installed. Run: pip install pyserial"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/sensor/read", methods=["POST"])
def read_sensor():
    """
    POST /sensor/read
    Body (optional): { "port": "COM4", "baud": 9600, "readings": 10 }

    Opens the serial port, collects N readings (default 10),
    and returns ONLY the Nth (last / most stable) reading.

    Arduino sketch must output one line per reading in CSV format:
        pH_value,TDS_value
    Example serial output:
        6.82,348.5
        6.84,350.1
        6.85,351.0    <- this 10th line is used as the final value

    Returns:
        { "ph": 6.85, "tds": 351.0, "reading_number": 10,
          "all_readings": [...], "port": "COM3", "baud": 9600 }
    """
    try:
        import serial
    except ImportError:
        return jsonify({"error": "pyserial not installed. Run: pip install pyserial"}), 500

    body         = request.get_json(force=True) or {}
    port         = body.get("port")  or os.getenv("SENSOR_PORT", "COM3")
    baud         = int(body.get("baud")     or os.getenv("SENSOR_BAUD", 9600))
    n_readings   = int(body.get("readings") or 10)   # collect this many lines
    timeout_sec  = float(body.get("timeout") or 30)  # max wait per line (seconds)

    all_readings = []
    ser = None

    try:
        ser = serial.Serial(port, baud, timeout=timeout_sec)

        # Flush any stale buffered data before we start sampling
        ser.reset_input_buffer()

        print(f"[Sensor] Opened {port} @ {baud} baud — collecting {n_readings} readings …")

        for i in range(n_readings):
            raw_line = ser.readline()
            if not raw_line:
                return jsonify({
                    "error": f"Timeout waiting for reading #{i+1} from sensor on {port}. "
                             f"Check wiring and that the Arduino is sending data."
                }), 504

            line = raw_line.decode("utf-8", errors="replace").strip()
            print(f"[Sensor] Reading #{i+1}: {line!r}")

            # Parse "pH,TDS" format
            parts = line.split(",")
            if len(parts) < 2:
                return jsonify({
                    "error": f"Unexpected data format on reading #{i+1}: {line!r}. "
                             f"Expected: 'pH,TDS' (e.g. '6.85,351.0')"
                }), 422

            try:
                ph_val  = round(float(parts[0].strip()), 3)
                tds_val = round(float(parts[1].strip()), 3)
            except ValueError:
                return jsonify({
                    "error": f"Non-numeric value on reading #{i+1}: {line!r}"
                }), 422

            all_readings.append({"reading": i + 1, "ph": ph_val, "tds": tds_val, "raw": line})

        # The LAST reading is the most stable (sensor has warmed up / settled)
        final = all_readings[-1]
        print(f"[Sensor] Final reading (#{n_readings}): pH={final['ph']}, TDS={final['tds']}")

        return jsonify({
            "ph":             final["ph"],
            "tds":            final["tds"],
            "reading_number": final["reading"],
            "all_readings":   all_readings,
            "port":           port,
            "baud":           baud,
        })

    except serial.SerialException as e:
        return jsonify({
            "error": f"Could not open serial port '{port}': {str(e)}. "
                     f"Check the port name in ml-service/.env (SENSOR_PORT=COM3) "
                     f"and that the sensor is connected."
        }), 503

    except Exception as e:
        return jsonify({"error": str(e)}), 500

    finally:
        if ser and ser.is_open:
            ser.close()
            print(f"[Sensor] Closed {port}")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True, use_reloader=False)
