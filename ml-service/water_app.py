
import os
import json
import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib

# ── App setup ──────────────────────────────────────────────────────────────────
app = Flask(__name__)
CORS(app)

SCRIPT_DIR  = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH  = os.path.join(SCRIPT_DIR, "water_model.pkl")
SCALER_PATH = os.path.join(SCRIPT_DIR, "water_scaler.pkl")
META_PATH   = os.path.join(SCRIPT_DIR, "water_model_meta.json")

# ── Feature order — MUST match training ───────────────────────────────────────
FEATURES = ["pH", "Hardness", "Solids", "Sulfate", "Chloramines",
            "Conductivity", "Organic_carbon", "Trihalomethanes", "Turbidity"]

# Frontend sends lowercase snake_case keys; map them to training feature names
KEY_MAP = {
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

# ── Load model & scaler at startup ────────────────────────────────────────────
model       = None
scaler      = None
model_meta  = {}

def load_artifacts():
    global model, scaler, model_meta
    try:
        model  = joblib.load(MODEL_PATH)
        scaler = joblib.load(SCALER_PATH)
        print("✅ Water model & scaler loaded.")
    except FileNotFoundError as e:
        print(f"⚠️  {e}\n   Run train_water_model.py first!")

    if os.path.exists(META_PATH):
        with open(META_PATH) as f:
            model_meta = json.load(f)

load_artifacts()


# ── WHO-based scoring function ─────────────────────────────────────────────────
def score_parameters(values: dict) -> dict:
    """
    Returns per-parameter sub-scores (0–10) based on WHO safe ranges.
    All scores are floats.
    """
    scores = {}

    # pH: ideal 6.5–8.5, score 0 if <4 or >11
    ph = values["pH"]
    if 6.5 <= ph <= 8.5:
        scores["ph"] = 10.0
    elif ph < 4 or ph > 11:
        scores["ph"] = 0.0
    elif ph < 6.5:
        scores["ph"] = max(0.0, 10.0 * (ph - 4) / (6.5 - 4))
    else:  # >8.5
        scores["ph"] = max(0.0, 10.0 * (11 - ph) / (11 - 8.5))

    # Hardness: ideal 60–200, score 10 in range, scale down outside
    h = values["Hardness"]
    if 60 <= h <= 200:
        scores["hardness"] = 10.0
    elif h < 60:
        scores["hardness"] = max(0.0, 10.0 * h / 60)
    else:  # >200
        scores["hardness"] = max(0.0, 10.0 * (400 - h) / 200)

    # Solids/TDS: ideal <500, score 0 if >1000
    s = values["Solids"]
    if s < 500:
        scores["solids"] = 10.0
    elif s >= 1000:
        scores["solids"] = 0.0
    else:
        scores["solids"] = 10.0 * (1000 - s) / 500

    # Sulfate: ideal <250, score 0 if >500
    sf = values["Sulfate"]
    if sf < 250:
        scores["sulfate"] = 10.0
    elif sf >= 500:
        scores["sulfate"] = 0.0
    else:
        scores["sulfate"] = 10.0 * (500 - sf) / 250

    # Chloramines: ideal <4, scale to 8, score 0 if >8
    cl = values["Chloramines"]
    if cl < 4:
        scores["chloramines"] = 10.0
    elif cl >= 8:
        scores["chloramines"] = 0.0
    else:
        scores["chloramines"] = 10.0 * (8 - cl) / 4

    # Conductivity: ideal <400, score 0 if >800
    co = values["Conductivity"]
    if co < 400:
        scores["conductivity"] = 10.0
    elif co >= 800:
        scores["conductivity"] = 0.0
    else:
        scores["conductivity"] = 10.0 * (800 - co) / 400

    # Organic Carbon: ideal <10, scale to 20, score 0 if >20
    oc = values["Organic_carbon"]
    if oc < 10:
        scores["organic_carbon"] = 10.0
    elif oc >= 20:
        scores["organic_carbon"] = 0.0
    else:
        scores["organic_carbon"] = 10.0 * (20 - oc) / 10

    # Trihalomethanes: ideal <80, scale to 150, score 0 if >150
    th = values["Trihalomethanes"]
    if th < 80:
        scores["trihalomethanes"] = 10.0
    elif th >= 150:
        scores["trihalomethanes"] = 0.0
    else:
        scores["trihalomethanes"] = 10.0 * (150 - th) / 70

    # Turbidity: ideal <4, scale to 8, score 0 if >8
    tu = values["Turbidity"]
    if tu < 4:
        scores["turbidity"] = 10.0
    elif tu >= 8:
        scores["turbidity"] = 0.0
    else:
        scores["turbidity"] = 10.0 * (8 - tu) / 4

    return {k: round(v, 2) for k, v in scores.items()}


def water_quality_score(param_scores: dict) -> float:
    """Aggregate sub-scores into 0–100% quality score."""
    total  = sum(param_scores.values())
    max_ps = len(param_scores) * 10.0
    return round((total / max_ps) * 100, 2)


def get_quality_category(score: float) -> dict:
    """Map quality score to category, color, and health message."""
    if score >= 85:
        return {
            "quality_category": "Excellent",
            "color": "#00C853",
            "health_message": "Water is excellent quality. Perfectly safe for consumption.",
        }
    elif score >= 70:
        return {
            "quality_category": "Good",
            "color": "#64DD17",
            "health_message": "Water meets quality standards and is safe for consumption.",
        }
    elif score >= 50:
        return {
            "quality_category": "Moderate",
            "color": "#FFA500",
            "health_message": "Water quality is acceptable but some parameters need attention.",
        }
    elif score >= 30:
        return {
            "quality_category": "Poor",
            "color": "#FF5722",
            "health_message": "Water quality is below standard. Treatment recommended before use.",
        }
    else:
        return {
            "quality_category": "Very Poor",
            "color": "#B71C1C",
            "health_message": "Water is unsafe. Do not consume without proper treatment.",
        }


# ── Routes ─────────────────────────────────────────────────────────────────────

@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "service": "EnviroCheck Water Quality API",
        "model_loaded": model is not None,
        "port": 5001,
    })


