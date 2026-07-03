import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, AreaChart, Area, ReferenceLine,
} from 'recharts';
import {
  HiSparkles, HiDownload, HiArrowLeft, HiTrendingUp, HiTrendingDown,
  HiLocationMarker, HiRefresh, HiHeart, HiShieldCheck, HiExclamation,
} from 'react-icons/hi';
import { Link } from 'react-router-dom';
import html2pdf from 'html2pdf.js';

// ── Helpers ───────────────────────────────────────────────────────────────────
function getAqiColor(v) {
  if (v <= 50) return '#00C853';
  if (v <= 100) return '#64DD17';
  if (v <= 200) return '#FFA500';
  if (v <= 300) return '#FF5722';
  return '#B71C1C';
}
function getWaterColor(v) { return v >= 70 ? '#00C853' : v >= 50 ? '#FFA500' : '#ef4444'; }
function getLivColor(v) { return v >= 70 ? '#00C853' : v >= 40 ? '#FFA500' : '#ef4444'; }

function getAqiCategory(v) {
  if (v <= 50) return 'Good';
  if (v <= 100) return 'Satisfactory';
  if (v <= 200) return 'Moderate';
  if (v <= 300) return 'Poor';
  if (v <= 400) return 'Very Poor';
  return 'Severe';
}

const RISK_CONFIG = {
  High: { bg: 'bg-red-50', border: 'border-red-200', badge: 'bg-red-100 text-red-700', dot: '#ef4444', icon: HiExclamation },
  Moderate: { bg: 'bg-amber-50', border: 'border-amber-200', badge: 'bg-amber-100 text-amber-700', dot: '#f59e0b', icon: HiShieldCheck },
  Low: { bg: 'bg-green-50', border: 'border-green-200', badge: 'bg-green-100 text-green-700', dot: '#10b981', icon: HiShieldCheck },
};

const AGE_ICONS = {
  'Children (0-14 yrs)': '👶',
  'Children (0–14 yrs)': '👶',
  'Young Adults (15-25 yrs)': '🧑',
  'Young Adults (15–25 yrs)': '🧑',
  'Adults (26-60 yrs)': '🧑‍💼',
  'Adults (26–60 yrs)': '🧑‍💼',
  'Elderly (60+ yrs)': '👴',
};

// ── Single disease detail row ─────────────────────────────────────────────────
function DiseaseRow({ name, description, prevention, color }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-white/80 bg-white/50 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3.5 py-2.5 text-left hover:bg-white/80 transition-colors"
      >
        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
        <span className="text-sm font-semibold text-dark-800 flex-1">{name}</span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-dark-400 text-xs"
        >▼</motion.span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-3.5 pb-3 space-y-2.5 border-t border-dark-100/40 pt-2.5">
              {/* Description */}
              <div className="flex items-start gap-2">
                <HiExclamation className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                <p className="text-xs text-dark-600 leading-relaxed">{description}</p>
              </div>
              {/* Prevention */}
              <div className="flex items-start gap-2 bg-enviro-50/60 rounded-lg p-2.5 border border-enviro-100/50">
                <HiShieldCheck className="w-3.5 h-3.5 text-enviro-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-enviro-600 mb-0.5">Prevention</p>
                  <p className="text-xs text-dark-700 leading-relaxed">{prevention}</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Disease category section (Air or Water) ───────────────────────────────────
function DiseaseCategorySection({ title, icon, iconColor, diseases = [], dotColor }) {
  if (!diseases.length) return null;
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-base">{icon}</span>
        <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: iconColor }}>{title}</p>
        <span className="text-[10px] text-dark-400 font-medium ml-auto">{diseases.length} condition{diseases.length > 1 ? 's' : ''}</span>
      </div>
      <div className="space-y-1.5">
        {diseases.map((d, i) => (
          <DiseaseRow key={i} name={d.name} description={d.description} prevention={d.prevention} color={dotColor} />
        ))}
      </div>
    </div>
  );
}

