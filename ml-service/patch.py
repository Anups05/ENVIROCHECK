import os

script_dir = r"c:\Users\Anupras\Desktop\MP-Enviro\ml-service"
app_path = os.path.join(script_dir, "app.py")

with open(app_path, "r", encoding="utf-8") as f:
    app_lines = f.readlines()

addition = """
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
        print("✅ Water model & scaler loaded.")
    except FileNotFoundError as e:
        print(f"⚠️  {e}\\n   Run train_water_model.py first!")

    if os.path.exists(WATER_META_PATH):
        import json
        with open(WATER_META_PATH) as f:
            _water_meta = json.load(f)

_load_water_model()

def score_parameters(values: dict) -> dict:
    scores = {}
    ph = values["pH"]
    if 6.5 <= ph <= 8.5: scores["ph"] = 10.0
    elif ph < 4 or ph > 11: scores["ph"] = 0.0
    elif ph < 6.5: scores["ph"] = max(0.0, 10.0 * (ph - 4) / (6.5 - 4))
    else: scores["ph"] = max(0.0, 10.0 * (11 - ph) / (11 - 8.5))

    h = values["Hardness"]
    if 60 <= h <= 200: scores["hardness"] = 10.0
    elif h < 60: scores["hardness"] = max(0.0, 10.0 * h / 60)
    else: scores["hardness"] = max(0.0, 10.0 * (400 - h) / 200)

    s = values["Solids"]
    if s < 500: scores["solids"] = 10.0
    elif s >= 1000: scores["solids"] = 0.0
    else: scores["solids"] = 10.0 * (1000 - s) / 500

    sf = values["Sulfate"]
    if sf < 250: scores["sulfate"] = 10.0
    elif sf >= 500: scores["sulfate"] = 0.0
    else: scores["sulfate"] = 10.0 * (500 - sf) / 250

    cl = values["Chloramines"]
    if cl < 4: scores["chloramines"] = 10.0
    elif cl >= 8: scores["chloramines"] = 0.0
    else: scores["chloramines"] = 10.0 * (8 - cl) / 4

    co = values["Conductivity"]
    if co < 400: scores["conductivity"] = 10.0
    elif co >= 800: scores["conductivity"] = 0.0
    else: scores["conductivity"] = 10.0 * (800 - co) / 400

    oc = values["Organic_carbon"]
    if oc < 10: scores["organic_carbon"] = 10.0
    elif oc >= 20: scores["organic_carbon"] = 0.0
    else: scores["organic_carbon"] = 10.0 * (20 - oc) / 10

    th = values["Trihalomethanes"]
    if th < 80: scores["trihalomethanes"] = 10.0
    elif th >= 150: scores["trihalomethanes"] = 0.0
    else: scores["trihalomethanes"] = 10.0 * (150 - th) / 70

    tu = values["Turbidity"]
    if tu < 4: scores["turbidity"] = 10.0
    elif tu >= 8: scores["turbidity"] = 0.0
    else: scores["turbidity"] = 10.0 * (8 - tu) / 4

    return {k: round(v, 2) for k, v in scores.items()}

def water_quality_score(param_scores: dict) -> float:
    total  = sum(param_scores.values())
    max_ps = len(param_scores) * 10.0
    return round((total / max_ps) * 100, 2)

def get_quality_category(score: float) -> dict:
    if score >= 85:
        return {"quality_category": "Excellent", "color": "#00C853", "health_message": "Water is excellent quality. Perfectly safe for consumption."}
    elif score >= 70:
        return {"quality_category": "Good", "color": "#64DD17", "health_message": "Water meets quality standards and is safe for consumption."}
    elif score >= 50:
        return {"quality_category": "Moderate", "color": "#FFA500", "health_message": "Water quality is acceptable but some parameters need attention."}
    elif score >= 30:
        return {"quality_category": "Poor", "color": "#FF5722", "health_message": "Water quality is below standard. Treatment recommended before use."}
    else:
        return {"quality_category": "Very Poor", "color": "#B71C1C", "health_message": "Water is unsafe. Do not consume without proper treatment."}

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

    X = np.array([[parsed[f] for f in WATER_FEATURES]], dtype=float)
    X_scaled = _water_scaler.transform(X)

    potability   = int(_water_model.predict(X_scaled)[0])
    potab_label  = "Potable" if potability == 1 else "Not Potable"

    param_scores = score_parameters(parsed)
    wq_score     = water_quality_score(param_scores)
    cat_info     = get_quality_category(wq_score)
    model_name   = _water_meta.get("model_name", type(_water_model).__name__)

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

"""

# Insert before `if __name__ == "__main__":`
new_lines = []
for line in app_lines:
    if line.startswith('if __name__ == "__main__":'):
        new_lines.append(addition)
    new_lines.append(line)

with open(app_path, "w", encoding="utf-8") as f:
    f.writelines(new_lines)
