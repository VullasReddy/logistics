/**
 * Artwork.jsx
 * -----------
 * Hand-drawn SVG illustrations used in the design (no stock photos,
 * so there are no image licence problems). Pure decoration - no logic.
 *
 *   <BrandMark />   orange truck logo with speed swoosh (sidebar + login)
 *   <Truck />       reusable side-view truck drawing
 *   <HeroArt />     dashboard banner: sunset city, globes, truck, "360°"
 *   <PromoArt />    small scene for the sidebar promo card
 */

import { useId } from 'react';

/*
 * Each drawing gets its own gradient ids (via useId). If two pictures shared
 * the same id and the first one was hidden with display:none, the browser
 * would lose the colours in the second one.
 */

export function BrandMark({ width = 150 }) {
  return (
    <svg className="brand-mark" width={width} viewBox="0 0 150 42" aria-hidden="true">
      <path d="M8 30 C30 6, 70 2, 104 8" fill="none" stroke="#f97316" strokeWidth="4" strokeLinecap="round" />
      <path d="M22 34 C42 18, 70 14, 98 16" fill="none" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
      <g fill="none" stroke="#f97316" strokeWidth="3" strokeLinejoin="round">
        <rect x="96" y="12" width="26" height="18" rx="2" />
        <path d="M122 18h10l8 8v4h-18z" />
      </g>
      <circle cx="104" cy="33" r="4" fill="#f97316" />
      <circle cx="132" cy="33" r="4" fill="#f97316" />
    </svg>
  );
}

/** Side view truck. `x`, `y` place it; `s` scales it. Drawn facing left. */
export function Truck({ x = 0, y = 0, s = 1, idp = 't' }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {/* shadow */}
      <ellipse cx="190" cy="152" rx="200" ry="10" fill="#000" opacity="0.35" />
      {/* trailer */}
      <rect x="110" y="10" width="280" height="118" rx="6" fill={`url(#${idp}trailer)`} />
      <g stroke="#cbd5e1" strokeWidth="1.5">
        {[150, 190, 230, 270, 310, 350].map((lx) => <line key={lx} x1={lx} y1="14" x2={lx} y2="124" />)}
      </g>
      <rect x="110" y="122" width="280" height="10" fill="#475569" />
      {/* cab */}
      <path d="M8 132 V64 Q8 40 30 34 L84 22 Q104 20 108 40 V132 Z" fill={`url(#${idp}cab)`} />
      <path d="M22 66 V50 Q24 42 34 40 L80 31 Q94 30 94 44 V66 Z" fill={`url(#${idp}glass)`} />
      <rect x="8" y="82" width="100" height="6" fill="#c2410c" opacity="0.5" />
      <rect x="0" y="96" width="34" height="26" rx="3" fill="#1f2937" />
      {[100, 106, 112, 118].map((gy) => <line key={gy} x1="3" y1={gy} x2="31" y2={gy} stroke="#6b7280" strokeWidth="2" />)}
      <rect x="2" y="88" width="12" height="7" rx="2" fill="#fde68a" />
      <rect x="-2" y="124" width="112" height="10" rx="3" fill="#374151" />
      {/* wheels */}
      {[36, 88, 300, 352].map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy="138" r="17" fill="#111827" />
          <circle cx={cx} cy="138" r="8" fill="#9ca3af" />
          <circle cx={cx} cy="138" r="3" fill="#374151" />
        </g>
      ))}
    </g>
  );
}

