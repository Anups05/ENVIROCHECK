import { useState, useEffect, useMemo } from 'react';
import { calculateWQI } from '../utils/wqiCalculator';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, RadialBarChart, RadialBar, Legend
} from 'recharts';
import { HiChartBar, HiShieldCheck, HiHeart, HiGlobe, HiArrowLeft, HiDocumentText, HiCloud, HiBeaker } from 'react-icons/hi';

const COLORS = ['#217344', '#4656d0', '#f59e0b', '#ef4444', '#8b5cf6'];

function GaugeChart({ value, max = 100, label, color = '#217344' }) {
  const percentage = (value / max) * 100;
  const radius = 80;
  const circumference = Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <svg width="200" height="120" viewBox="0 0 200 120">
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke="currentColor"
          className="text-dark-200"
          strokeWidth="16"
          strokeLinecap="round"
        />
        <motion.path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke={color}
          strokeWidth="16"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
        />
        <text x="100" y="85" textAnchor="middle" className="fill-dark-900 font-display font-bold" fontSize="32">
          {value}
        </text>
        <text x="100" y="108" textAnchor="middle" className="fill-dark-500" fontSize="12">
          {label}
        </text>
      </svg>
    </div>
  );
}

function StatusBadge({ status }) {
  const config = {
    Safe:        { class: 'status-safe',    icon: '✓' },
    Unsafe:      { class: 'status-danger',  icon: '✗' },
    Low:         { class: 'status-safe',    icon: '↓' },
    Medium:      { class: 'status-warning', icon: '→' },
    High:        { class: 'status-danger',  icon: '↑' },
    Excellent:   { class: 'status-safe',    icon: '✓' },
    Good:        { class: 'status-safe',    icon: '✓' },
    Moderate:    { class: 'status-warning', icon: '~' },
    Poor:        { class: 'status-warning', icon: '~' },
    'Very Poor': { class: 'status-danger',  icon: '✗' },
    Unsuitable:  { class: 'status-danger',  icon: '✗' },
    'Unhealthy for Sensitive': { class: 'status-warning', icon: '!' },
    Unhealthy:   { class: 'status-danger',  icon: '✗' },
    'Very Unhealthy': { class: 'status-danger', icon: '✗✗' },
  };
  const { class: cls, icon } = config[status] || { class: 'status-warning', icon: '?' };
  return <span className={cls}>{icon} {status}</span>;
}

