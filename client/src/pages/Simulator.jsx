import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { HiAdjustments, HiRefresh, HiLocationMarker, HiShieldCheck, HiChartBar, HiGlobe, HiHeart } from 'react-icons/hi';

// ─────────────────────────────────────────────────────────────────────────────
// CALCULATION ENGINE
// All metrics are derived from the 6 slider values (0–100 each). Here is the
// exact formula for every metric so the page is fully transparent.
//
// BASE VALUES come from the actual dashboard results (avgAqi, avgWater,
// livability) stored in localStorage. Sliders add deltas on top.
//
// AQI delta:
//   Δ = − (pollutionRed × 1.2) − (trafficRed × 0.8) − (greenCover × 0.5) − (renewableEnergy × 0.3)
//   Final AQI = max(10, baseAQI + Δ)
//   (Reducing pollution / traffic / adding green cover all lower AQI)
//
// Water Safety delta:
//   Δ = +(waterTreatment × 0.3) + (wasteRecycling × 0.08) − (pollutionRed > 50 ? 0 : (50 − pollutionRed) × 0.05)
//   Final Water = min(100, max(0, baseWater + Δ))
//   (Better water treatment & recycling improves safety)
//
// Livability formula:
//   Starts from baseLivability
//   − (ΔAqi / 5)     → higher AQI hurts livability
//   − (100 − FinalWater) / 2    → poor water hurts livability
//   + greenCover / 5            → more green helps
//   + wasteMgmt × 2             (waste slider 0–100 mapped to 0–10 scale × 2)
//   Clamped 10–100
// ─────────────────────────────────────────────────────────────────────────────

const defaultSliders = {
  greenCover:       25,
  pollutionReduction: 0,
  trafficReduction:   0,
  renewableEnergy:   15,
  wasteRecycling:    30,
  waterTreatment:    50,
};

function getAqiColor(v) {
  if (v <= 50)  return '#00C853';
  if (v <= 100) return '#64DD17';
  if (v <= 200) return '#FFA500';
  if (v <= 300) return '#FF5722';
  return '#B71C1C';
}
function getAqiLabel(v) {
  if (v <= 50)  return 'Good';
  if (v <= 100) return 'Satisfactory';
  if (v <= 200) return 'Moderate';
  if (v <= 300) return 'Poor';
  return 'Very Poor';
}
function getLivabilityColor(v) {
  if (v >= 70) return '#00C853';
  if (v >= 40) return '#f59e0b';
  return '#ef4444';
}
function getWaterColor(v) {
  if (v >= 80) return '#00C853';
  if (v >= 60) return '#64DD17';
  if (v >= 40) return '#FFA500';
  return '#ef4444';
}

