import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { HiLocationMarker, HiCloud, HiBeaker, HiGlobe, HiArrowRight, HiSparkles, HiExclamationCircle } from 'react-icons/hi';

// ── Air Quality — all 15 model features ─────────────────────────────────────
const pollutantParams = [
  { key: 'pm25', label: 'PM2.5 (µg/m³)', placeholder: '67.4', min: 0, max: 500, step: 'any' },
  { key: 'pm10', label: 'PM10 (µg/m³)', placeholder: '112.3', min: 0, max: 600, step: 'any' },
  { key: 'no2', label: 'NO₂ (µg/m³)', placeholder: '38.7', min: 0, max: 200, step: 'any' },
  { key: 'so2', label: 'SO₂ (µg/m³)', placeholder: '14.2', min: 0, max: 200, step: 'any' },
  { key: 'co', label: 'CO (mg/m³)', placeholder: '1.8', min: 0, max: 50, step: 'any' },
  { key: 'o3', label: 'O₃ (µg/m³)', placeholder: '44.5', min: 0, max: 200, step: 'any' },
  { key: 'nh3', label: 'NH₃ (µg/m³)', placeholder: '22.1', min: 0, max: 200, step: 'any' },
];

const meteoParams = [
  { key: 'temperature', label: 'Temperature (°C)', placeholder: '31.2', min: -30, max: 55, step: 'any' },
  { key: 'humidity', label: 'Humidity (%)', placeholder: '68.0', min: 0, max: 100, step: 'any' },
  { key: 'wind_speed', label: 'Wind Speed (km/h)', placeholder: '12.4', min: 0, max: 150, step: 'any' },
];

const urbanParams = [
  { key: 'traffic_density', label: 'Traffic Density (veh/hr)', placeholder: '3200', min: 0, max: 20000, step: 'any' },
  { key: 'industrial_activity', label: 'Industrial Activity (0–100)', placeholder: '42.0', min: 0, max: 100, step: 'any' },
  { key: 'green_cover', label: 'Green Cover (%)', placeholder: '23.5', min: 0, max: 100, step: 'any' },
  { key: 'population_density', label: 'Population Density (per km²)', placeholder: '8400', min: 0, max: 100000, step: 'any' },
  { key: 'waste_management_score', label: 'Waste Management Score (0–10)', placeholder: '6.2', min: 0, max: 10, step: 'any' },
];

// ── Water params (ML) ──────────
const waterParams = [
  { key: 'ph', label: 'pH Level', placeholder: '7.2', min: 0, max: 14, step: 'any' },
  { key: 'hardness', label: 'Hardness (mg/L)', placeholder: '120.5', min: 0, max: 1000, step: 'any' },
  { key: 'solids', label: 'Solids (TDS ppm)', placeholder: '350.8', min: 0, max: 5000, step: 'any' },
  { key: 'sulfate', label: 'Sulfate (mg/L)', placeholder: '180.3', min: 0, max: 1000, step: 'any' },
  { key: 'chloramines', label: 'Chloramines (ppm)', placeholder: '2.5', min: 0, max: 20, step: 'any' },
  { key: 'conductivity', label: 'Conductivity (µS/cm)', placeholder: '280.0', min: 0, max: 2000, step: 'any' },
  { key: 'organic_carbon', label: 'Organic Carbon (ppm)', placeholder: '8.4', min: 0, max: 50, step: 'any' },
  { key: 'trihalomethanes', label: 'Trihalomethanes (µg/L)', placeholder: '55.2', min: 0, max: 300, step: 'any' },
  { key: 'turbidity', label: 'Turbidity (NTU)', placeholder: '2.8', min: 0, max: 20, step: 'any' },
];

// ── AQI category helper (mirrors backend) ────────────────────────────────────
const AQI_CATS = [
  { max: 50, label: 'Good', color: '#00C853' },
  { max: 100, label: 'Satisfactory', color: '#64DD17' },
  { max: 200, label: 'Moderate', color: '#FFA500' },
  { max: 300, label: 'Poor', color: '#FF5722' },
  { max: 400, label: 'Very Poor', color: '#B71C1C' },
  { max: 500, label: 'Severe/Hazardous', color: '#6A1B9A' },
];
const getAqiInfo = (val) => AQI_CATS.find(c => val <= c.max) || AQI_CATS[AQI_CATS.length - 1];

// ── Legacy formula helpers (water / livability / health — unchanged) ─────────
const getAqiCategory = (val) => {
  if (val <= 50) return 'Good';
  if (val <= 100) return 'Moderate';
  if (val <= 150) return 'Unhealthy for Sensitive';
  if (val <= 200) return 'Unhealthy';
  if (val <= 300) return 'Very Unhealthy';
  return 'Hazardous';
};