@app.route("/model/water/info", methods=["GET"])
def model_info():
    if not model_meta:
        return jsonify({"error": "Model metadata not found. Train the model first."}), 404
    return jsonify({
        "model_name": model_meta.get("model_name", "Unknown"),
        "f1_score":   model_meta.get("f1_score",  0),
        "accuracy":   model_meta.get("accuracy",  0),
        "roc_auc":    model_meta.get("roc_auc",   0),
        "precision":  model_meta.get("precision", 0),
        "recall":     model_meta.get("recall",    0),
        "features":   FEATURES,
        "all_models": model_meta.get("all_models", {}),
    })


@app.route("/predict/water", methods=["POST"])
def predict_water():
    if model is None or scaler is None:
        return jsonify({
            "error": "Model not loaded. Run train_water_model.py first."
        }), 503

    data = request.get_json(force=True)
    if not data:
        return jsonify({"error": "Request body must be JSON."}), 400

    # ── Validate & parse input ─────────────────────────────────────────────────
    required_keys = list(KEY_MAP.keys())             # lowercase frontend keys
    parsed = {}
    missing = []
    invalid = []

    for frontend_key in required_keys:
        if frontend_key not in data:
            missing.append(frontend_key)
        else:
            try:
                parsed[KEY_MAP[frontend_key]] = float(data[frontend_key])
            except (ValueError, TypeError):
                invalid.append(frontend_key)

    if missing:
        return jsonify({
            "error": f"Missing required fields: {missing}"
        }), 400
    if invalid:
        return jsonify({
            "error": f"Non-numeric values for fields: {invalid}"
        }), 400

    # ── Feature vector (exact training order) ──────────────────────────────────
    X = np.array([[parsed[f] for f in FEATURES]], dtype=float)
    X_scaled = scaler.transform(X)

    # ── ML Prediction ──────────────────────────────────────────────────────────
    potability   = int(model.predict(X_scaled)[0])
    potab_label  = "Potable" if potability == 1 else "Not Potable"

    # ── Quality scoring (rule-based, independent of ML prediction) ────────────
    param_scores = score_parameters(parsed)
    wq_score     = water_quality_score(param_scores)
    cat_info     = get_quality_category(wq_score)

    model_name = model_meta.get("model_name", type(model).__name__)

    return jsonify({
        "potability":          potability,
        "potability_label":    potab_label,
        "water_quality_score": wq_score,
        "quality_category":    cat_info["quality_category"],
        "color":               cat_info["color"],
        "health_message":      cat_info["health_message"],
        "parameter_scores":    param_scores,
        "model_used":          model_name,
    })


# ── Entry point ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("🚀 Starting Water Quality API on http://localhost:5001")
    app.run(host="0.0.0.0", port=5001, debug=True)