/** Formula-based Water Quality Index card */
function WqiCard({ inputData }) {
  const wqi = useMemo(() => {
    if (!inputData) return null;
    return calculateWQI(inputData);
  }, [inputData]);

  if (!wqi) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="glass-card p-8 bg-gradient-to-br from-teal-500/10 to-emerald-500/10 border-2 border-teal-200/60"
      >
        <p className="text-xs font-bold text-teal-600 uppercase tracking-widest mb-1">📐 Formula Based</p>
        <p className="text-sm text-dark-600 font-bold mb-2">Water Safety % (WHO/BIS WQI)</p>
        <p className="text-dark-400 text-sm mt-4">No water parameters found. Submit data from the Dashboard first.</p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
      className="glass-card p-8 bg-gradient-to-br from-teal-500/10 to-emerald-500/10 border-2 border-teal-200/60"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="w-16 h-16 rounded-2xl bg-white/60 flex items-center justify-center shadow-sm">
          <HiBeaker className="w-10 h-10" style={{ color: wqi.color }} />
        </div>
        <StatusBadge status={wqi.category} />
      </div>
      <p className="text-sm text-dark-600 font-bold mb-2">Water Safety Score</p>
      <p className="text-5xl font-display font-bold mt-1" style={{ color: wqi.color }}>
        {wqi.safetyPct}%
      </p>

      {/* Mini per-parameter bar chart */}
      <div className="mt-4 space-y-1.5">
        {wqi.paramRatings.map(({ key, qi }) => {
          const pct   = Math.min(100, Math.max(0, Math.abs(qi)));
          const color = qi > 100 ? '#B71C1C' : qi > 75 ? '#FF5722' : qi > 50 ? '#FFA500' : '#00C853';
          return (
            <div key={key} className="flex items-center gap-2">
              <span className="text-xs text-dark-500 w-24 capitalize">{key.replace('_', ' ')}</span>
              <div className="flex-1 h-1.5 bg-dark-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
              </div>
              <span className="text-xs text-dark-500 w-10 text-right">{qi.toFixed(0)}</span>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-dark-400 mt-3">Calculated from 9 potability parameters (WHO/BIS standards)</p>
    </motion.div>
  );
}

export default function Results() {
  const navigate = useNavigate();
  const [results, setResults] = useState(null);
  const [aiSuggestions, setAiSuggestions] = useState(null);

  useEffect(() => {
    const stored = localStorage.getItem('envirocheck-results');
    if (stored) {
      setResults(JSON.parse(stored));
    } else {
      setResults({
        city: 'Mumbai',
        timestamp: new Date().toISOString(),
        aqi: { value: 142, category: 'Unhealthy for Sensitive' },
        waterSafety: { safe: true, score: 78 },
        livability: { score: 65 },
        healthRisk: { level: 'Medium', score: 52 },
      });
    }
  }, []);

  useEffect(() => {
    if (results && results.inputData && !aiSuggestions) {
      fetch('http://localhost:5000/predict/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(results.inputData)
      })
        .then(res => res.json())
        .then(data => {
          if (data.suggestions) {
            setAiSuggestions(data.suggestions);
          } else {
            console.warn(data.error);
            setAiSuggestions(['⚠️ Failed to load AI suggestions.']);
          }
        })
        .catch(err => {
          console.error(err);
          setAiSuggestions(['⚠️ Could not connect to AI service.']);
        });
    }
  }, [results]);

  const handleGenerateReport = () => {
    if (!results) return;
    const savedReports = JSON.parse(localStorage.getItem('envirocheck-reports') || '[]');
    const newReport = {
      id: Date.now(),
      city: results.city,
      date: new Date().toISOString(),
      aqi: results.aqi?.value || 0,
      aqiCategory: results.aqi?.category || 'N/A',
      waterSafe: results.waterSafety?.safe ?? false,
      waterScore: results.waterSafety?.score || 0,
      livability: results.livability?.score || 0,
      healthRisk: results.healthRisk?.level || 'Medium',
      suggestions: [
        '🌿 Increase urban green cover by 15-20% to reduce particulate matter levels.',
        '💧 Upgrade water treatment facilities for better purification.',
        '🏙️ Prioritize pedestrian zones and reduce vehicular density.',
        '📊 Schedule quarterly environmental assessments.',
        '🌱 Promote renewable energy adoption citywide.'
      ],
      risks: [
        { type: 'Air Pollution', severity: (results.aqi?.value || 0) > 100 ? 'High' : 'Moderate', description: 'Particulate matter levels affect respiratory health.' },
        { type: 'Water Contamination', severity: results.waterSafety?.safe ? 'Low' : 'High', description: 'Chemical composition requiring monitoring.' },
        { type: 'Urban Density', severity: 'Moderate', description: 'Population impact on environmental resources.' },
      ],
    };
    const updated = [newReport, ...savedReports];
    localStorage.setItem('envirocheck-reports', JSON.stringify(updated));
    navigate('/reports');
  };

  if (!results) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <p className="text-dark-500 dark:text-dark-400 text-lg">No results available.</p>
          <Link to="/dashboard" className="btn-primary inline-block mt-4">Go to Dashboard</Link>
        </div>
      </div>
    );
  }

  const getAqiColor = (val) => {
    if (val <= 50)  return '#00C853';
    if (val <= 100) return '#64DD17';
    if (val <= 200) return '#FFA500';
    if (val <= 300) return '#FF5722';
    if (val <= 400) return '#B71C1C';
    return '#6A1B9A';
  };

  // ── Deterministic trend — NO Math.random(), seeded from actual inputs ────
  const aqiBase        = results.aqi?.adjusted?.value ?? results.aqi?.value ?? 100;
  const generalAqiBase = results.aqi?.general?.value  ?? results.aqi?.value ?? 100;
  const livabilityBase = results.livability?.score ?? 70;

  const inp = results.inputData || {};
  const avgAqi = Math.round((generalAqiBase + aqiBase) / 2);
  const avgWater = Math.round(((results.waterSafety?.score || 0) + (results.inputData ? calculateWQI(results.inputData).safetyPct : results.waterSafety?.score || 0)) / 2);

  const trendData = Array.from({ length: 12 }, (_, i) => {
    const month = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][i];
    // Seasonal swing: peaks mid-year (summer smog), dips Jan/Dec
    const swing = Math.round(Math.sin((i / 11) * Math.PI) * 18);
    // Water safety fluctuates slightly by season
    const waterSwing = Math.round(Math.cos((i / 11) * Math.PI) * 5);
    return {
      month,
      'ML AQI':      Math.max(10, Math.min(500, aqiBase + swing)),
      'Formula AQI': Math.max(10, Math.min(500, generalAqiBase + swing)),
      'Livability':  Math.min(100, Math.max(10, livabilityBase - Math.round(swing / 4))),
      'Water Safety': Math.min(100, Math.max(0, avgWater + waterSwing)),
    };
  });

  const barData = [
    { name: 'AQI',          value: avgAqi,                             fill: getAqiColor(avgAqi) },
    { name: 'Water Safety', value: avgWater,                           fill: '#217344' },
    { name: 'Livability',   value: results.livability?.score || 0,     fill: '#4656d0' },
    { name: 'Risk',         value: 100-(results.healthRisk?.score||0), fill: '#8b5cf6' },
  ];

  // Pie: use actual AQI input fields when available
  const pieData = [
    { name: 'Particulates', value: Math.max(5, (parseFloat(inp.pm25||0)*0.5)+(parseFloat(inp.pm10||0)*0.3)) },
    { name: 'Gases',        value: Math.max(5, (parseFloat(inp.no2||0)*0.3)+(parseFloat(inp.so2||0)*0.3)+(parseFloat(inp.o3||0)*0.2)+(parseFloat(inp.nh3||0)*0.2)) },
    { name: 'Urban Stress', value: Math.max(5, (parseFloat(inp.traffic_density||inp.trafficDensity||3000)/100) + parseFloat(inp.industrial_activity||inp.industrialActivity||0)) },
    { name: 'Green Buffer', value: Math.max(5, parseFloat(inp.green_cover||inp.greenCover||20)) },
  ];

  const metricCards = [
    {
      title: 'AQI Score',
      value: results.aqi?.value || 0,
      status: results.aqi?.category || 'Moderate',
      icon: HiChartBar,
      color: getAqiColor(results.aqi?.value || 0),
      gradient: 'from-blue-500/10 to-cyan-500/10',
    },
    {
      title: 'Water Safety',
      value: `${results.waterSafety?.score || 0}%`,
      status: results.waterSafety?.safe ? 'Safe' : 'Unsafe',
      icon: HiShieldCheck,
      color: results.waterSafety?.safe ? '#217344' : '#ef4444',
      gradient: 'from-enviro-500/10 to-teal-500/10',
    },
    {
      title: 'Health Risk',
      value: results.healthRisk?.level || 'Medium',
      status: results.healthRisk?.level || 'Medium',
      icon: HiHeart,
      color: (results.healthRisk?.level === 'Low' ? '#217344' : results.healthRisk?.level === 'High' ? '#ef4444' : '#f59e0b'),
      gradient: 'from-amber-500/10 to-orange-500/10',
    },
    {
      title: 'Livability',
      value: `${results.livability?.score || 0}/100`,
      status: (results.livability?.score || 0) >= 70 ? 'Good' : (results.livability?.score || 0) >= 40 ? 'Moderate' : 'Low',
      icon: HiGlobe,
      color: (results.livability?.score || 0) >= 70 ? '#217344' : (results.livability?.score || 0) >= 40 ? '#f59e0b' : '#ef4444',
      gradient: 'from-purple-500/10 to-pink-500/10',
    },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-enviro-600 hover:underline mb-2">
            <HiArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Link>
          <h1 className="section-title">
            Results for <span className="gradient-text">{results.city}</span>
          </h1>
          <p className="text-dark-500 text-sm mt-1">
            Analyzed on {new Date(results.timestamp).toLocaleString()}
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={handleGenerateReport}
          className="btn-primary flex items-center gap-2"
        >
          <HiDocumentText className="w-5 h-5" />
          Generate Report
        </motion.button>
      </div>

      {/* Top Priority Metrics — Formula AQI | ML AQI | ML Water | Formula WQI */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {/* General AQI — pure formula from pollutant inputs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="glass-card p-8 bg-gradient-to-br from-sky-500/10 to-cyan-500/10 border-2 border-sky-200/60"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-16 h-16 rounded-2xl bg-white/60 flex items-center justify-center shadow-sm">
              <HiChartBar className="w-10 h-10" style={{ color: getAqiColor(results.aqi?.general?.value ?? results.aqi?.value ?? 0) }} />
            </div>
            <StatusBadge status={results.aqi?.general?.category ?? results.aqi?.category ?? 'Moderate'} />
          </div>
          <p className="text-sm text-dark-600 font-bold mb-2">AQI Score</p>
          <p className="text-5xl font-display font-bold mt-1" style={{ color: getAqiColor(results.aqi?.general?.value ?? 0) }}>
            {results.aqi?.general?.value ?? results.aqi?.value ?? 0}
          </p>
          <p className="text-xs text-dark-400 mt-2">Calculated from: PM2.5, PM10, NO₂, SO₂, CO, O₃</p>
          <Link to="/aqi-details" className="text-xs text-sky-600 font-bold hover:underline mt-3 inline-block">
            View Calculation Breakdown →
          </Link>
        </motion.div>

        {/* ML AQI — from trained XGBoost/RF model */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="glass-card p-8 bg-gradient-to-br from-violet-500/10 to-purple-500/10 border-2 border-violet-200/60"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-16 h-16 rounded-2xl bg-white/60 flex items-center justify-center shadow-sm">
              <HiChartBar className="w-10 h-10" style={{ color: getAqiColor(results.aqi?.adjusted?.value ?? results.aqi?.value ?? 0) }} />
            </div>
            <StatusBadge status={results.aqi?.adjusted?.category ?? results.aqi?.category ?? 'Moderate'} />
          </div>
          <p className="text-sm text-dark-600 font-bold mb-2">Forecasted AQI</p>
          <p className="text-5xl font-display font-bold mt-1" style={{ color: results.aqi?.color || getAqiColor(results.aqi?.adjusted?.value ?? 0) }}>
            {results.aqi?.adjusted?.value ?? results.aqi?.value ?? 0}
          </p>
          <p className="text-xs text-dark-400 mt-2">Uses 15 features incl. Traffic & Urban factors</p>
        </motion.div>

        {/* ML Predicted — Water Quality + WHO/BIS WQI % */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="glass-card p-8 bg-gradient-to-br from-teal-500/10 to-emerald-500/10 border-2 border-teal-200/60"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-16 h-16 rounded-2xl bg-white/60 flex items-center justify-center shadow-sm">
              <HiBeaker className="w-10 h-10" style={{ color: results.waterSafety?.color || '#64DD17' }} />
            </div>
            <StatusBadge status={results.waterSafety?.category || 'Good'} />
          </div>
          <p className="text-sm text-dark-600 font-bold mb-2">Forecasted Water Safety</p>
          <p className="text-5xl font-display font-bold mt-1" style={{ color: results.waterSafety?.color || '#64DD17' }}>
            {results.waterSafety?.score ?? 0}%
          </p>
          <p className="text-xs text-dark-400 mt-2">Calculated from 9 environmental metrics</p>
        </motion.div>

        {/* Formula-Based WQI Water Safety card */}
        <WqiCard inputData={results.inputData} />
      </div>

      {/* Main Report Section */}
      <div className="pt-8 border-t border-dark-200/50">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-display font-bold text-dark-900">
            Calculated Report Affected by <span className="gradient-text">Environmental Parameters</span>
          </h2>
          <p className="text-dark-500 text-sm mt-2">Comprehensive impact analysis factoring in 18 mandatory inputs</p>
        </div>

        <div className="space-y-8">
          {/* Adjusted / ML Metrics Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                title: 'AQI',
                value: Math.round(((results.aqi?.general?.value ?? results.aqi?.value ?? 0) + (results.aqi?.adjusted?.value ?? results.aqi?.value ?? 0)) / 2),
                status: results.aqi?.adjusted?.category ?? results.aqi?.category ?? 'Moderate',
                icon: HiChartBar,
                color: results.aqi?.color || getAqiColor(results.aqi?.adjusted?.value ?? results.aqi?.value ?? 0),
                gradient: 'from-violet-500/10 to-purple-500/10',
              },
              {
                title: 'Water Safety',
                value: `${Math.round(((results.waterSafety?.score ?? 0) + (results.inputData ? calculateWQI(results.inputData).safetyPct : results.waterSafety?.score ?? 0)) / 2)}%`,
                status: results.waterSafety?.safe ? 'Safe' : 'Unsafe',
                icon: HiShieldCheck,
                color: results.waterSafety?.safe ? '#217344' : '#ef4444',
                gradient: 'from-enviro-500/10 to-teal-500/10',
              },
              {
                title: 'Health Risk',
                value: results.healthRisk?.level || 'Medium',
                status: results.healthRisk?.level || 'Medium',
                icon: HiHeart,
                color: results.healthRisk?.level === 'Low' ? '#217344' : results.healthRisk?.level === 'High' ? '#ef4444' : '#f59e0b',
                gradient: 'from-amber-500/10 to-orange-500/10',
              },
              {
                title: 'Livability',
                value: `${results.livability?.score ?? 0}/100`,
                status: (results.livability?.score ?? 0) >= 70 ? 'Good' : (results.livability?.score ?? 0) >= 40 ? 'Moderate' : 'Low',
                icon: HiGlobe,
                color: (results.livability?.score ?? 0) >= 70 ? '#217344' : (results.livability?.score ?? 0) >= 40 ? '#f59e0b' : '#ef4444',
                gradient: 'from-purple-500/10 to-pink-500/10',
              },
            ].map((card, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.05 }}
                className={`glass-card p-6 bg-gradient-to-br ${card.gradient}`}
              >
                <div className="flex items-center justify-between mb-4">
                  <card.icon className="w-8 h-8" style={{ color: card.color }} />
                  <StatusBadge status={card.status} />
                </div>
                <p className="text-sm text-dark-500 font-medium">{card.title}</p>
                <p className="text-3xl font-display font-bold mt-1" style={{ color: card.color }}>{card.value}</p>
              </motion.div>
            ))}
          </div>

          {/* Detailed Input Analysis */}
          {results.inputData && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* All 15 AQI Input Fields */}
              <div className="glass-card p-8 border-l-4 border-blue-500">
                <h3 className="text-lg font-bold text-dark-900 mb-2 flex items-center gap-2">
                  <HiCloud className="w-5 h-5 text-blue-500" />
                  Air Quality Inputs (All 15 Features)
                </h3>
                <p className="text-xs text-dark-400 mb-5">7 pollutants · 3 meteorological · 5 urban factors</p>

                {/* Pollutants */}
                <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-3">Core Pollutants</p>
                <div className="grid grid-cols-4 md:grid-cols-7 gap-3 mb-5">
                  {[
                    { key: 'pm25',  label: 'PM2.5', unit: 'µg/m³', color: 'text-red-500' },
                    { key: 'pm10',  label: 'PM10',  unit: 'µg/m³', color: 'text-orange-500' },
                    { key: 'no2',   label: 'NO₂',   unit: 'µg/m³', color: 'text-blue-500' },
                    { key: 'so2',   label: 'SO₂',   unit: 'µg/m³', color: 'text-yellow-600' },
                    { key: 'co',    label: 'CO',    unit: 'mg/m³', color: 'text-purple-500' },
                    { key: 'o3',    label: 'O₃',    unit: 'µg/m³', color: 'text-green-600' },
                    { key: 'nh3',   label: 'NH₃',   unit: 'µg/m³', color: 'text-teal-600' },
                  ].map((p) => (
                    <div key={p.key} className="p-3 rounded-xl bg-white border border-dark-100 text-center shadow-sm">
                      <p className="text-[10px] font-semibold text-dark-500 mb-1">{p.label}</p>
                      <p className={`text-base font-display font-bold ${p.color}`}>{results.inputData?.[p.key] ?? '—'}</p>
                      <p className="text-[9px] text-dark-400">{p.unit}</p>
                    </div>
                  ))}
                </div>

                {/* Meteorological */}
                <p className="text-xs font-bold text-sky-600 uppercase tracking-widest mb-3">Meteorological</p>
                <div className="grid grid-cols-3 gap-3 mb-5">
                  {[
                    { key: 'temperature', label: 'Temperature', unit: '°C',    color: 'text-amber-600' },
                    { key: 'humidity',    label: 'Humidity',    unit: '%',     color: 'text-cyan-600' },
                    { key: 'wind_speed',  label: 'Wind Speed',  unit: 'km/h',  color: 'text-slate-600' },
                  ].map((p) => (
                    <div key={p.key} className="p-3 rounded-xl bg-white border border-dark-100 text-center shadow-sm">
                      <p className="text-[10px] font-semibold text-dark-500 mb-1">{p.label}</p>
                      <p className={`text-base font-display font-bold ${p.color}`}>{results.inputData?.[p.key] ?? '—'}</p>
                      <p className="text-[9px] text-dark-400">{p.unit}</p>
                    </div>
                  ))}
                </div>

                {/* Urban */}
                <p className="text-xs font-bold text-purple-600 uppercase tracking-widest mb-3">Urban Factors</p>
                <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                  {[
                    { key: 'traffic_density',        label: 'Traffic',      unit: 'veh/hr', color: 'text-rose-500' },
                    { key: 'industrial_activity',    label: 'Industrial',   unit: '0–100',  color: 'text-orange-600' },
                    { key: 'green_cover',            label: 'Green Cover',  unit: '%',      color: 'text-green-600' },
                    { key: 'population_density',     label: 'Pop. Density', unit: '/km²',   color: 'text-indigo-600' },
                    { key: 'waste_management_score', label: 'Waste Mgmt',   unit: '0–10',   color: 'text-teal-600' },
                  ].map((p) => (
                    <div key={p.key} className="p-3 rounded-xl bg-white border border-dark-100 text-center shadow-sm">
                      <p className="text-[10px] font-semibold text-dark-500 mb-1">{p.label}</p>
                      <p className={`text-base font-display font-bold ${p.color}`}>{results.inputData?.[p.key] ?? '—'}</p>
                      <p className="text-[9px] text-dark-400">{p.unit}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                {/* Water Quality Analysis */}
                <div className="glass-card p-8 border-l-4 border-enviro-500">
                  <h3 className="text-lg font-bold text-dark-900 mb-6 flex items-center gap-2">
                    <HiBeaker className="w-5 h-5 text-enviro-500" />
                    Water Composition (Inputs)
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { key: 'ph', label: 'pH Level', unit: 'pH' },
                      { key: 'hardness', label: 'Hardness', unit: 'mg/L' },
                      { key: 'solids', label: 'Solids (TDS)', unit: 'ppm' },
                      { key: 'sulfate', label: 'Sulfate', unit: 'mg/L' },
                      { key: 'chloramines', label: 'Chloramines', unit: 'ppm' },
                      { key: 'conductivity', label: 'Conductivity', unit: 'µS/cm' },
                      { key: 'organic_carbon', label: 'Organic Carbon', unit: 'ppm' },
                      { key: 'trihalomethanes', label: 'Trihalomethanes', unit: 'µg/L' },
                      { key: 'turbidity', label: 'Turbidity', unit: 'NTU' },
                    ].map(p => (
                      <div key={p.key} className="p-3 rounded-xl bg-white border border-dark-100 text-center shadow-sm">
                        <p className="text-[10px] font-semibold text-dark-500 mb-1">{p.label}</p>
                        <p className="text-base font-display font-bold text-enviro-700">{results.inputData?.[p.key] ?? '—'}</p>
                        <p className="text-[9px] text-dark-400">{p.unit}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Environmental Factors Analysis */}
                <div className="glass-card p-8 border-l-4 border-purple-500">
                  <h3 className="text-lg font-bold text-dark-900 mb-6 flex items-center gap-2">
                    <HiGlobe className="w-5 h-5 text-purple-500" />
                    Environmental Factors (Inputs)
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { key: 'green_cover', label: 'Green Cover', unit: '%' },
                      { key: 'temperature', label: 'Temperature', unit: '°C' },
                      { key: 'humidity', label: 'Humidity', unit: '%' },
                      { key: 'wind_speed', label: 'Wind Speed', unit: 'km/h' },
                      { key: 'population_density', label: 'Pop. Density', unit: 'sq/km' },
                      { key: 'waste_management_score', label: 'Waste Mgmt', unit: '0-10' },
                    ].map(p => (
                      <div key={p.key} className="p-3 rounded-xl bg-white border border-dark-100 text-center shadow-sm">
                        <p className="text-[10px] font-semibold text-dark-500 mb-1">{p.label}</p>
                        <p className="text-base font-display font-bold text-purple-700">{results.inputData?.[p.key] ?? '—'}</p>
                        <p className="text-[9px] text-dark-400">{p.unit}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Gauge + Pie */}
          <div className="grid lg:grid-cols-2 gap-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass-card p-8"
            >
              <h3 className="font-display text-lg font-bold text-dark-900 mb-6">Livability Gauge</h3>
              <div className="flex justify-center">
                <GaugeChart
                  value={results.livability.score}
                  label="Livability Score"
                  color={results.livability.score >= 70 ? '#217344' : results.livability.score >= 40 ? '#f59e0b' : '#ef4444'}
                />
              </div>
              <div className="flex justify-center gap-6 mt-4 text-xs text-dark-500">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500 inline-block"></span> Poor (0-40)</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-yellow-500 inline-block"></span> Moderate (40-70)</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500 inline-block"></span> Good (70-100)</span>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="glass-card p-8"
            >
              <h3 className="font-display text-lg font-bold text-dark-900 mb-6">Environmental Breakdown</h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, value }) => `${name}: ${value.toFixed(0)}`}>
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </motion.div>
          </div>

          {/* Bar Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-8"
          >
            <h3 className="font-display text-lg font-bold text-dark-900 mb-6">Score Comparison</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="name" tick={{ fill: '#94a3b8' }} />
                <YAxis tick={{ fill: '#94a3b8' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    border: '1px solid rgba(100, 116, 139, 0.2)',
                    borderRadius: '12px',
                    color: '#1e293b',
                  }}
                />
                <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                  {barData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Line Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-8"
          >
            <h3 className="font-display text-lg font-bold text-dark-900 mb-6">Monthly Trend Analysis</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="month" tick={{ fill: '#94a3b8' }} />
                <YAxis tick={{ fill: '#94a3b8' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    border: '1px solid rgba(100, 116, 139, 0.2)',
                    borderRadius: '12px',
                    color: '#1e293b',
                  }}
                />
                <Line type="monotone" dataKey="ML AQI"      stroke="#7c3aed" strokeWidth={2} dot={{ fill: '#7c3aed', r: 3 }} />
                <Line type="monotone" dataKey="Formula AQI" stroke="#4656d0" strokeWidth={2} dot={{ fill: '#4656d0', r: 3 }} strokeDasharray="4 2" />
                <Line type="monotone" dataKey="Livability"  stroke="#217344" strokeWidth={2} dot={{ fill: '#217344', r: 3 }} />
                <Line type="monotone" dataKey="Water Safety" stroke="#0ea5e9" strokeWidth={2} dot={{ fill: '#0ea5e9', r: 3 }} />
                <Legend />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>

          {/* AI Suggestions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-8"
          >
            <h3 className="font-display text-lg font-bold text-dark-900 mb-4">🤖 AI-Powered Suggestions</h3>
            
            {!aiSuggestions ? (
              <div className="flex flex-col items-center justify-center p-6 space-y-3">
                <svg className="animate-spin w-8 h-8 text-blue-500" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <p className="text-sm text-dark-500 font-medium">Generating AI suggestions...</p>
              </div>
            ) : (
              <div className="space-y-3">
                {aiSuggestions.map((suggestion, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="p-4 rounded-xl bg-enviro-50/50 border border-enviro-200/30 text-dark-700 text-sm"
                  >
                    {suggestion}
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
