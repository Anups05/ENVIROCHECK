import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';
import {
  HiScale, HiArrowRight, HiSparkles, HiLocationMarker,
  HiCloud, HiBeaker, HiGlobe, HiRefresh, HiChevronDown, HiChevronUp,
  HiShieldCheck, HiHeart, HiChartBar,
} from 'react-icons/hi';

// ── Shared param definitions (mirrors Dashboard) ──────────────────────────────
const pollutantParams = [
  { key: 'pm25',  label: 'PM2.5 (µg/m³)',       placeholder: '67.4',  min: 0, max: 500 },
  { key: 'pm10',  label: 'PM10 (µg/m³)',         placeholder: '112.3', min: 0, max: 600 },
  { key: 'no2',   label: 'NO₂ (µg/m³)',          placeholder: '38.7',  min: 0, max: 200 },
  { key: 'so2',   label: 'SO₂ (µg/m³)',          placeholder: '14.2',  min: 0, max: 200 },
  { key: 'co',    label: 'CO (mg/m³)',            placeholder: '1.8',   min: 0, max: 50  },
  { key: 'o3',    label: 'O₃ (µg/m³)',           placeholder: '44.5',  min: 0, max: 200 },
  { key: 'nh3',   label: 'NH₃ (µg/m³)',          placeholder: '22.1',  min: 0, max: 200 },
];
const meteoParams = [
  { key: 'temperature', label: 'Temperature (°C)',  placeholder: '31.2', min: -30, max: 55 },
  { key: 'humidity',    label: 'Humidity (%)',       placeholder: '68.0', min: 0,   max: 100 },
  { key: 'wind_speed',  label: 'Wind Speed (km/h)', placeholder: '12.4', min: 0,   max: 150 },
];
const urbanParams = [
  { key: 'traffic_density',        label: 'Traffic Density (veh/hr)',     placeholder: '3200', min: 0, max: 20000 },
  { key: 'industrial_activity',    label: 'Industrial Activity (0–100)',  placeholder: '42.0', min: 0, max: 100   },
  { key: 'green_cover',            label: 'Green Cover (%)',              placeholder: '23.5', min: 0, max: 100   },
  { key: 'population_density',     label: 'Population Density (/km²)',    placeholder: '8400', min: 0, max: 100000},
  { key: 'waste_management_score', label: 'Waste Management (0–10)',      placeholder: '6.2',  min: 0, max: 10    },
];
const waterParams = [
  { key: 'ph',              label: 'pH Level',               placeholder: '7.2',   min: 0, max: 14   },
  { key: 'hardness',        label: 'Hardness (mg/L)',         placeholder: '120.5', min: 0, max: 1000 },
  { key: 'solids',          label: 'Solids / TDS (ppm)',      placeholder: '350.8', min: 0, max: 50000},
  { key: 'sulfate',         label: 'Sulfate (mg/L)',          placeholder: '180.3', min: 0, max: 1000 },
  { key: 'chloramines',     label: 'Chloramines (ppm)',       placeholder: '2.5',   min: 0, max: 20   },
  { key: 'conductivity',    label: 'Conductivity (µS/cm)',    placeholder: '280.0', min: 0, max: 2000 },
  { key: 'organic_carbon',  label: 'Organic Carbon (ppm)',    placeholder: '8.4',   min: 0, max: 50   },
  { key: 'trihalomethanes', label: 'Trihalomethanes (µg/L)', placeholder: '55.2',  min: 0, max: 300  },
  { key: 'turbidity',       label: 'Turbidity (NTU)',         placeholder: '2.8',   min: 0, max: 20   },
];

// ── AQI helpers ───────────────────────────────────────────────────────────────
const AQI_CATS = [
  { max: 50,  label: 'Good',             color: '#00C853' },
  { max: 100, label: 'Satisfactory',     color: '#64DD17' },
  { max: 200, label: 'Moderate',         color: '#FFA500' },
  { max: 300, label: 'Poor',             color: '#FF5722' },
  { max: 400, label: 'Very Poor',        color: '#B71C1C' },
  { max: 500, label: 'Severe/Hazardous', color: '#6A1B9A' },
];
const getAqiInfo = (val) => AQI_CATS.find(c => val <= c.max) || AQI_CATS[AQI_CATS.length - 1];

