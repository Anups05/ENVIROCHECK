import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { HiArrowLeft, HiOutlineBookOpen, HiChartBar } from 'react-icons/hi';

export default function AqiDetails() {
  const [results, setResults] = useState(null);

  useEffect(() => {
    const stored = localStorage.getItem('envirocheck-results');
    if (stored) {
      setResults(JSON.parse(stored));
    }
  }, []);

  if (!results) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <p className="text-dark-500 text-lg">No AQI data found.</p>
          <Link to="/dashboard" className="btn-primary inline-block mt-4">Go to Dashboard</Link>
        </div>
      </div>
    );
  }

  const breakdown = results.aqi?.generalBreakdown || {};
  const pollutants = [
    { key: 'pm25', label: 'PM2.5' },
    { key: 'pm10', label: 'PM10' },
    { key: 'no2', label: 'NO₂' },
    { key: 'so2', label: 'SO₂' },
    { key: 'co', label: 'CO' },
    { key: 'o3', label: 'O₃' },
    { key: 'nh3', label: 'NH₃' },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <div className="flex items-center gap-4">
        <Link to="/results" className="inline-flex items-center gap-1 text-sm text-enviro-600 hover:underline">
          <HiArrowLeft className="w-4 h-4" /> Back to Results
        </Link>
      </div>

      <div>
        <h1 className="section-title flex items-center gap-2">
          <HiOutlineBookOpen className="w-8 h-8 text-sky-500" />
          CPCB AQI <span className="gradient-text">Calculation Details</span>
        </h1>
        <p className="text-dark-500 mt-2">
          This explains exactly how your General AQI of <strong className="text-dark-900">{results.aqi?.general?.value}</strong> was calculated using the standard Indian CPCB formula.
        </p>
      </div>

      {/* Formula Explanation */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-8 bg-sky-50/50">
        <h3 className="font-bold text-lg text-dark-900 mb-4 border-b border-sky-100 pb-2">Step 1: AQI Sub-Index Formula</h3>
        <p className="font-mono text-center text-lg bg-white p-4 rounded-xl border border-sky-100 mb-6 shadow-sm">
          I = <span className="text-sky-600">((I_Hi - I_Lo) / (B_Hi - B_Lo))</span> × (C - B_Lo) + I_Lo
        </p>
        <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3 text-sm text-dark-600 mb-8">
          <p><strong className="text-dark-800">I</strong> = Sub-Index for the pollutant</p>
          <p><strong className="text-dark-800">C</strong> = Observed concentration</p>
          <p><strong className="text-dark-800">B_Hi</strong> = Breakpoint upper limit</p>
          <p><strong className="text-dark-800">B_Lo</strong> = Breakpoint lower limit</p>
          <p><strong className="text-dark-800">I_Hi</strong> = AQI corresponding to B_Hi</p>
          <p><strong className="text-dark-800">I_Lo</strong> = AQI corresponding to B_Lo</p>
        </div>

        <h3 className="font-bold text-lg text-dark-900 mb-4 border-b border-sky-100 pb-2">Step 2: Sub-Index Breakdown</h3>
        <div className="space-y-3">
          {pollutants.map(p => {
            const val = breakdown[p.key];
            if (val === undefined || isNaN(val)) return null;
            const isMax = val === results.aqi?.general?.value;
            return (
              <div key={p.key} className={`flex items-center justify-between p-3 rounded-lg border ${isMax ? 'bg-sky-100 border-sky-300' : 'bg-white border-dark-100'}`}>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-dark-800 w-12">{p.label}</span>
                  <span className="text-dark-500 text-sm">Input: {results.inputData?.[p.key] || 0}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-dark-500">Sub-Index:</span>
                  <span className={`font-display font-bold text-xl ${isMax ? 'text-sky-600' : 'text-dark-700'}`}>{val}</span>
                  {isMax && <span className="text-[10px] bg-sky-500 text-white px-2 py-0.5 rounded uppercase font-bold tracking-wider">Max</span>}
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-8 bg-sky-500 text-white text-center">
        <h3 className="font-bold text-xl mb-2">Step 3: Final AQI</h3>
        <p className="text-sky-100 mb-4">AQI = max(Sub-Indices)</p>
        <p className="font-display font-bold text-5xl">AQI: {results.aqi?.general?.value}</p>
        <p className="mt-4 inline-block px-4 py-1 text-sm font-bold bg-white/20 rounded-full">{results.aqi?.general?.category}</p>
      </motion.div>

    </div>
  );
}
