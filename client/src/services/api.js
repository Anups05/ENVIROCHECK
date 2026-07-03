import axios from 'axios';

const ML_BASE = 'http://localhost:5000';
const API_BASE = '/api';

// ── Axios instance for legacy /api/* routes (proxied through Vite) ───────────
const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// ── Legacy routes (water, livability, health risk, future, reports) ──────────
export const predictWater       = (data)          => api.post('/predict-water', data);
export const predictLivability  = (data)          => api.post('/predict-livability', data);
export const predictHealthRisk  = (data)          => api.post('/predict-health-risk', data);
export const futurePrediction   = (data)          => api.post('/future-prediction', data);
export const generateReport     = (data)          => api.post('/generate-report', data);
export const getCityData        = (city)          => api.get(`/city/${city}`);
export const compareCities      = (city1, city2)  => api.get(`/compare?city1=${city1}&city2=${city2}`);
export const getHistory         = ()              => api.get('/history');

// ── Real ML AQI endpoint (POST /predict/aqi) ─────────────────────────────────
/**
 * predictAQI — calls the trained XGBoost / Random Forest model.
 *
 * @param {Object} data  — must contain all 15 fields:
 *   pm25, pm10, no2, so2, co, o3, nh3,
 *   temperature, humidity, wind_speed,
 *   traffic_density, industrial_activity,
 *   green_cover, population_density, waste_management_score
 *
 * @returns {Promise<{aqi, category, color, health_message, model_used}>}
 */
export const predictAQI = async (data) => {
  const response = await fetch(`${ML_BASE}/predict/aqi`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(data),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error(errBody.error || `HTTP ${response.status}`);
  }

  return response.json();   // { aqi, category, color, health_message, model_used }
};

// ── Model info endpoint (GET /model/info) ─────────────────────────────────────
export const getModelInfo = () =>
  fetch(`${ML_BASE}/model/info`).then(r => r.json());

// ── Health check (GET /health) ────────────────────────────────────────────────
export const checkHealth = () =>
  fetch(`${ML_BASE}/health`).then(r => r.json());

export default api;
