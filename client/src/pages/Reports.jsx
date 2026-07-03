import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { HiDocumentText, HiDownload, HiClock, HiTrash, HiEye, HiSparkles } from 'react-icons/hi';

export default function Reports() {
  const [reports, setReports] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [previewReport, setPreviewReport] = useState(null);

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem('envirocheck-reports') || '[]');
    setReports(stored);
  }, []);

  const generateReport = () => {
    setGenerating(true);

    const results = JSON.parse(localStorage.getItem('envirocheck-results') || 'null');
    
    setTimeout(() => {
      const newReport = {
        id: Date.now(),
        city: results?.city || 'Sample City',
        date: new Date().toISOString(),
        aqi: results?.aqi?.value || Math.floor(Math.random() * 200) + 30,
        aqiCategory: results?.aqi?.category || 'Moderate',
        waterSafe: results?.waterSafety?.safe ?? Math.random() > 0.3,
        waterScore: results?.waterSafety?.score || Math.floor(Math.random() * 40) + 60,
        livability: results?.livability?.score || Math.floor(Math.random() * 40) + 50,
        healthRisk: results?.healthRisk?.level || ['Low', 'Medium', 'High'][Math.floor(Math.random() * 3)],
        suggestions: [
          (results?.aqi?.value || 0) > 100 ? '🌿 Critical: Implement an Ultra Low Emission Zone (ULEZ) to restrict aging diesel vehicles.' : '🍃 Maintain current air quality by expanding cycling infrastructure.',
          !(results?.waterSafety?.safe) ? '💧 Immediate Action: Install industrial-grade activated carbon filtration systems.' : '🚰 Continue regular groundwater testing to maintain purity standards.',
          '🏙️ Integrate smart urban planning to increase mixed-use pedestrian zones.',
          '🌱 Establish a local carbon offset program for nearby industrial estates.',
          '📈 Deploy IoT-based environmental sensor networks for real-time monitoring.'
        ],
        risks: [
          { type: 'Air Quality', severity: (results?.aqi?.value || 0) > 150 ? 'High' : 'Moderate', description: 'Elevated PM2.5 levels posing respiratory risks.' },
          { type: 'Water Health', severity: results?.waterSafety?.safe ? 'Low' : 'Critical', description: 'Anomalies in chemical composition detected.' },
          { type: 'Biodiversity', severity: (results?.livability?.score || 0) < 60 ? 'High' : 'Low', description: 'Low green cover impacting local ecosystem stability.' },
        ],
      };

      const updated = [newReport, ...reports];
      setReports(updated);
      localStorage.setItem('envirocheck-reports', JSON.stringify(updated));
      setGenerating(false);
    }, 2000);
  };

  const downloadPDF = (report) => {
    import('html2pdf.js').then((module) => {
      const html2pdf = module.default;
      
      const content = document.createElement('div');
      content.innerHTML = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 40px; color: #1e293b;">
           <h1 style="font-size: 24px; font-weight: bold; border-bottom: 2px solid #e2e8f0; padding-bottom: 15px; margin-bottom: 30px;">ENVIROCHECK REPORT</h1>
           
           <div style="display: flex; justify-content: space-between; margin-bottom: 40px; color: #64748b; font-size: 14px;">
             <div><strong>City:</strong> ${report.city}</div>
             <div><strong>Date:</strong> ${new Date(report.date).toLocaleDateString()}</div>
           </div>
           
           <h2 style="font-size: 18px; font-weight: bold; color: #334155; margin-bottom: 20px;">KEY METRICS</h2>
           <div style="display: flex; flex-wrap: wrap; gap: 15px; margin-bottom: 40px;">
              <div style="flex: 1; min-width: 200px; padding: 20px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px;">
                <div style="font-size: 12px; color: #64748b; margin-bottom: 5px;">AQI</div>
                <div style="font-size: 24px; font-weight: bold; color: #3b82f6;">${report.aqi} <span style="font-size: 14px; color: #64748b; font-weight: normal;">(${report.aqiCategory})</span></div>
              </div>
              <div style="flex: 1; min-width: 200px; padding: 20px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px;">
                <div style="font-size: 12px; color: #64748b; margin-bottom: 5px;">WATER SAFETY</div>
                <div style="font-size: 24px; font-weight: bold; color: #10b981;">${report.waterScore}% <span style="font-size: 14px; color: #64748b; font-weight: normal;">(${report.waterSafe ? 'SAFE' : 'UNSAFE'})</span></div>
              </div>
              <div style="flex: 1; min-width: 200px; padding: 20px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px;">
                <div style="font-size: 12px; color: #64748b; margin-bottom: 5px;">LIVABILITY</div>
                <div style="font-size: 24px; font-weight: bold; color: #8b5cf6;">${report.livability}<span style="font-size: 14px; color: #64748b; font-weight: normal;">/100</span></div>
              </div>
              <div style="flex: 1; min-width: 200px; padding: 20px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px;">
                <div style="font-size: 12px; color: #64748b; margin-bottom: 5px;">HEALTH RISK</div>
                <div style="font-size: 24px; font-weight: bold; color: ${report.healthRisk === 'Low' ? '#10b981' : report.healthRisk === 'High' ? '#ef4444' : '#f59e0b'};">${report.healthRisk}</div>
              </div>
           </div>

           <h2 style="font-size: 18px; font-weight: bold; color: #334155; margin-bottom: 20px;">RISK ASSESSMENT</h2>
           <div style="margin-bottom: 40px;">
             ${report.risks.map(r => `
                <div style="padding: 15px; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 15px;">
                  <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                    <strong style="color: #1e293b;">${r.type}</strong>
                    <span style="font-size: 12px; font-weight: bold; padding: 2px 8px; border-radius: 4px; background: ${r.severity === 'Low' ? '#d1fae5' : r.severity === 'High' ? '#fee2e2' : '#fef3c7'}; color: ${r.severity === 'Low' ? '#065f46' : r.severity === 'High' ? '#991b1b' : '#92400e'};">${r.severity.toUpperCase()}</span>
                  </div>
                  <div style="font-size: 14px; color: #64748b;">${r.description}</div>
                </div>
             `).join('')}
           </div>

           <h2 style="font-size: 18px; font-weight: bold; color: #334155; margin-bottom: 20px;">AI RECOMMENDATIONS</h2>
           <ul style="line-height: 1.8; font-size: 14px; color: #475569; padding-left: 20px;">
              ${report.suggestions.map(s => `<li>${s}</li>`).join('')}
           </ul>
           
           <div style="margin-top: 60px; font-size: 12px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 20px;">
             Generated by EnviroCheck AI Platform • Report ID: ${report.id}
           </div>
        </div>
      `;

      const opt = {
        margin:       [0.5, 0.5, 0.5, 0.5],
        filename:     `EnviroCheck_Report_${report.city.replace(/\s+/g, '_')}_${new Date(report.date).toISOString().split('T')[0]}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, logging: false },
        jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' }
      };

      html2pdf().set(opt).from(content).save();
    });
  };

  const deleteReport = (id) => {
    const updated = reports.filter(r => r.id !== id);
    setReports(updated);
    localStorage.setItem('envirocheck-reports', JSON.stringify(updated));
    if (previewReport?.id === id) setPreviewReport(null);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="section-title">Report <span className="gradient-text">Generation</span></h1>
          <p className="section-subtitle mt-2">Generate and download comprehensive environmental assessment reports</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={generateReport}
          disabled={generating}
          className="btn-primary flex items-center gap-2"
        >
          {generating ? (
            <>
              <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Generating...
            </>
          ) : (
            <>
              <HiSparkles className="w-5 h-5" />
              Generate Report
            </>
          )}
        </motion.button>
      </div>

      {/* Report List */}
      {reports.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-12 text-center"
        >
          <HiDocumentText className="w-16 h-16 text-dark-300 mx-auto mb-4" />
          <h3 className="font-display text-xl font-bold text-dark-700 mb-2">No Reports Yet</h3>
          <p className="text-dark-500 mb-6">
            Run an analysis from the Dashboard first, then generate a report here.
          </p>
        </motion.div>
      ) : (
        <div className="grid gap-4">
          {reports.map((report, i) => (
            <motion.div
              key={report.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass-card-hover p-6"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl gradient-bg flex items-center justify-center flex-shrink-0">
                    <HiDocumentText className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-dark-900 text-lg">
                      {report.city} Environmental Report
                    </h3>
                    <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-dark-500">
                      <span className="flex items-center gap-1">
                        <HiClock className="w-4 h-4" />
                        {new Date(report.date).toLocaleDateString()}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        report.livability >= 70 ? 'status-safe' : report.livability >= 40 ? 'status-warning' : 'status-danger'
                      }`}>
                        Score: {report.livability}/100
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        report.healthRisk === 'Low' ? 'status-safe' : report.healthRisk === 'Medium' ? 'status-warning' : 'status-danger'
                      }`}>
                        Risk: {report.healthRisk}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setPreviewReport(previewReport?.id === report.id ? null : report)}
                    className="p-2.5 rounded-xl hover:bg-dark-100 transition-colors text-dark-500"
                    title="Preview"
                  >
                    <HiEye className="w-5 h-5" />
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => downloadPDF(report)}
                    className="p-2.5 rounded-xl hover:bg-enviro-50 transition-colors text-enviro-600"
                    title="Download"
                  >
                    <HiDownload className="w-5 h-5" />
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => deleteReport(report.id)}
                    className="p-2.5 rounded-xl hover:bg-red-50 transition-colors text-red-500"
                    title="Delete"
                  >
                    <HiTrash className="w-5 h-5" />
                  </motion.button>
                </div>
              </div>

              {/* Preview Panel */}
              {previewReport?.id === report.id && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-6 pt-6 border-t border-dark-200/20"
                >
                  <div className="grid md:grid-cols-4 gap-4 mb-6">
                    <div className="p-4 rounded-xl bg-blue-50/50">
                      <p className="text-xs text-dark-500">AQI</p>
                      <p className="font-display text-2xl font-bold text-blue-600">{report.aqi}</p>
                      <p className="text-xs text-dark-400">{report.aqiCategory}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-enviro-50/50">
                      <p className="text-xs text-dark-500">Water Safety</p>
                      <p className="font-display text-2xl font-bold text-enviro-600">{report.waterScore}%</p>
                      <p className="text-xs text-dark-400">{report.waterSafe ? 'Safe' : 'Unsafe'}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-purple-50/50">
                      <p className="text-xs text-dark-500">Livability</p>
                      <p className="font-display text-2xl font-bold text-purple-600">{report.livability}</p>
                      <p className="text-xs text-dark-400">out of 100</p>
                    </div>
                    <div className="p-4 rounded-xl bg-amber-50/50">
                      <p className="text-xs text-dark-500">Health Risk</p>
                      <p className="font-display text-2xl font-bold text-amber-600">{report.healthRisk}</p>
                      <p className="text-xs text-dark-400">risk level</p>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-semibold text-dark-700 mb-3">⚠️ Risk Assessment</h4>
                      <div className="space-y-2">
                        {report.risks.map((risk, j) => (
                          <div key={j} className="p-3 rounded-lg bg-dark-50/50 text-sm">
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-dark-700">{risk.type}</span>
                              <span className={risk.severity === 'Low' ? 'status-safe' : risk.severity === 'Moderate' ? 'status-warning' : 'status-danger'}>
                                {risk.severity}
                              </span>
                            </div>
                            <p className="text-xs text-dark-500 mt-1">{risk.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold text-dark-700 mb-3">💡 Suggestions</h4>
                      <div className="space-y-2">
                        {report.suggestions.map((s, j) => (
                          <div key={j} className="p-3 rounded-lg bg-enviro-50/30 text-sm text-dark-600">
                            {j + 1}. {s}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
