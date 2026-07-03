# EnviroCheck – Intelligent Assessment of Livability & Environmental Health

A full-stack application with a React frontend and a Flask/Python Machine Learning backend.

## Architecture

```
MP-Enviro/
├── client/          # React + Vite + Tailwind CSS frontend (port 5173)
└── ml-service/      # Python Flask ML Service backend (port 5000)
```

## Tech Stack

- **Frontend**: React 19, Vite, Tailwind CSS, Recharts, Framer Motion
- **Backend/ML Service**: Python, Flask, NumPy, scikit-learn

## Getting Started

You only need two terminal windows to run this application.

### 1. Install Dependencies

```bash
# Frontend
cd client 
npm install

# Backend
cd ml-service 
pip install -r requirements.txt
```

### 2. Start Both Services

**Terminal 1: Flask Backend API (Runs on port 5000)**
```bash
cd ml-service
python app.py
```

**Terminal 2: React Frontend (Runs on port 5173)**
```bash
cd client
npm run dev
```

### 3. Access the App

Open http://localhost:5173 in your browser.

## Features

- 🏠 **Home**: Hero section with animated graphics
- 📊 **Dashboard**: Input environmental parameters
- 📈 **Results**: Gauge charts, bar/pie/line charts
- ⚖️ **City Compare**: Side-by-side comparison with radar charts
- 🎛️ **What-If Simulator**: Interactive sliders with live predictions
- 🔮 **Future Predictions**: 5-year trend forecasting
- 📄 **Reports**: Generate and download assessment reports

## API Endpoints (Flask)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/predict-aqi | Predict Air Quality Index |
| POST | /api/predict-water | Predict Water Safety |
| POST | /api/predict-livability | Predict Livability Score |
| POST | /api/predict-health-risk | Predict Health Risk Level |
| POST | /api/future-prediction | Generate Future Predictions |
| POST | /api/generate-report | Generate Assessment Report |
| GET | /api/history | Get Prediction History (Mock Data) |
| GET | /api/compare | Compare 2 cities (Mock Data) |

## ML Models

- **XGBoost**: AQI & Livability prediction
- **Random Forest**: Water quality classification
- **SVM**: Health risk classification
- **Prophet-like**: Time-series future prediction
