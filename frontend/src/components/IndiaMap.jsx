/**
 * IndiaMap.jsx
 * ------------
 * India outline (state borders) with an orange pin for each branch city.
 *
 * Map data: @svg-maps/india by VictorCazanave, licence CC BY 4.0
 * (https://github.com/VictorCazanave/svg-maps). Keep this credit.
 *
 * Pins are placed from latitude/longitude. This map uses a Mercator
 * projection, so:
 *   x grows evenly with longitude (west edge of Gujarat 68.18°E = x 0,
 *     east edge of Arunachal 97.4°E = x 612)
 *   y uses the Mercator formula, fitted to Delhi (28.88°N -> y 205) and
 *     Kanyakumari (8.08°N -> y 668). Checked against Telangana and West
 *     Bengal borders: error under 3 px.
 */
import india from '@svg-maps/india';

const WEST = 68.18;
const EAST = 97.4;
const MAP_WIDTH = 612;
const REF_LAT = 28.88;   // Delhi (northern edge)
const REF_Y = 205;
const Y_SCALE = 1208;    // pixels per Mercator unit, measured

/** Mercator "stretched" latitude value. */
const mercator = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));

function project(lat, lng) {
  const x = ((lng - WEST) / (EAST - WEST)) * MAP_WIDTH;
  const y = REF_Y + (mercator(REF_LAT) - mercator(lat)) * Y_SCALE;
  return { x, y };
}

export default function IndiaMap({ pins = [], height = 220 }) {
  return (
    <svg viewBox={india.viewBox} height={height} style={{ width: '100%', overflow: 'visible' }}
      role="img" aria-label="Map of India with branch locations">
      <defs>
        <linearGradient id="landGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f1f4f9" /><stop offset="1" stopColor="#d5dbe6" />
        </linearGradient>
        <filter id="mapShadow" x="-10%" y="-10%" width="130%" height="130%">
          <feDropShadow dx="6" dy="10" stdDeviation="6" floodColor="#64748b" floodOpacity="0.35" />
        </filter>
      </defs>
      <g filter="url(#mapShadow)">
        {india.locations.map((state) => (
          <path key={state.id} d={state.path} fill="url(#landGrad)" stroke="#ffffff" strokeWidth="1.2">
            <title>{state.name}</title>
          </path>
        ))}
      </g>
      {pins.map((p) => {
        const { x, y } = project(p.latitude, p.longitude);
        return (
          <g key={p.city} transform={`translate(${x} ${y}) scale(1.5)`}>
            <title>{`${p.city}: ${p.users} users`}</title>
            <path d="M0 0 C-7 -10 -9 -14 -9 -19 A9 9 0 1 1 9 -19 C9 -14 7 -10 0 0Z" fill="#f97316" stroke="#fff" strokeWidth="1.5" />
            <circle cx="0" cy="-19" r="3.5" fill="#fff" />
          </g>
        );
      })}
    </svg>
  );
}