// ── Random sample data ────────────────────────────────────────────────────────
const rand = (min, max) => +(Math.random() * (max - min) + min).toFixed(2);
const generateSample = () => ({
  pm25: rand(20, 140), pm10: rand(40, 200), no2: rand(10, 90),
  so2: rand(5, 60), co: rand(0.5, 5), o3: rand(20, 90), nh3: rand(5, 60),
  temperature: rand(18, 42), humidity: rand(30, 90), wind_speed: rand(2, 30),
  traffic_density: rand(500, 8000), industrial_activity: rand(10, 80),
  green_cover: rand(5, 50), population_density: rand(500, 15000),
  waste_management_score: rand(2, 9),
  ph: rand(6.0, 9.0), hardness: rand(50, 300), solids: rand(200, 800),
  sulfate: rand(50, 300), chloramines: rand(1, 8), conductivity: rand(200, 600),
  organic_carbon: rand(1, 15), trihalomethanes: rand(20, 100), turbidity: rand(1, 6),
});

// ── Core analysis engine (mirrors Dashboard.handleSubmit) ─────────────────────
async function analyseCity(formData) {
  const pf = (k, def = 0) => parseFloat(formData[k] ?? def);

  // 1. Formula AQI
  const { calculateCPCBAQI } = await import('../utils/aqiCalculator.js');
  const cpcbResult      = calculateCPCBAQI(formData);
  let formulaAqi        = cpcbResult.aqi;
  let formulaAqiCat     = cpcbResult.category;

  // 2. ML AQI
  let mlAqi = formulaAqi, mlAqiCat = formulaAqiCat, mlAqiColor = cpcbResult.color;
  try {
    const payload = {};
    [...pollutantParams, ...meteoParams, ...urbanParams].forEach(p => {
      payload[p.key] = pf(p.key);
    });
    const res = await fetch('http://localhost:5000/predict/aqi', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) { const j = await res.json(); mlAqi = j.aqi; mlAqiCat = j.category; mlAqiColor = j.color; }
  } catch (_) {}

  const avgAqi    = Math.round((formulaAqi + mlAqi) / 2);
  const avgAqiCat = getAqiInfo(avgAqi);

  // 3. Formula Water (WQI)
  const { calculateWQI } = await import('../utils/wqiCalculator.js');
  const wqiResult = calculateWQI(formData);
  let formulaWater = wqiResult.safetyPct;

  // 4. ML Water
  let mlWater = formulaWater, mlWaterPotability = null;
  try {
    const wPayload = {};
    waterParams.forEach(p => { wPayload[p.key] = pf(p.key); });
    const wRes = await fetch('http://localhost:5000/predict/water', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(wPayload),
    });
    if (wRes.ok) {
      const j = await wRes.json();
      mlWater         = j.water_safety?.safety_pct ?? formulaWater;
      mlWaterPotability = j.potability?.label ?? null;
    }
  } catch (_) {}

  const avgWater = Math.round((formulaWater + mlWater) / 2);

  // 5. Livability
  let livability = 100;
  livability -= avgAqi / 5;
  livability -= (100 - avgWater) / 2;
  livability += (pf('green_cover') || 0) / 5;
  if (pf('temperature') > 35 || pf('temperature') < 10) livability -= 10;
  livability += (pf('waste_management_score') || 5) * 2;
  livability = Math.min(100, Math.max(10, Math.round(livability)));

  // 6. Health Risk
  let healthScore = (avgAqi / 5) + (100 - avgWater) / 2 + (pf('population_density') / 10000);
  healthScore     = Math.min(100, healthScore);
  const healthLevel = healthScore > 70 ? 'High' : healthScore > 35 ? 'Medium' : 'Low';

  return {
    formulaAqi, formulaAqiCat, mlAqi, mlAqiCat, mlAqiColor,
    avgAqi, avgAqiCat,
    formulaWater, mlWater, avgWater,
    mlWaterPotability,
    livability, healthLevel, healthScore: Math.round(healthScore),
    greenCover: pf('green_cover'), wasteMgmt: pf('waste_management_score'),
  };
}