function ProgressBar({ value, max = 100, color }) {
  return (
    <div className="w-full bg-dark-200/30 rounded-full h-3 overflow-hidden mt-3">
      <motion.div
        className="h-full rounded-full"
        style={{ backgroundColor: color }}
        animate={{ width: `${Math.min((value / max) * 100, 100)}%` }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      />
    </div>
  );
}

export default function Simulator() {
  const [sliders, setSliders] = useState(defaultSliders);

  // ── Load base values from last dashboard run ────────────────────────────────
  const [baseAqi, setBaseAqi]       = useState(150);
  const [baseWater, setBaseWater]   = useState(60);
  const [baseLiv, setBaseLiv]       = useState(55);
  const [cityName, setCityName]     = useState('Your City');

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('envirocheck-results') || '{}');
      if (stored?.city)         setCityName(stored.city);
      // Avg AQI = (formulaAqi + mlAqi) / 2 — stored in aqi.general & aqi.adjusted
      const gAqi = stored?.aqi?.general?.value  ?? stored?.aqi?.value ?? 150;
      const mAqi = stored?.aqi?.adjusted?.value ?? stored?.aqi?.value ?? 150;
      setBaseAqi(Math.round((gAqi + mAqi) / 2));
      // Avg Water — stored as waterSafety.score (already the avg)
      setBaseWater(stored?.waterSafety?.score ?? 60);
      setBaseLiv(stored?.livability?.score ?? 55);
    } catch (_) {}
  }, []);

  // ── Live calculations ───────────────────────────────────────────────────────
  const { liveAqi, liveWater, liveLivability } = useMemo(() => {
    const s = sliders;

    // AQI: pollution / traffic / green / renewable all reduce AQI
    const aqiDelta = -((s.pollutionReduction * 1.2) + (s.trafficReduction * 0.8) +
                       (s.greenCover * 0.5)          + (s.renewableEnergy * 0.3));
    const liveAqi = Math.max(10, Math.round(baseAqi + aqiDelta));

    // Water: treatment & recycling improve it
    const waterDelta = (s.waterTreatment * 0.3) + (s.wasteRecycling * 0.08);
    const liveWater  = Math.min(100, Math.max(0, Math.round(baseWater + waterDelta)));

    // Livability: accumulate improvements
    let lv = baseLiv;
    lv += (liveAqi - baseAqi) / -5;           // lower AQI → higher livability
    lv += (liveWater - baseWater) / 2;         // higher water → higher livability
    lv += (s.greenCover - defaultSliders.greenCover) / 5;
    lv += (s.wasteRecycling - defaultSliders.wasteRecycling) * 0.08;
    const liveLivability = Math.min(100, Math.max(10, Math.round(lv)));

    return { liveAqi, liveWater, liveLivability };
  }, [sliders, baseAqi, baseWater, baseLiv]);

  const handleChange = (key, val) => setSliders(prev => ({ ...prev, [key]: Number(val) }));
  const handleReset  = () => setSliders(defaultSliders);

  const sliderDefs = [
    { key: 'greenCover',         label: 'Green Cover',        unit: '%', color: '#217344', icon: '🌳', desc: 'Increase % of urban area covered by vegetation' },
    { key: 'pollutionReduction', label: 'Pollution Reduction',unit: '%', color: '#4656d0', icon: '🏭', desc: 'Reduce industrial & vehicular emissions' },
    { key: 'trafficReduction',   label: 'Traffic Reduction',  unit: '%', color: '#8b5cf6', icon: '🚗', desc: 'Reduce vehicular traffic congestion' },
    { key: 'renewableEnergy',    label: 'Renewable Energy',   unit: '%', color: '#f59e0b', icon: '⚡', desc: 'Adoption of solar, wind, and clean energy' },
    { key: 'wasteRecycling',     label: 'Waste Recycling',    unit: '%', color: '#06b6d4', icon: '♻️', desc: 'Percentage of waste properly recycled' },
    { key: 'waterTreatment',     label: 'Water Treatment',    unit: '%', color: '#0ea5e9', icon: '💧', desc: 'Coverage of water treatment facilities' },
  ];

  // Deltas for showing change visually
  const aqiDelta     = liveAqi - baseAqi;
  const waterDelta   = liveWater - baseWater;
  const livDelta     = liveLivability - baseLiv;

  const DeltaBadge = ({ delta, invert = false }) => {
    const good = invert ? delta < 0 : delta > 0;
    const neutral = delta === 0;
    return (
      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ml-2 ${
        neutral ? 'bg-dark-100 text-dark-400' :
        good    ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
      }`}>
        {delta === 0 ? '—' : `${delta > 0 ? '+' : ''}${delta}`}
      </span>
    );
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="section-title">What-If <span className="gradient-text">Simulator</span></h1>
          <p className="section-subtitle mt-2 flex items-center gap-2">
            <HiLocationMarker className="w-4 h-4 text-enviro-500" />
            <span className="font-semibold text-dark-700">{cityName}</span>
            <span className="text-dark-400">— Adjust sliders to see real-time impact on metrics</span>
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
          onClick={handleReset}
          className="btn-secondary flex items-center gap-2"
        >
          <HiRefresh className="w-4 h-4" /> Reset Values
        </motion.button>
      </div>

      {/* Live Score Display — 3 cards */}
      <div className="grid md:grid-cols-3 gap-6">

        {/* Livability */}
        <motion.div layout className="glass-card p-8 text-center bg-gradient-to-br from-green-500/10 to-emerald-500/10">
          <HiGlobe className="w-8 h-8 mx-auto mb-2" style={{ color: getLivabilityColor(liveLivability) }} />
          <p className="text-sm font-semibold text-dark-500 mb-1">Livability Score</p>
          <p className="text-xs text-dark-400 mb-3">Base: <strong>{baseLiv}</strong> <DeltaBadge delta={livDelta} /></p>
          <motion.p
            key={liveLivability}
            initial={{ scale: 1.2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="font-display text-6xl font-bold"
            style={{ color: getLivabilityColor(liveLivability) }}
          >
            {liveLivability}
          </motion.p>
          <p className="text-xs text-dark-400 mt-1">out of 100</p>
          <ProgressBar value={liveLivability} color={getLivabilityColor(liveLivability)} />
        </motion.div>

        {/* AQI */}
        <motion.div layout className="glass-card p-8 text-center bg-gradient-to-br from-blue-500/10 to-violet-500/10">
          <HiChartBar className="w-8 h-8 mx-auto mb-2" style={{ color: getAqiColor(liveAqi) }} />
          <p className="text-sm font-semibold text-dark-500 mb-1">Predicted AQI</p>
          <p className="text-xs text-dark-400 mb-3">Base (Avg): <strong>{baseAqi}</strong> <DeltaBadge delta={aqiDelta} invert /></p>
          <motion.p
            key={liveAqi}
            initial={{ scale: 1.2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="font-display text-6xl font-bold"
            style={{ color: getAqiColor(liveAqi) }}
          >
            {liveAqi}
          </motion.p>
          <p className="text-xs mt-1" style={{ color: getAqiColor(liveAqi) }}>{getAqiLabel(liveAqi)}</p>
          <ProgressBar value={liveAqi} max={400} color={getAqiColor(liveAqi)} />
        </motion.div>

        {/* Water Safety */}
        <motion.div layout className="glass-card p-8 text-center bg-gradient-to-br from-teal-500/10 to-cyan-500/10">
          <HiShieldCheck className="w-8 h-8 mx-auto mb-2" style={{ color: getWaterColor(liveWater) }} />
          <p className="text-sm font-semibold text-dark-500 mb-1">Predicted Water Safety</p>
          <p className="text-xs text-dark-400 mb-3">Base (Avg): <strong>{baseWater}%</strong> <DeltaBadge delta={waterDelta} /></p>
          <motion.p
            key={liveWater}
            initial={{ scale: 1.2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="font-display text-6xl font-bold"
            style={{ color: getWaterColor(liveWater) }}
          >
            {liveWater}%
          </motion.p>
          <p className="text-xs text-dark-400 mt-1">WHO/BIS + ML Average</p>
          <ProgressBar value={liveWater} color={getWaterColor(liveWater)} />
        </motion.div>
      </div>

      {/* Sliders */}
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="glass-card p-8"
      >
        <h3 className="font-display text-lg font-bold text-dark-900 mb-6 flex items-center gap-2">
          <HiAdjustments className="w-5 h-5 text-enviro-500" />
          Adjust Improvement Parameters
        </h3>

        <div className="grid md:grid-cols-2 gap-8">
          {sliderDefs.map(s => (
            <div key={s.key} className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm font-medium text-dark-700">
                  <span>{s.icon}</span> {s.label}
                </label>
                <span className="font-display font-bold text-lg" style={{ color: s.color }}>
                  {sliders[s.key]}{s.unit}
                </span>
              </div>
              <input
                type="range" min="0" max="100"
                value={sliders[s.key]}
                onChange={e => handleChange(s.key, e.target.value)}
                className="w-full h-2 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, ${s.color} ${sliders[s.key]}%, rgb(203 213 225 / 0.3) ${sliders[s.key]}%)`,
                }}
              />
              <p className="text-xs text-dark-400">{s.desc}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Formula explanation card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="glass-card p-6 border-l-4 border-enviro-500 bg-gradient-to-r from-enviro-50/30 to-transparent"
      >
        <h4 className="font-bold text-dark-800 mb-3 text-sm uppercase tracking-widest">📐 How Simulation Calculates</h4>
        <div className="grid md:grid-cols-3 gap-4 text-xs text-dark-600">
          <div>
            <p className="font-bold text-blue-600 mb-1">AQI Delta</p>
            <p>− (PollutionRed × 1.2)<br />− (TrafficRed × 0.8)<br />− (GreenCover × 0.5)<br />− (Renewable × 0.3)<br />
            <span className="text-dark-400 italic">= Total reduction from base</span></p>
          </div>
          <div>
            <p className="font-bold text-teal-600 mb-1">Water Safety Delta</p>
            <p>+ (WaterTreatment × 0.3)<br />+ (WasteRecycling × 0.08)<br />
            <span className="text-dark-400 italic">= Improvement from base</span></p>
          </div>
          <div>
            <p className="font-bold text-green-600 mb-1">Livability Delta</p>
            <p>+ ΔAQI / −5<br />+ ΔWater / 2<br />+ ΔGreenCover / 5<br />+ ΔWasteRecycling × 0.08<br />
            <span className="text-dark-400 italic">= Net livability change</span></p>
          </div>
        </div>
      </motion.div>

    </div>
  );
}
