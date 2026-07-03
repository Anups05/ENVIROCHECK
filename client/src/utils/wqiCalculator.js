/**
 * WHO/BIS Water Quality Index (WQI) Calculator
 * =============================================
 * 4-step formula using 9 standard water parameters.
 *
 * Step 1 — Quality Rating:  Qi = [(Vi_actual − Vi_ideal) / (Si − Vi_ideal)] × 100
 * Step 2 — Unit Weight:     Wi = 1 / Si
 * Step 3 — Normalized:      wi = Wi / ΣWi
 * Step 4 — WQI:             WQI = Σ(Qi × wi)
 * Step 5 — Safety %:        WQI→% mapping (floor 20%)
 */

// WHO/BIS standard and ideal values
const STANDARDS = [
  // [parameter key, ideal (Vi), standard limit (Si)]
  ['ph',               7,   8.5],
  ['hardness',         0, 300  ],
  ['solids',           0, 500  ],
  ['sulfate',          0, 250  ],
  ['chloramines',      0,   4  ],
  ['conductivity',     0, 400  ],
  ['organic_carbon',   0,   2  ],
  ['trihalomethanes',  0,  80  ],
  ['turbidity',        0,   5  ],
];

/**
 * Calculate WQI and Safety % from raw input values.
 *
 * @param {Object} inputs  - keys matching STANDARDS (lowercase snake_case)
 *                           e.g. { ph: 7.5, hardness: 150, ... }
 * @returns {{ wqi, safetyPct, category, color, paramRatings }}
 *   paramRatings: Array of { key, qi, wi, contribution }
 */
export function calculateWQI(inputs) {
  // ── Step 1 & 2: Qi and Wi per parameter ────────────────────────────────────
  const rows = STANDARDS.map(([key, ideal, standard]) => {
    const actual = parseFloat(inputs[key] ?? inputs[key.replace('_', '')] ?? 0);
    // Qi = ((actual - ideal) / (standard - ideal)) * 100
    const qi = ((actual - ideal) / (standard - ideal)) * 100;
    // Wi = 1 / standard
    const wi_raw = 1 / standard;
    return { key, ideal, standard, actual, qi, wi_raw };
  });

  // ── Step 3: Normalized weights wi = Wi / ΣWi ───────────────────────────────
  const sumW = rows.reduce((acc, r) => acc + r.wi_raw, 0);
  const paramRatings = rows.map(r => ({
    key:          r.key,
    actual:       r.actual,
    qi:           +r.qi.toFixed(2),
    wi:           +(r.wi_raw / sumW).toFixed(6),
    contribution: +((r.qi * (r.wi_raw / sumW))).toFixed(2),
  }));

  // ── Step 4: WQI = Σ(Qi × wi) ───────────────────────────────────────────────
  const wqi = +paramRatings.reduce((acc, r) => acc + r.contribution, 0).toFixed(2);

  let category, color;
  if      (wqi <= 25)  { category = 'Excellent'; color = '#00C853'; }
  else if (wqi <= 50)  { category = 'Good';      color = '#64DD17'; }
  else if (wqi <= 75)  { category = 'Poor';      color = '#FFA500'; }
  else if (wqi <= 100) { category = 'Very Poor'; color = '#FF5722'; }
  else                 { category = 'Unsuitable';color = '#B71C1C'; }

  // Continuous safety percentage calculation
  const safetyPct = Math.max(0, Math.min(100, +(100 - (wqi * 0.8)).toFixed(1)));

  return { wqi, safetyPct, category, color, paramRatings };
}