// ── Section toggle component ─────────────────────────────────────────────────
function Section({ title, icon: Icon, color, children }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border border-dark-200/30 rounded-xl overflow-hidden mb-3">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white/40 hover:bg-white/60 transition-colors"
      >
        <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest" style={{ color }}>
          <Icon className="w-4 h-4" /> {title}
        </span>
        {open ? <HiChevronUp className="w-4 h-4 text-dark-400" /> : <HiChevronDown className="w-4 h-4 text-dark-400" />}
      </button>
      {open && <div className="p-3 grid grid-cols-2 gap-2">{children}</div>}
    </div>
  );
}

// ── City input panel ──────────────────────────────────────────────────────────
function CityPanel({ label, accentColor, formData, setFormData, cityName, setCityName }) {
  const handleChange = (key, val) => setFormData(prev => ({ ...prev, [key]: val }));
  const fill = () => { setFormData(generateSample()); };

  const field = (p) => (
    <div key={p.key} className="flex flex-col gap-1">
      <label className="text-[10px] font-semibold text-dark-500 uppercase tracking-wide">{p.label}</label>
      <input
        type="number" step="any" min={p.min} max={p.max}
        placeholder={p.placeholder}
        value={formData[p.key] ?? ''}
        onChange={e => handleChange(p.key, e.target.value)}
        className="input-field text-sm py-2 px-3"
      />
    </div>
  );

  return (
    <div className="glass-card p-5" style={{ borderTop: `4px solid ${accentColor}` }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <HiLocationMarker className="w-5 h-5" style={{ color: accentColor }} />
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: accentColor }}>{label}</span>
        </div>
        <motion.button
          type="button" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
          onClick={fill}
          className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg border"
          style={{ borderColor: accentColor, color: accentColor }}
        >
          <HiRefresh className="w-3.5 h-3.5" /> Fill Sample
        </motion.button>
      </div>

      {/* City name */}
      <input
        type="text" placeholder="Enter city name…"
        value={cityName}
        onChange={e => setCityName(e.target.value)}
        className="input-field text-sm mb-4 font-semibold"
      />

      <Section title="Core Pollutants" icon={HiCloud} color="#3b82f6">
        {pollutantParams.map(field)}
      </Section>
      <Section title="Meteorological" icon={HiGlobe} color="#0ea5e9">
        {meteoParams.map(field)}
      </Section>
      <Section title="Urban Factors" icon={HiChartBar} color="#8b5cf6">
        {urbanParams.map(field)}
      </Section>
      <Section title="Water Quality" icon={HiBeaker} color="#10b981">
        {waterParams.map(field)}
      </Section>
    </div>
  );
}