// ── Age group health card ─────────────────────────────────────────────────────
function AgeGroupCard({ group, risk_level, air_diseases = [], water_diseases = [], conditions = [], recommendation, general_advice, index }) {
  const cfg = RISK_CONFIG[risk_level] || RISK_CONFIG.Moderate;
  const Icon = cfg.icon;
  const emoji = AGE_ICONS[group] || '👤';

  // Backward compat: if old format (conditions array), show legacy view
  const hasNewFormat = air_diseases.length > 0 || water_diseases.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className={`p-5 rounded-2xl border ${cfg.bg} ${cfg.border} flex flex-col gap-4`}
    >
      {/* header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{emoji}</span>
          <span className="font-bold text-dark-800 text-sm">{group}</span>
        </div>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1 ${cfg.badge}`}>
          <Icon className="w-3 h-3" /> {risk_level} Risk
        </span>
      </div>

      {hasNewFormat ? (
        <>
          {/* Air-related diseases */}
          <DiseaseCategorySection
            title="Air-Related Issues"
            icon="🌫️"
            iconColor="#6366f1"
            diseases={air_diseases}
            dotColor="#6366f1"
          />

          {/* Water-related diseases */}
          <DiseaseCategorySection
            title="Water-Related Issues"
            icon="💧"
            iconColor="#0ea5e9"
            diseases={water_diseases}
            dotColor="#0ea5e9"
          />

          {/* General advice */}
          {general_advice && (
            <div className="flex items-start gap-2 bg-white/60 rounded-xl p-3 border border-white mt-1">
              <HiShieldCheck className="w-4 h-4 text-enviro-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-enviro-600 mb-0.5">General Advice</p>
                <p className="text-xs text-dark-600 leading-relaxed">{general_advice}</p>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          {/* Legacy: conditions list */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-dark-400 mb-1.5">Possible Conditions</p>
            <div className="flex flex-wrap gap-1.5">
              {conditions.map((c, i) => (
                <span key={i} className="text-xs bg-white/80 border border-dark-100 rounded-full px-2.5 py-0.5 text-dark-700 font-medium">
                  {c}
                </span>
              ))}
            </div>
          </div>
          {recommendation && (
            <div className="flex items-start gap-2 bg-white/60 rounded-xl p-3 border border-white">
              <HiShieldCheck className="w-4 h-4 text-enviro-500 mt-0.5 shrink-0" />
              <p className="text-xs text-dark-600 leading-relaxed">{recommendation}</p>
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}


// ── Main component ────────────────────────────────────────────────────────────
export default function Predictions() {
  const [city, setCity] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [baseValues, setBaseValues] = useState(null);

  // Groq health analysis state
  const [health, setHealth] = useState(null);
  const [healthLoading, setHL] = useState(false);
  const [healthError, setHE] = useState('');

  const reportRef = useRef(null);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('envirocheck-results') || '{}');
      if (!stored?.city) return;

      setCity(stored.city);

      const gAqi = stored?.aqi?.general?.value ?? stored?.aqi?.value ?? 150;
      const mAqi = stored?.aqi?.adjusted?.value ?? stored?.aqi?.value ?? 150;
      const avgAqi = Math.round((gAqi + mAqi) / 2);

      const base = {
        aqi: avgAqi,
        water: stored?.waterSafety?.score ?? 65,
        livability: stored?.livability?.score ?? 55,
        green: parseFloat(stored?.inputData?.green_cover || stored?.inputData?.greenCover || 20),
      };
      setBaseValues(base);
      runForecast(stored.city, base);
      runHealthAnalysis(stored.city, avgAqi, stored?.waterSafety?.score ?? 65);
    } catch (_) { }
  }, []);

  const runForecast = async (cityName, base) => {
    setLoading(true);
    setError('');
    setData(null);
    try {
      const res = await fetch('http://localhost:5000/predict/forecast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(base),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (e) {
      setError(`Forecast failed: ${e.message}. Make sure the ML service is running on port 5000.`);
    } finally {
      setLoading(false);
    }
  };

  const runHealthAnalysis = async (cityName, aqi, water) => {
    setHL(true);
    setHE('');
    setHealth(null);
    try {
      const res = await fetch('http://localhost:5000/predict/health-impact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aqi,
          water,
          city: cityName,
          aqi_category: getAqiCategory(aqi),
        }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setHealth(json);
    } catch (e) {
      setHE(e.message);
    } finally {
      setHL(false);
    }
  };

  const handleRerun = () => {
    if (!baseValues) return;
    runForecast(city, baseValues);
    runHealthAnalysis(city, baseValues.aqi, baseValues.water);
  };

  const handleDownloadPDF = () => {
    if (!reportRef.current) return;
    html2pdf().set({
      margin: [0.5, 0.5, 0.5, 0.5],
      filename: `${city}_Environmental_Forecast.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
    }).from(reportRef.current).save();
  };

  // Build chart timeline: base year (2025) + 5 predicted years
  const timeline = data && baseValues ? [
    { year: 2025, aqi: baseValues.aqi, water: baseValues.water, livability: baseValues.livability, green: baseValues.green },
    ...data.predictions.map(p => ({ ...p })),
  ] : [];

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Link to="/results" className="inline-flex items-center gap-1 text-sm text-enviro-600 hover:underline mb-2">
            <HiArrowLeft className="w-4 h-4" /> Back to Results
          </Link>
          <h1 className="section-title">Future <span className="gradient-text">Predictions</span></h1>
          <p className="section-subtitle mt-2 flex items-center gap-2">
            <HiLocationMarker className="w-4 h-4 text-enviro-500" />
            <span className="font-semibold text-dark-700">{city || 'Your City'}</span>
            <span className="text-dark-400">— ML Timeseries Forecasting (5-year)</span>
          </p>
        </div>
        <div className="flex gap-3">
          {baseValues && (
            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              onClick={handleRerun} className="btn-secondary flex items-center gap-2">
              <HiRefresh className="w-4 h-4" /> Re-run
            </motion.button>
          )}
          {data && (
            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              onClick={handleDownloadPDF} className="btn-secondary flex items-center gap-2">
              <HiDownload className="w-5 h-5" /> Download PDF
            </motion.button>
          )}
        </div>
      </div>

      {/* No data prompt */}
      {!baseValues && !loading && (
        <div className="glass-card p-12 text-center">
          <p className="text-dark-500 mb-4 text-lg">Run a Dashboard analysis first to seed the forecasting models.</p>
          <Link to="/dashboard" className="btn-primary inline-flex gap-2 items-center">Go to Dashboard</Link>
        </div>
      )}

      {/* Forecast Loading */}
      {loading && (
        <div className="glass-card p-16 text-center">
          <div className="animate-spin w-12 h-12 border-4 border-enviro-200 border-t-enviro-500 rounded-full mx-auto mb-6" />
          <p className="text-dark-600 font-semibold text-lg">Generating 5-Year Environmental Forecast...</p>
          <p className="text-dark-400 text-sm mt-2">Running localized projections based on your city's parameters. This may take a moment.</p>
        </div>
      )}

      {/* Forecast Error */}
      {error && (
        <div className="glass-card p-6 border-l-4 border-red-500 bg-red-50/30">
          <p className="text-red-600 font-semibold">{error}</p>
        </div>
      )}

      {/* Results */}
      <AnimatePresence>
        {data && !loading && (
          <motion.div key="results" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8" ref={reportRef}>

            {/* Summary prediction cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'AQI by 2030', cur: baseValues.aqi, fut: data.predictions[4]?.aqi, unit: '', lowerBetter: true, getC: getAqiColor },
                { label: 'Water Safety 2030', cur: baseValues.water, fut: data.predictions[4]?.water, unit: '%', lowerBetter: false, getC: getWaterColor },
                { label: 'Livability 2030', cur: baseValues.livability, fut: data.predictions[4]?.livability, unit: '/100', lowerBetter: false, getC: getLivColor },
                { label: 'Green Cover 2030', cur: baseValues.green, fut: data.predictions[4]?.green, unit: '%', lowerBetter: false, getC: () => '#10b981' },
              ].map((item, i) => {
                const change = (item.fut ?? 0) - item.cur;
                const improved = item.lowerBetter ? change < 0 : change > 0;
                return (
                  <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                    className="glass-card p-5">
                    <p className="text-xs font-medium text-dark-500 mb-2">{item.label}</p>
                    <p className="font-display text-3xl font-bold" style={{ color: item.getC(item.fut ?? 0) }}>
                      {Math.round(item.fut ?? 0)}{item.unit}
                    </p>
                    <p className={`text-xs font-semibold mt-1 flex items-center gap-1 ${improved ? 'text-green-600' : 'text-red-500'}`}>
                      {improved ? <HiTrendingUp className="w-3.5 h-3.5" /> : <HiTrendingDown className="w-3.5 h-3.5" />}
                      {improved ? '+' : ''}{change.toFixed(1)} from {Math.round(item.cur)}{item.unit} today
                    </p>
                  </motion.div>
                );
              })}
            </div>

            {/* AQI & Livability chart */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-8">
              <h3 className="font-display text-lg font-bold text-dark-900 mb-6">AQI &amp; Livability Forecast</h3>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={timeline}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="year" tick={{ fill: '#94a3b8' }} />
                  <YAxis tick={{ fill: '#94a3b8' }} />
                  <Tooltip contentStyle={{ backgroundColor: 'rgba(255,255,255,0.95)', border: '1px solid rgba(100,116,139,0.2)', borderRadius: '12px', color: '#1e293b' }} />
                  <Legend />
                  <ReferenceLine x={2025} stroke="#94a3b8" strokeDasharray="4 4" label={{ value: 'Current', fill: '#94a3b8', fontSize: 11 }} />
                  <Line type="monotone" dataKey="aqi" stroke="#4656d0" strokeWidth={3} dot={{ r: 5 }} name="AQI" />
                  <Line type="monotone" dataKey="livability" stroke="#217344" strokeWidth={3} dot={{ r: 5 }} name="Livability" />
                </LineChart>
              </ResponsiveContainer>
            </motion.div>

            {/* Water & Green chart */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-8">
              <h3 className="font-display text-lg font-bold text-dark-900 mb-6">Water Safety &amp; Green Cover Forecast</h3>
              <ResponsiveContainer width="100%" height={350}>
                <AreaChart data={timeline}>
                  <defs>
                    <linearGradient id="waterG" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="greenG" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="year" tick={{ fill: '#94a3b8' }} />
                  <YAxis tick={{ fill: '#94a3b8' }} />
                  <Tooltip contentStyle={{ backgroundColor: 'rgba(255,255,255,0.95)', border: '1px solid rgba(100,116,139,0.2)', borderRadius: '12px', color: '#1e293b' }} />
                  <Legend />
                  <ReferenceLine x={2025} stroke="#94a3b8" strokeDasharray="4 4" />
                  <Area type="monotone" dataKey="water" stroke="#0ea5e9" strokeWidth={2} fill="url(#waterG)" name="Water Safety %" />
                  <Area type="monotone" dataKey="green" stroke="#10b981" strokeWidth={2} fill="url(#greenG)" name="Green Cover %" />
                </AreaChart>
              </ResponsiveContainer>
            </motion.div>

            {/* ── Groq AI Health Impact Analysis ─────────────────────────── */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-8">
              <div className="flex items-center justify-between mb-6 border-b pb-4">
                <h3 className="font-display text-lg font-bold text-dark-900 flex items-center gap-2">
                  <HiHeart className="w-5 h-5 text-red-500" />
                  Health Impact Analysis — <span className="text-enviro-600">{city}</span>
                </h3>
                <div className="flex items-center gap-2 text-xs text-dark-400">
                  <HiSparkles className="w-3.5 h-3.5 text-violet-500" />
                  <span>AI-powered · Based on current AQI &amp; Water Safety</span>
                </div>
              </div>

              {/* Health loading */}
              {healthLoading && (
                <div className="flex items-center gap-3 py-8 justify-center">
                  <div className="animate-spin w-6 h-6 border-2 border-enviro-200 border-t-enviro-500 rounded-full" />
                  <p className="text-dark-500 text-sm">Analysing health risks with AI...</p>
                </div>
              )}

              {/* Health error */}
              {healthError && !healthLoading && (
                <div className="p-4 rounded-xl bg-red-50 border border-red-200">
                  <p className="text-red-600 text-sm font-semibold mb-1">Health analysis unavailable</p>
                  <p className="text-red-500 text-xs">{healthError}</p>
                  <p className="text-dark-500 text-xs mt-2">Add your <code className="bg-dark-100 px-1 rounded">GROQ_API_KEY</code> in <code className="bg-dark-100 px-1 rounded">ml-service/.env</code> and restart the server.</p>
                </div>
              )}

              {/* Health results */}
              {health && !healthLoading && (
                <div className="space-y-5">
                  {/* Overall summary banner */}
                  <div className="p-4 rounded-xl bg-gradient-to-r from-enviro-50 to-blue-50 border border-enviro-200/50 flex items-start gap-3">
                    <HiShieldCheck className="w-5 h-5 text-enviro-500 shrink-0 mt-0.5" />
                    <p className="text-dark-700 text-sm font-medium leading-relaxed">{health.overall_summary}</p>
                  </div>

                  {/* Age group cards grid */}
                  <div className="grid md:grid-cols-2 gap-4">
                    {health.age_groups?.map((ag, i) => (
                      <AgeGroupCard key={i} {...ag} index={i} />
                    ))}
                  </div>
                </div>
              )}
            </motion.div>

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