export default function Dashboard() {
  const navigate = useNavigate();
  const [city, setCity] = useState('');
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({});


  const handleChange = (key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };



  // ── Full analysis submit (all tabs combined) ──────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const pf = (k, def = 0) => parseFloat(formData[k] || def);

    // ML Water safety prediction
    let waterGeneral = 80;
    let waterDetails = {};
    try {
      const waterPayload = {};
      waterParams.forEach(p => { waterPayload[p.key] = pf(p.key, 0); });
      const wRes = await fetch('http://localhost:5000/predict/water', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(waterPayload),
      });
      if (wRes.ok) {
        waterDetails = await wRes.json();
        // New response shape: waterDetails.water_safety.safety_pct
        waterGeneral = waterDetails.water_safety?.safety_pct ?? 80;
      }
    } catch (e) {
      console.warn("Failed to fetch ML Water during submit", e);
    }
    const waterAdjusted = waterGeneral;

    // 1. General AQI (Formula)
    const { calculateCPCBAQI } = await import('../utils/aqiCalculator.js');
    const cpcbResult = calculateCPCBAQI(formData);
    const generalAqiValue = cpcbResult.aqi;
    const generalAqiCategory = cpcbResult.category;
    const generalAqiBreakdown = cpcbResult.breakdown;

    // 2. ML Predicted AQI (fetch from server)
    let mlAqiValue = generalAqiValue;
    let mlAqiCategory = generalAqiCategory;
    let mlModelUsed = 'Formula / Fallback';
    let mlAqiColor = cpcbResult.color;

    try {
      const allAqiKeys = [...pollutantParams, ...meteoParams, ...urbanParams].map(p => p.key);
      const payload = {};
      allAqiKeys.forEach(k => { payload[k] = parseFloat(formData[k] || 0); });

      const response = await fetch('http://localhost:5000/predict/aqi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const result = await response.json();
        mlAqiValue = result.aqi;
        mlAqiCategory = result.category;
        mlModelUsed = result.model_used;
        mlAqiColor = result.color;
      }
    } catch (e) {
      console.warn("Failed to fetch ML Prediction during submit", e);
    }

    let livability = 100;
    livability -= (mlAqiValue / 5);
    livability -= (100 - waterAdjusted) / 2;
    livability += (pf('green_cover') || pf('greenCover', 0)) / 5;
    if (pf('temperature') > 35 || pf('temperature') < 10) livability -= 10;
    livability += (pf('waste_management_score') || pf('wasteManagement', 5)) * 2;
    livability = Math.min(100, Math.max(10, livability));

    let healthScore = (mlAqiValue / 5) + (100 - waterAdjusted) / 2 + (pf('population_density') / 10000);
    healthScore = Math.min(100, healthScore);
    const healthLevel = healthScore > 70 ? 'High' : healthScore > 35 ? 'Medium' : 'Low';

    const mockResults = {
      city: city || 'Local Area',
      timestamp: new Date().toISOString(),
      aqi: {
        general: { value: Math.round(generalAqiValue), category: generalAqiCategory },
        adjusted: { value: Math.round(mlAqiValue), category: mlAqiCategory },
        value: Math.round(mlAqiValue),
        category: mlAqiCategory,
        mlModel: mlModelUsed,
        color: mlAqiColor,
      },
      waterSafety: {
        score: Math.round(waterAdjusted),
        mlScore: waterDetails.potability?.ml_safety_pct ?? Math.round(waterAdjusted),
        safe: waterDetails.potability?.prediction === 1 || waterAdjusted >= 60,
        model: waterDetails.potability?.model || 'Random Forest',
        category: waterDetails.water_safety?.category || 'Good',
        color: waterDetails.water_safety?.color || '#64DD17',
        wqi: waterDetails.water_safety?.wqi ?? null,
        potabilityLabel: waterDetails.potability?.label ?? null,
        confidence: waterDetails.potability?.confidence ?? null,
        details: waterDetails,
      },
      livability: { score: Math.round(livability) },
      healthRisk: { level: healthLevel, score: Math.round(healthScore) },
      inputData: { ...formData, city: city || 'Local Area' },
    };

    localStorage.setItem('envirocheck-results', JSON.stringify(mockResults));
    setTimeout(() => { setLoading(false); navigate('/results'); }, 600);
  };

  // ── Fill sample data ─────────────────────────────────────────────────────
  const fillSampleData = () => {
    const cities = ['Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Kolkata', 'Pune', 'Hyderabad', 'Ahmedabad'];
    setCity(cities[Math.floor(Math.random() * cities.length)]);
    const rand = (min, max) => (Math.random() * (max - min) + min).toFixed(2);
    setFormData({
      pm25: rand(20, 140),
      pm10: rand(40, 200),
      no2: rand(10, 90),
      so2: rand(5, 60),
      co: rand(0.5, 5),
      o3: rand(20, 90),
      nh3: rand(5, 60),
      temperature: rand(18, 42),
      humidity: rand(30, 90),
      wind_speed: rand(2, 30),
      traffic_density: rand(500, 8000),
      industrial_activity: rand(10, 80),
      green_cover: rand(5, 50),
      population_density: rand(500, 15000),
      waste_management_score: rand(2, 9),
      // water ML parameters (realistic dataset bounds)
      ph: rand(6.0, 9.0),
      hardness: rand(120, 250),
      solids: rand(5000, 30000),
      sulfate: rand(200, 400),
      chloramines: rand(4.0, 9.0),
      conductivity: rand(300, 550),
      organic_carbon: rand(8.0, 20.0),
      trihalomethanes: rand(40, 90),
      turbidity: rand(2.5, 5.5),
    });
  };

  // ── Render helpers ───────────────────────────────────────────────────────
  const renderInputField = (param) => (
    <div key={param.key}>
      <label className="block text-xs font-semibold text-dark-600 mb-2 uppercase tracking-wide">
        {param.label}
      </label>
      <input
        type="number"
        required
        value={formData[param.key] || ''}
        onChange={(e) => handleChange(param.key, e.target.value)}
        placeholder={param.placeholder}
        min={param.min}
        max={param.max}
        step={param.step || 1}
        className="input-field"
      />
    </div>
  );


  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="section-title">Environmental <span className="gradient-text">Analysis</span></h1>
          <p className="section-subtitle mt-2">Enter environmental parameters to predict AQI and livability metrics</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
          onClick={fillSampleData}
          className="btn-secondary flex items-center gap-2 text-sm whitespace-nowrap"
        >
          <HiSparkles className="w-4 h-4 text-enviro-500" /> Fill Sample Data
        </motion.button>
      </div>

      {/* City */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6">
        <label className="block text-sm font-semibold text-dark-700 mb-2">
          <HiLocationMarker className="inline w-4 h-4 mr-1 text-enviro-500" />
          City Name (Optional)
        </label>
        <input
          type="text"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="Enter city name (e.g., Mumbai, Delhi, London)"
          className="input-field text-lg"
        />
      </motion.div>

      <motion.form
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        onSubmit={handleSubmit}
        className="space-y-8"
      >

        {/* ── Air Quality — Pollutants ─────────────────────────────────────── */}
        <div className="glass-card p-8">
          <h3 className="text-lg font-bold text-dark-900 mb-1 flex items-center gap-2">
            <HiCloud className="w-5 h-5 text-blue-500" />
            Air Quality — Core Pollutants
            <span className="text-xs font-normal text-red-500 ml-2">* Required</span>
          </h3>
          <p className="text-xs text-dark-400 mb-6">7 pollutants used by the AQI prediction model</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {pollutantParams.map((p) => renderInputField(p))}
          </div>
        </div>

        {/* ── Meteorological ───────────────────────────────────────────────── */}
        <div className="glass-card p-8">
          <h3 className="text-lg font-bold text-dark-900 mb-1 flex items-center gap-2">
            <span className="text-blue-400 text-xl">🌡️</span>
            Meteorological Parameters
            <span className="text-xs font-normal text-red-500 ml-2">* Required</span>
          </h3>
          <p className="text-xs text-dark-400 mb-6">Weather conditions that influence pollutant dispersion</p>
          <div className="grid sm:grid-cols-3 gap-6">
            {meteoParams.map((p) => renderInputField(p))}
          </div>
        </div>

        {/* ── Urban / Environmental ────────────────────────────────────────── */}
        <div className="glass-card p-8">
          <h3 className="text-lg font-bold text-dark-900 mb-1 flex items-center gap-2">
            <HiGlobe className="w-5 h-5 text-purple-500" />
            Urban &amp; Environmental Factors
            <span className="text-xs font-normal text-red-500 ml-2">* Required</span>
          </h3>
          <p className="text-xs text-dark-400 mb-6">Urban parameters used by the AQI model</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {urbanParams.map((p) => renderInputField(p))}
          </div>
        </div>


        {/* ── Water Quality Section (legacy) ───────────────────────────────── */}
        <div className="glass-card p-8">
          <h3 className="text-lg font-bold text-dark-900 mb-1 flex items-center gap-2">
            <HiBeaker className="w-5 h-5 text-enviro-500" />
            Water Quality Metrics
            <span className="text-xs font-normal text-red-500 ml-2">* Required</span>
          </h3>
          <p className="text-xs text-dark-400 mb-6">Used for water safety score and livability calculation</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {waterParams.map((p) => renderInputField(p))}
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-center pt-4">
          <motion.button
            type="submit"
            disabled={loading}
            whileHover={{ scale: loading ? 1 : 1.03 }}
            whileTap={{ scale: loading ? 1 : 0.97 }}
            className={`btn-primary text-xl px-16 py-5 flex items-center gap-3 shadow-xl ${loading ? 'opacity-80 cursor-wait' : ''}`}
          >
            {loading ? (
              <>
                <svg className="animate-spin w-6 h-6 text-white" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Processing Analysis…
              </>
            ) : (
              <>
                <HiSparkles className="w-6 h-6" />
                Analyze All Parameters
                <HiArrowRight className="w-6 h-6" />
              </>
            )}
          </motion.button>
        </div>
      </motion.form>
    </div>
  );
}