// ── Result summary card for one city ─────────────────────────────────────────
function CityResultCard({ name, result, accentColor, isWinner }) {
  const metrics = [
    { label: 'Avg AQI',       value: result.avgAqi,        unit: '',    icon: HiChartBar,    color: result.avgAqiCat?.color  || '#FFA500' },
    { label: 'Water Safety',  value: `${result.avgWater}`, unit: '%',   icon: HiShieldCheck, color: result.avgWater >= 60 ? '#00C853' : '#ef4444' },
    { label: 'Health Risk',   value: result.healthLevel,   unit: '',    icon: HiHeart,       color: result.healthLevel === 'Low' ? '#00C853' : result.healthLevel === 'High' ? '#ef4444' : '#f59e0b' },
    { label: 'Livability',    value: result.livability,    unit: '/100',icon: HiGlobe,       color: result.livability >= 70 ? '#00C853' : result.livability >= 40 ? '#f59e0b' : '#ef4444' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      className={`glass-card p-6 relative ${isWinner ? 'ring-2' : ''}`}
      style={isWinner ? { ringColor: accentColor, borderColor: accentColor } : {}}
    >
      {isWinner && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-white text-xs font-bold shadow-lg" style={{ background: accentColor }}>
          🏆 WINNER
        </div>
      )}
      <h3 className="text-lg font-display font-bold mb-4" style={{ color: accentColor }}>{name}</h3>
      <div className="grid grid-cols-2 gap-3">
        {metrics.map((m, i) => (
          <div key={i} className="p-3 rounded-xl bg-white/60 border border-dark-100 text-center">
            <m.icon className="w-5 h-5 mx-auto mb-1" style={{ color: m.color }} />
            <p className="text-[10px] text-dark-500 font-semibold uppercase tracking-wide">{m.label}</p>
            <p className="text-xl font-display font-bold mt-0.5" style={{ color: m.color }}>{m.value}{m.unit}</p>
          </div>
        ))}
      </div>

      {/* AQI sub-row */}
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-dark-500">
        <div className="p-2 rounded-lg bg-white/40 text-center">
          <span className="font-bold text-blue-600">Formula AQI: </span>{result.formulaAqi}
        </div>
        <div className="p-2 rounded-lg bg-white/40 text-center">
          <span className="font-bold text-violet-600">ML AQI: </span>{result.mlAqi}
        </div>
        <div className="p-2 rounded-lg bg-white/40 text-center">
          <span className="font-bold text-emerald-600">WQI Water: </span>{result.formulaWater.toFixed(1)}%
        </div>
        <div className="p-2 rounded-lg bg-white/40 text-center">
          <span className="font-bold text-teal-600">ML Water: </span>{result.mlWater.toFixed(1)}%
        </div>
      </div>
    </motion.div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function CityCompare() {
  const [city1Name, setCity1Name]   = useState('');
  const [city2Name, setCity2Name]   = useState('');
  const [form1, setForm1]           = useState({});
  const [form2, setForm2]           = useState({});
  const [loading, setLoading]       = useState(false);
  const [comparison, setComparison] = useState(null);
  const [error, setError]           = useState('');

  const handleCompare = async (e) => {
    e.preventDefault();
    if (!city1Name.trim() || !city2Name.trim()) { setError('Please enter both city names.'); return; }
    setError('');
    setLoading(true);
    try {
      const [r1, r2] = await Promise.all([analyseCity(form1), analyseCity(form2)]);
      setComparison({ city1: { name: city1Name.trim(), ...r1 }, city2: { name: city2Name.trim(), ...r2 } });
    } catch (err) {
      setError('Analysis failed. Make sure the ML service is running on port 5000.');
    } finally {
      setLoading(false);
    }
  };

  // Chart data
  const barData = comparison ? [
    { name: 'Avg AQI',        [comparison.city1.name]: comparison.city1.avgAqi,     [comparison.city2.name]: comparison.city2.avgAqi     },
    { name: 'Water Safety %', [comparison.city1.name]: comparison.city1.avgWater,   [comparison.city2.name]: comparison.city2.avgWater   },
    { name: 'Livability',     [comparison.city1.name]: comparison.city1.livability,  [comparison.city2.name]: comparison.city2.livability  },
    { name: 'Green Cover %',  [comparison.city1.name]: comparison.city1.greenCover,  [comparison.city2.name]: comparison.city2.greenCover  },
    { name: 'Waste Mgmt',     [comparison.city1.name]: comparison.city1.wasteMgmt * 10, [comparison.city2.name]: comparison.city2.wasteMgmt * 10 },
  ] : [];

  const radarData = comparison ? [
    { metric: 'Air Quality',    [comparison.city1.name]: Math.max(0, 100 - comparison.city1.avgAqi / 3),  [comparison.city2.name]: Math.max(0, 100 - comparison.city2.avgAqi / 3)  },
    { metric: 'Water Safety',   [comparison.city1.name]: comparison.city1.avgWater,                        [comparison.city2.name]: comparison.city2.avgWater                        },
    { metric: 'Livability',     [comparison.city1.name]: comparison.city1.livability,                      [comparison.city2.name]: comparison.city2.livability                      },
    { metric: 'Green Cover',    [comparison.city1.name]: comparison.city1.greenCover * 2,                  [comparison.city2.name]: comparison.city2.greenCover * 2                  },
    { metric: 'Waste Mgmt',     [comparison.city1.name]: comparison.city1.wasteMgmt * 10,                  [comparison.city2.name]: comparison.city2.wasteMgmt * 10                  },
    { metric: 'Health Safety',  [comparison.city1.name]: Math.max(0, 100 - comparison.city1.healthScore),  [comparison.city2.name]: Math.max(0, 100 - comparison.city2.healthScore)  },
  ] : [];

  const metricTable = comparison ? [
    { label: 'Avg AQI',       k1: comparison.city1.avgAqi,     k2: comparison.city2.avgAqi,     unit: '',    lowerBetter: true  },
    { label: 'Avg Water Safety', k1: comparison.city1.avgWater, k2: comparison.city2.avgWater,   unit: '%',   lowerBetter: false },
    { label: 'Livability',    k1: comparison.city1.livability,  k2: comparison.city2.livability,  unit: '/100',lowerBetter: false },
    { label: 'Green Cover',   k1: comparison.city1.greenCover,  k2: comparison.city2.greenCover,  unit: '%',   lowerBetter: false },
    { label: 'Waste Mgmt',    k1: comparison.city1.wasteMgmt,   k2: comparison.city2.wasteMgmt,   unit: '/10', lowerBetter: false },
    { label: 'Health Risk',   k1: comparison.city1.healthScore, k2: comparison.city2.healthScore, unit: '',    lowerBetter: true  },
  ] : [];

  const winner = comparison
    ? (comparison.city1.livability >= comparison.city2.livability ? comparison.city1 : comparison.city2)
    : null;

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div>
        <h1 className="section-title">City <span className="gradient-text">Comparison</span></h1>
        <p className="section-subtitle mt-2">Enter environmental parameters for two cities and compare them side-by-side using real AQI + Water Quality analysis</p>
      </div>

      {/* Form */}
      <form onSubmit={handleCompare}>
        <div className="grid lg:grid-cols-2 gap-6">
          <CityPanel
            label="City A" accentColor="#217344"
            formData={form1} setFormData={setForm1}
            cityName={city1Name} setCityName={setCity1Name}
          />
          <CityPanel
            label="City B" accentColor="#4656d0"
            formData={form2} setFormData={setForm2}
            cityName={city2Name} setCityName={setCity2Name}
          />
        </div>

        {error && (
          <p className="text-red-500 text-sm text-center mt-4 font-medium">{error}</p>
        )}

        <div className="flex justify-center mt-6">
          <motion.button
            type="submit"
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            disabled={loading}
            className="btn-primary flex items-center gap-2 px-8 py-3 text-base"
          >
            {loading ? (
              <><span className="animate-spin w-5 h-5 border-2 border-white/40 border-t-white rounded-full inline-block" /> Analysing…</>
            ) : (
              <><HiSparkles className="w-5 h-5" /> Compare Cities <HiArrowRight className="w-5 h-5" /></>
            )}
          </motion.button>
        </div>
      </form>

      {/* Results */}
      <AnimatePresence>
        {comparison && (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-8"
          >
            {/* Winner banner */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="glass-card p-8 text-center gradient-bg text-white"
            >
              <p className="text-white/70 text-sm font-medium mb-1">🏆 Better City to Live In</p>
              <h2 className="font-display text-4xl font-bold">{winner.name}</h2>
              <p className="text-white/70 text-sm mt-2">
                Livability Score: <strong className="text-white">{winner.livability}/100</strong> &nbsp;·&nbsp;
                Avg AQI: <strong className="text-white">{winner.avgAqi}</strong> &nbsp;·&nbsp;
                Avg Water Safety: <strong className="text-white">{winner.avgWater}%</strong>
              </p>
            </motion.div>

            {/* Side-by-side summary cards */}
            <div className="grid md:grid-cols-2 gap-6">
              <CityResultCard
                name={comparison.city1.name}
                result={comparison.city1}
                accentColor="#217344"
                isWinner={winner.name === comparison.city1.name}
              />
              <CityResultCard
                name={comparison.city2.name}
                result={comparison.city2}
                accentColor="#4656d0"
                isWinner={winner.name === comparison.city2.name}
              />
            </div>

            {/* Metric comparison table */}
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="glass-card overflow-hidden"
            >
              <div className="grid grid-cols-[1fr,2fr,1fr] text-center">
                <div className="p-4 font-display font-bold text-enviro-600 bg-enviro-50/50">{comparison.city1.name}</div>
                <div className="p-4 font-semibold text-dark-700 bg-dark-50/50">Metric</div>
                <div className="p-4 font-display font-bold text-indigo-600 bg-indigo-50/50">{comparison.city2.name}</div>
              </div>
              {metricTable.map((row, i) => {
                const c1wins = row.lowerBetter ? row.k1 < row.k2 : row.k1 > row.k2;
                const c2wins = row.lowerBetter ? row.k2 < row.k1 : row.k2 > row.k1;
                return (
                  <div key={i} className="grid grid-cols-[1fr,2fr,1fr] text-center border-t border-dark-200/20">
                    <div className={`p-4 font-bold text-lg ${c1wins ? 'text-enviro-600' : 'text-dark-500'}`}>
                      {typeof row.k1 === 'number' ? row.k1.toFixed?.(1) ?? row.k1 : row.k1}{row.unit}
                      {c1wins && <span className="ml-1 text-xs">✓</span>}
                    </div>
                    <div className="p-4 text-dark-500 text-sm font-medium flex items-center justify-center gap-1">
                      {row.label}
                      {row.lowerBetter && <span className="text-xs text-dark-400">(lower=better)</span>}
                    </div>
                    <div className={`p-4 font-bold text-lg ${c2wins ? 'text-indigo-600' : 'text-dark-500'}`}>
                      {typeof row.k2 === 'number' ? row.k2.toFixed?.(1) ?? row.k2 : row.k2}{row.unit}
                      {c2wins && <span className="ml-1 text-xs">✓</span>}
                    </div>
                  </div>
                );
              })}
            </motion.div>

            {/* Charts */}
            <div className="grid lg:grid-cols-2 gap-6">
              <motion.div
                initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                className="glass-card p-8"
              >
                <h3 className="font-display text-lg font-bold text-dark-900 mb-6">Bar Comparison</h3>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={barData} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#94a3b8' }} />
                    <Tooltip contentStyle={{ backgroundColor: 'rgba(255,255,255,0.95)', border: '1px solid rgba(100,116,139,0.2)', borderRadius: '12px', color: '#1e293b' }} />
                    <Legend />
                    <Bar dataKey={comparison.city1.name} fill="#217344" radius={[6, 6, 0, 0]} />
                    <Bar dataKey={comparison.city2.name} fill="#4656d0" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                className="glass-card p-8"
              >
                <h3 className="font-display text-lg font-bold text-dark-900 mb-6">Radar Overview</h3>
                <ResponsiveContainer width="100%" height={320}>
                  <RadarChart data={radarData}>
                    <PolarGrid strokeDasharray="3 3" className="opacity-30" />
                    <PolarAngleAxis dataKey="metric" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <PolarRadiusAxis tick={{ fill: '#94a3b8' }} domain={[0, 100]} />
                    <Radar name={comparison.city1.name} dataKey={comparison.city1.name} stroke="#217344" fill="#217344" fillOpacity={0.25} />
                    <Radar name={comparison.city2.name} dataKey={comparison.city2.name} stroke="#4656d0" fill="#4656d0" fillOpacity={0.25} />
                    <Legend />
                    <Tooltip />
                  </RadarChart>
                </ResponsiveContainer>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