/** Shared gradients used by <Truck>. Put once inside each <svg> that draws a truck. */
export function TruckDefs({ idp = 't' }) {
  return (
    <>
      <linearGradient id={`${idp}trailer`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#dfe5ee" />
      </linearGradient>
      <linearGradient id={`${idp}cab`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ff9a3c" /><stop offset="1" stopColor="#ea580c" />
      </linearGradient>
      <linearGradient id={`${idp}glass`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#1e293b" /><stop offset="1" stopColor="#475569" />
      </linearGradient>
    </>
  );
}

/** Simple city skyline made of rectangles with lit windows. */
function Skyline({ baseY, color, seed = 1, x0 = 0, x1 = 900, windows = true }) {
  const buildings = [];
  let x = x0;
  let i = seed;
  while (x < x1) {
    const w = 22 + ((i * 37) % 30);
    const h = 40 + ((i * 53) % 120);
    buildings.push({ x, w, h, i });
    x += w + 4;
    i++;
  }
  return (
    <g>
      {buildings.map((b) => (
        <g key={b.x}>
          <rect x={b.x} y={baseY - b.h} width={b.w} height={b.h} fill={color} />
          {windows && Array.from({ length: Math.floor(b.h / 14) }).map((_, r) =>
            (b.i + r) % 3 === 0 ? null : (
              <rect key={r} x={b.x + 5} y={baseY - b.h + 6 + r * 14} width={b.w - 10} height="3" fill="#fcd9a8" opacity="0.55" />
            ))}
        </g>
      ))}
    </g>
  );
}

/** A globe: circle + latitude/longitude lines. */
function Globe({ cx, cy, r, id }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={`url(#${id})`} />
      <g fill="none" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="1.2">
        <ellipse cx={cx} cy={cy} rx={r * 0.45} ry={r} />
        <ellipse cx={cx} cy={cy} rx={r * 0.8} ry={r} />
        <line x1={cx} y1={cy - r} x2={cx} y2={cy + r} />
        <ellipse cx={cx} cy={cy} rx={r} ry={r * 0.35} />
        <line x1={cx - r} y1={cy} x2={cx + r} y2={cy} />
      </g>
    </g>
  );
}

function Pin({ x, y, s = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M0 0 C-10 -14 -12 -20 -12 -26 A12 12 0 1 1 12 -26 C12 -20 10 -14 0 0Z" fill="#f97316" />
      <circle cx="0" cy="-26" r="5" fill="#fff" />
    </g>
  );
}

export function HeroArt() {
  const idp = useId().replace(/:/g, '');
  return (
    <svg className="hero-art" viewBox="0 0 900 380" preserveAspectRatio="xMaxYMid slice" aria-hidden="true">
      <defs>
        <TruckDefs idp={idp} />
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c9d8f0" />
          <stop offset="0.55" stopColor="#f6c9a0" />
          <stop offset="0.8" stopColor="#f59e5b" />
          <stop offset="1" stopColor="#1e2b4d" />
        </linearGradient>
        <radialGradient id="globeA" cx="0.35" cy="0.3">
          <stop offset="0" stopColor="#9cc3ee" /><stop offset="1" stopColor="#2c4f86" />
        </radialGradient>
        <radialGradient id="sun" cx="0.5" cy="0.5">
          <stop offset="0" stopColor="#fff3d6" /><stop offset="1" stopColor="#fff3d6" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="road" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2b3a5e" /><stop offset="1" stopColor="#0e1830" />
        </linearGradient>
        {/* fade the left edge into the page background */}
        <linearGradient id="fadeLeft" x1="0" x2="1">
          <stop offset="0.12" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.4" stopColor="#fff" stopOpacity="1" />
        </linearGradient>
        <mask id="heroMask"><rect width="900" height="380" fill="url(#fadeLeft)" /></mask>
      </defs>

      <g mask="url(#heroMask)">
        <rect width="900" height="380" fill="url(#sky)" />
        <circle cx="560" cy="250" r="140" fill="url(#sun)" />
        <Globe cx={300} cy={150} r={120} id="globeA" />
        <Globe cx={790} cy={120} r={110} id="globeA" />
        <Skyline baseY={290} color="#5b6b8c" seed={3} x0={180} />
        <Skyline baseY={300} color="#33415f" seed={7} x0={160} />
        <rect y="290" width="900" height="90" fill="url(#road)" />
        {/* light trails on the road */}
        <path d="M180 330 C400 310, 650 312, 900 300" stroke="#f97316" strokeWidth="3" fill="none" opacity="0.8" />
        <path d="M200 350 C430 330, 680 334, 900 322" stroke="#fbbf24" strokeWidth="2" fill="none" opacity="0.5" />
        {/* the "360" ring around the truck */}
        <ellipse cx="625" cy="306" rx="250" ry="50" fill="none" stroke="#f97316" strokeWidth="7" opacity="0.9" />
        {/* dashed route between pins */}
        <path d="M380 120 Q560 40 720 130" fill="none" stroke="#f97316" strokeWidth="2.5" strokeDasharray="6 7" />
        <Pin x={380} y={136} s={1} />
        <Pin x={720} y={146} s={1.1} />
        {/* airplane */}
        <g transform="translate(500 120) rotate(-12)" fill="#ffffff">
          <path d="M0 0 L60 -4 L72 0 L60 4 Z" />
          <path d="M28 -2 L18 -22 L26 -22 L42 -2 Z" />
          <path d="M28 2 L18 22 L26 22 L42 2 Z" />
          <path d="M60 -2 L66 -12 L70 -12 L68 -2 Z" />
        </g>
        <Truck x={470} y={196} s={0.78} idp={idp} />
        <text x="660" y="334" fontSize="54" fontWeight="900" fontStyle="italic" fill="#ffffff"
          stroke="#f97316" strokeWidth="1.5" fontFamily="Inter, sans-serif">360°</text>
      </g>
    </svg>
  );
}

export function PromoArt() {
  const idp = useId().replace(/:/g, '');
  return (
    <svg className="promo-art" viewBox="0 0 220 130" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs><TruckDefs idp={idp} /></defs>
      <rect width="220" height="130" fill="#31476f" />
      <rect width="220" height="70" fill="#f59e5b" opacity="0.35" />
      <Skyline baseY={100} color="#22355c" seed={5} windows />
      <rect y="100" width="220" height="30" fill="#0d1a38" />
      <Truck x={52} y={52} s={0.32} idp={idp} />
    </svg>
  );
}

export function PromoTruck() {
  const idp = useId().replace(/:/g, '');
  return (
    <svg className="promo-truck" viewBox="0 0 400 170" aria-hidden="true">
      <defs><TruckDefs idp={idp} /></defs>
      <Truck x={10} y={10} s={0.95} idp={idp} />
    </svg>
  );
}
