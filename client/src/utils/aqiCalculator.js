/**
 * CPCB India AQI Calculator
 * =========================
 * Each pollutant's concentration range maps linearly to an AQI sub-index.
 *
 * Breakpoint format: [C_Lo, C_Hi, I_Lo, I_Hi]
 *   - C_Lo / C_Hi : concentration bounds (µg/m³, except CO in mg/m³)
 *   - I_Lo / I_Hi : corresponding AQI index bounds
 *
 * Intervals are continuous and gapless. The half-open convention [C_Lo, C_Hi)
 * is used so each concentration value falls in exactly one band.
 * The final band uses Infinity as the upper bound and returns its I_Hi cap.
 *
 * PM2.5 breakpoints are calibrated to the user's calculation table:
 *   121–250 µg/m³  →  AQI 201–300
 */

const breakpoints = {
  // PM2.5 (µg/m³)
  pm25: [
    [0,    30,       0,   50],
    [30,   60,      50,  100],
    [60,   90,     100,  150],
    [90,   121,    150,  201],
    [121,  250,    201,  300],
    [250,  Infinity, 300, 500],
  ],

  // PM10 (µg/m³)
  pm10: [
    [0,    50,       0,   50],
    [50,   100,     50,  100],
    [100,  250,    100,  200],
    [250,  350,    200,  300],
    [350,  430,    300,  400],
    [430,  Infinity, 400, 500],
  ],

  // NO₂ (µg/m³)
  no2: [
    [0,    40,       0,   50],
    [40,   80,      50,  100],
    [80,   180,    100,  200],
    [180,  280,    200,  300],
    [280,  400,    300,  400],
    [400,  Infinity, 400, 500],
  ],

  // SO₂ (µg/m³)
  so2: [
    [0,    40,       0,   50],
    [40,   80,      50,  100],
    [80,   380,    100,  200],
    [380,  800,    200,  300],
    [800,  1600,   300,  400],
    [1600, Infinity, 400, 500],
  ],

  // CO (mg/m³ — NOT µg/m³)
  co: [
    [0,    1.0,     0,   50],
    [1.0,  2.0,    50,  100],
    [2.0,  10.0,  100,  200],
    [10.0, 17.0,  200,  300],
    [17.0, 34.0,  300,  400],
    [34.0, Infinity, 400, 500],
  ],

  // O₃ (µg/m³)
  o3: [
    [0,    50,       0,   50],
    [50,   100,     50,  100],
    [100,  168,    100,  200],
    [168,  208,    200,  300],
    [208,  748,    300,  400],
    [748,  Infinity, 400, 500],
  ],

  // NH₃ (µg/m³)
  nh3: [
    [0,    200,      0,   50],
    [200,  400,     50,  100],
    [400,  800,    100,  200],
    [800,  1200,   200,  300],
    [1200, 1800,   300,  400],
    [1800, Infinity, 400, 500],
  ],
};

/**
 * Compute the AQI sub-index for a single pollutant value.
 * Uses strict half-open intervals [C_Lo, C_Hi) so a value at a boundary
 * always falls into the correct (higher) band.
 */
function getSubIndex(val, param) {
  if (val === null || val === undefined || isNaN(val) || val < 0) return 0;

  const bands = breakpoints[param];
  if (!bands) return 0;

  for (let i = 0; i < bands.length; i++) {
    const [cLo, cHi, iLo, iHi] = bands[i];

    // Last band: val >= cLo → cap at iHi
    if (cHi === Infinity) {
      if (val >= cLo) return iHi;
      continue;
    }

    // All other bands: [cLo, cHi)
    // For the very first band, accept val = 0 with >= cLo
    const inBand = (i === 0) ? (val >= cLo && val < cHi) : (val >= cLo && val < cHi);
    if (inBand) {
      // Linear interpolation
      return Math.round(iLo + ((val - cLo) / (cHi - cLo)) * (iHi - iLo));
    }
  }

  return 0;
}

/**
 * Calculate the overall CPCB AQI from a set of pollutant inputs.
 * @param {Object} inputs - keys: pm25, pm10, no2, so2, co, o3, nh3
 * @returns {{ aqi, category, color, breakdown }}
 */
export function calculateCPCBAQI(inputs) {
  const PARAMS = ['pm25', 'pm10', 'no2', 'so2', 'co', 'o3', 'nh3'];
  const subIndices = [];
  const breakdown = {};

  PARAMS.forEach(param => {
    const val = parseFloat(inputs[param]);
    if (!isNaN(val) && val >= 0) {
      const idx = getSubIndex(val, param);
      subIndices.push(idx);
      breakdown[param] = idx;
    }
  });

  if (subIndices.length === 0) {
    return { aqi: 0, category: 'Good', color: '#00C853', breakdown: {} };
  }

  // Overall AQI = maximum sub-index across all pollutants
  const finalAqi = Math.max(...subIndices);

  // AQI Category thresholds (CPCB)
  let category, color;
  if      (finalAqi <= 50)  { category = 'Good';             color = '#00C853'; }
  else if (finalAqi <= 100) { category = 'Satisfactory';     color = '#64DD17'; }
  else if (finalAqi <= 200) { category = 'Moderate';         color = '#FFA500'; }
  else if (finalAqi <= 300) { category = 'Poor';             color = '#FF5722'; }
  else if (finalAqi <= 400) { category = 'Very Poor';        color = '#B71C1C'; }
  else                      { category = 'Severe/Hazardous'; color = '#6A1B9A'; }

  return { aqi: finalAqi, category, color, breakdown };
}
