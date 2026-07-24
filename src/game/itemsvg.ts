// 物品 SVG 贴图系统：商店商品、鱼/虫/化石都有各自的手绘 SVG 小图
import * as THREE from 'three';

// ---------------- 鱼 / 虫 / 化石（每种独特造型） ----------------
const CREATURE_SVG: Record<string, string> = {
  crucian: `<ellipse cx="32" cy="34" rx="18" ry="10" fill="#7a9a4a"/><path d="M46 34 L58 24 L58 44 Z" fill="#7a9a4a"/><path d="M18 28 Q32 20 46 28" fill="#a8c46a"/><circle cx="24" cy="32" r="2.5" fill="#222"/>`,
  carp: `<ellipse cx="32" cy="34" rx="20" ry="11" fill="#8a6a3a"/><path d="M48 34 L60 23 L60 45 Z" fill="#8a6a3a"/><path d="M14 30 Q32 20 50 30 L50 26 Q32 17 14 26 Z" fill="#c9a86a"/><circle cx="23" cy="32" r="2.5" fill="#222"/><path d="M14 38 q-4 2 -6 0" stroke="#8a6a3a" stroke-width="1.5" fill="none"/>`,
  bass: `<ellipse cx="32" cy="34" rx="19" ry="9" fill="#4a6a8a"/><path d="M47 34 L59 25 L59 43 Z" fill="#4a6a8a"/><path d="M14 36 L50 36 L50 40 Q32 46 14 40 Z" fill="#cfe0ee"/><path d="M22 26 L42 26 L38 20 L26 20 Z" fill="#3a5a7a"/><circle cx="24" cy="32" r="2.5" fill="#222"/>`,
  koi: `<ellipse cx="32" cy="34" rx="18" ry="9" fill="#f2f2f2"/><path d="M46 34 L58 25 L58 43 Z" fill="#f2f2f2"/><circle cx="26" cy="30" r="5" fill="#e84a3a"/><circle cx="38" cy="38" r="4" fill="#e84a3a"/><circle cx="45" cy="29" r="3" fill="#e84a3a"/><circle cx="22" cy="32" r="2.2" fill="#222"/>`,
  butterfly: `<ellipse cx="22" cy="28" rx="10" ry="13" fill="#ffffff" stroke="#4aa3ff" stroke-width="2"/><ellipse cx="42" cy="28" rx="10" ry="13" fill="#ffffff" stroke="#4aa3ff" stroke-width="2"/><ellipse cx="23" cy="44" rx="7" ry="8" fill="#dcefff"/><ellipse cx="41" cy="44" rx="7" ry="8" fill="#dcefff"/><rect x="30" y="20" width="4" height="30" rx="2" fill="#333"/><path d="M30 18 q-4 -6 -8 -7 M34 18 q4 -6 8 -7" stroke="#333" stroke-width="1.5" fill="none"/>`,
  tigerfly: `<ellipse cx="22" cy="28" rx="10" ry="13" fill="#ffb347"/><ellipse cx="42" cy="28" rx="10" ry="13" fill="#ffb347"/><path d="M15 22 h14 M13 30 h16 M16 38 h12 M36 22 h14 M35 30 h16 M38 38 h12" stroke="#222" stroke-width="2.5"/><ellipse cx="23" cy="45" rx="7" ry="8" fill="#222"/><ellipse cx="41" cy="45" rx="7" ry="8" fill="#ffb347"/><rect x="30" y="20" width="4" height="30" rx="2" fill="#333"/>`,
  dragonfly: `<ellipse cx="20" cy="26" rx="13" ry="5" fill="#bdeaff" opacity="0.85"/><ellipse cx="44" cy="26" rx="13" ry="5" fill="#bdeaff" opacity="0.85"/><ellipse cx="20" cy="36" rx="12" ry="4.5" fill="#dcefff" opacity="0.8"/><ellipse cx="44" cy="36" rx="12" ry="4.5" fill="#dcefff" opacity="0.8"/><rect x="29" y="14" width="6" height="40" rx="3" fill="#226688"/><circle cx="32" cy="12" r="5" fill="#66ddff"/><circle cx="30" cy="11" r="1.8" fill="#222"/><circle cx="34" cy="11" r="1.8" fill="#222"/>`,
  firefly: `<ellipse cx="32" cy="36" rx="10" ry="13" fill="#334422"/><ellipse cx="32" cy="46" rx="7" ry="6" fill="#d8ff6a"/><ellipse cx="22" cy="28" rx="9" ry="6" fill="#556644"/><ellipse cx="42" cy="28" rx="9" ry="6" fill="#556644"/><circle cx="32" cy="20" r="6" fill="#223311"/><circle cx="30" cy="19" r="1.6" fill="#fff"/><circle cx="34" cy="19" r="1.6" fill="#fff"/>`,
  fossil: `<rect x="10" y="36" width="44" height="18" rx="4" fill="#8a7a5a"/><path d="M32 14 q10 0 10 10 q0 8 -8 8 l-12 0 q-4 0 -4 -4 q0 -3 4 -3 l10 0 q3 0 3 -3 q0 -3 -4 -3 l-6 0" stroke="#f2ecd8" stroke-width="4" fill="none" stroke-linecap="round"/><circle cx="21" cy="17" r="4" fill="#f2ecd8"/>`,
  gyroid: `<rect x="22" y="18" width="20" height="34" rx="9" fill="#c9855a"/><circle cx="32" cy="16" r="7" fill="#c9855a"/><circle cx="29" cy="15" r="1.8" fill="#4a2a1a"/><circle cx="35" cy="15" r="1.8" fill="#4a2a1a"/><ellipse cx="32" cy="24" rx="4" ry="5" fill="#4a2a1a"/><rect x="16" y="30" width="6" height="4" rx="2" fill="#c9855a"/><rect x="42" y="30" width="6" height="4" rx="2" fill="#c9855a"/>`,
};

// ---------------- 商品造型模板（参数化配色） ----------------
type Tpl = (c1: string, c2: string) => string;
export const SHAPE_TPLS: Record<string, Tpl> = {
  chair: (c1, c2) => `<rect x="18" y="30" width="28" height="6" rx="2" fill="${c1}"/><rect x="18" y="12" width="6" height="24" rx="2" fill="${c1}"/><rect x="20" y="36" width="4" height="16" fill="${c2}"/><rect x="40" y="36" width="4" height="16" fill="${c2}"/><rect x="24" y="14" width="4" height="16" fill="${c2}" opacity="0.5"/>`,
  armchair: (c1, c2) => `<rect x="14" y="26" width="36" height="18" rx="6" fill="${c1}"/><rect x="14" y="14" width="36" height="14" rx="6" fill="${c2}"/><rect x="10" y="24" width="8" height="20" rx="3" fill="${c1}"/><rect x="46" y="24" width="8" height="20" rx="3" fill="${c1}"/><rect x="18" y="44" width="4" height="8" fill="#6a4a2a"/><rect x="42" y="44" width="4" height="8" fill="#6a4a2a"/>`,
  sofa: (c1, c2) => `<rect x="8" y="24" width="48" height="16" rx="5" fill="${c1}"/><rect x="8" y="12" width="48" height="12" rx="5" fill="${c2}"/><rect x="5" y="22" width="7" height="20" rx="3" fill="${c1}"/><rect x="52" y="22" width="7" height="20" rx="3" fill="${c1}"/><rect x="12" y="26" width="18" height="10" rx="3" fill="${c2}"/><rect x="34" y="26" width="18" height="10" rx="3" fill="${c2}"/><rect x="12" y="42" width="4" height="8" fill="#6a4a2a"/><rect x="48" y="42" width="4" height="8" fill="#6a4a2a"/>`,
  table: (c1, c2) => `<rect x="12" y="24" width="40" height="6" rx="2" fill="${c1}"/><rect x="16" y="30" width="5" height="20" fill="${c2}"/><rect x="43" y="30" width="5" height="20" fill="${c2}"/><ellipse cx="32" cy="21" rx="8" ry="4" fill="${c2}" opacity="0.6"/>`,
  desk: (c1, c2) => `<rect x="10" y="22" width="44" height="5" rx="2" fill="${c1}"/><rect x="12" y="27" width="10" height="22" fill="${c2}"/><rect x="42" y="27" width="5" height="22" fill="${c2}"/><rect x="14" y="30" width="6" height="3" fill="${c1}"/><rect x="14" y="36" width="6" height="3" fill="${c1}"/>`,
  bed: (c1, c2) => `<rect x="10" y="20" width="8" height="26" rx="3" fill="${c1}"/><rect x="12" y="30" width="42" height="14" rx="4" fill="${c2}"/><rect x="14" y="24" width="12" height="8" rx="3" fill="#ffffff"/><rect x="30" y="32" width="22" height="10" rx="3" fill="${c1}"/><rect x="14" y="44" width="4" height="8" fill="#6a4a2a"/><rect x="48" y="44" width="4" height="8" fill="#6a4a2a"/>`,
  lamp: (c1, c2) => `<path d="M32 12 L44 30 L20 30 Z" fill="${c1}"/><rect x="30" y="30" width="4" height="16" fill="${c2}"/><rect x="24" y="46" width="16" height="4" rx="2" fill="${c2}"/><circle cx="32" cy="32" r="3" fill="#fff2c0"/>`,
  shelf: (c1, c2) => `<rect x="14" y="10" width="36" height="42" rx="2" fill="${c1}"/><rect x="17" y="15" width="30" height="4" fill="${c2}"/><rect x="17" y="25" width="30" height="4" fill="${c2}"/><rect x="17" y="35" width="30" height="4" fill="${c2}"/><rect x="20" y="19" width="5" height="6" fill="#e84a3a"/><rect x="28" y="19" width="5" height="6" fill="#4aa3ff"/><rect x="22" y="29" width="5" height="6" fill="#5ab88a"/><rect x="32" y="39" width="5" height="6" fill="#f7d02c"/>`,
  dresser: (c1, c2) => `<rect x="14" y="16" width="36" height="34" rx="2" fill="${c1}"/><rect x="18" y="20" width="28" height="8" rx="2" fill="${c2}"/><rect x="18" y="32" width="28" height="8" rx="2" fill="${c2}"/><circle cx="32" cy="24" r="2" fill="#6a4a2a"/><circle cx="32" cy="36" r="2" fill="#6a4a2a"/>`,
  wardrobe: (c1, c2) => `<rect x="16" y="10" width="32" height="42" rx="3" fill="${c1}"/><rect x="31" y="10" width="2" height="42" fill="${c2}"/><circle cx="28" cy="30" r="2" fill="${c2}"/><circle cx="36" cy="30" r="2" fill="${c2}"/><rect x="20" y="52" width="6" height="3" fill="#6a4a2a"/><rect x="38" y="52" width="6" height="3" fill="#6a4a2a"/>`,
  rug: (c1, c2) => `<ellipse cx="32" cy="34" rx="24" ry="16" fill="${c1}"/><ellipse cx="32" cy="34" rx="16" ry="10" fill="${c2}"/><ellipse cx="32" cy="34" rx="8" ry="5" fill="${c1}"/>`,
  plant: (c1, c2) => `<path d="M32 34 q-12 -4 -12 -18 q10 2 12 12 q2 -10 12 -12 q0 14 -12 18" fill="${c1}"/><path d="M26 36 h12 l-2 14 h-8 Z" fill="${c2}"/>`,
  clock: (c1, c2) => `<circle cx="32" cy="28" r="16" fill="${c1}"/><circle cx="32" cy="28" r="12" fill="#ffffff"/><path d="M32 28 L32 20 M32 28 L38 30" stroke="#333" stroke-width="2"/><rect x="28" y="44" width="8" height="10" fill="${c2}"/>`,
  tv: (c1, c2) => `<rect x="12" y="16" width="40" height="26" rx="3" fill="${c2}"/><rect x="15" y="19" width="34" height="20" rx="2" fill="${c1}"/><rect x="28" y="42" width="8" height="6" fill="${c2}"/><rect x="20" y="48" width="24" height="3" fill="${c2}"/>`,
  radio: (c1, c2) => `<rect x="14" y="22" width="36" height="20" rx="4" fill="${c1}"/><circle cx="24" cy="32" r="7" fill="${c2}"/><rect x="36" y="26" width="10" height="2" fill="${c2}"/><rect x="36" y="30" width="10" height="2" fill="${c2}"/><rect x="36" y="34" width="10" height="2" fill="${c2}"/><path d="M18 22 L30 10" stroke="#888" stroke-width="2"/>`,
  fan: (c1, c2) => `<circle cx="32" cy="26" r="14" fill="${c2}"/><path d="M32 26 q10 -10 4 -14 q-10 2 -4 14 q-10 10 -4 14 q10 -2 4 -14" fill="${c1}"/><rect x="30" y="40" width="4" height="8" fill="${c2}"/><rect x="22" y="48" width="20" height="4" rx="2" fill="${c2}"/>`,
  vase: (c1, c2) => `<path d="M26 18 h12 q2 10 6 16 q4 8 -2 16 q-6 4 -10 4 q-4 0 -10 -4 q-6 -8 -2 -16 q4 -6 6 -16" fill="${c1}"/><path d="M26 24 q6 4 12 0" stroke="${c2}" stroke-width="2" fill="none"/>`,
  picture: (c1, c2) => `<rect x="12" y="14" width="40" height="30" rx="2" fill="${c2}"/><rect x="15" y="17" width="34" height="24" fill="${c1}"/><circle cx="24" cy="25" r="4" fill="#fff2c0"/><path d="M15 41 L28 28 L38 38 L45 31 L49 41 Z" fill="#5ab88a"/>`,
  cushion: (c1, c2) => `<rect x="14" y="18" width="36" height="28" rx="10" fill="${c1}"/><rect x="20" y="24" width="24" height="16" rx="7" fill="${c2}"/>`,
  stool: (c1, c2) => `<ellipse cx="32" cy="22" rx="16" ry="6" fill="${c1}"/><rect x="20" y="24" width="4" height="22" fill="${c2}"/><rect x="40" y="24" width="4" height="22" fill="${c2}"/><rect x="22" y="38" width="20" height="3" fill="${c2}"/>`,
  piano: (c1, c2) => `<rect x="10" y="22" width="44" height="16" rx="3" fill="${c1}"/><rect x="14" y="30" width="36" height="6" fill="#ffffff"/><path d="M16 30 v6 M20 30 v6 M24 30 v6 M30 30 v6 M34 30 v6 M40 30 v6 M44 30 v6" stroke="#333" stroke-width="1.5"/><rect x="14" y="38" width="4" height="14" fill="${c2}"/><rect x="46" y="38" width="4" height="14" fill="${c2}"/>`,
  guitar: (c1, c2) => `<circle cx="26" cy="40" r="10" fill="${c1}"/><circle cx="36" cy="32" r="8" fill="${c1}"/><circle cx="30" cy="35" r="3" fill="#4a2a1a"/><rect x="38" y="14" width="5" height="22" rx="2" fill="${c2}" transform="rotate(35 40 25)"/><path d="M40 14 L46 22" stroke="#333" stroke-width="1.5"/>`,
  globe: (c1, c2) => `<circle cx="32" cy="28" r="15" fill="${c1}"/><path d="M20 24 q8 6 16 2 q6 -3 10 2 M24 36 q8 -4 16 0" stroke="${c2}" stroke-width="2.5" fill="none"/><path d="M32 43 v6 M22 52 h20" stroke="#8a6a45" stroke-width="3"/>`,
  telescope: (c1, c2) => `<rect x="16" y="16" width="28" height="8" rx="4" fill="${c1}" transform="rotate(-20 30 20)"/><circle cx="46" cy="13" r="5" fill="${c2}"/><path d="M30 24 L24 48 M30 24 L36 48 M30 24 L30 46" stroke="${c2}" stroke-width="2.5"/>`,
  doll: (c1, c2) => `<circle cx="32" cy="20" r="9" fill="${c2}"/><rect x="24" y="28" width="16" height="18" rx="6" fill="${c1}"/><circle cx="29" cy="19" r="1.6" fill="#333"/><circle cx="35" cy="19" r="1.6" fill="#333"/><path d="M29 24 q3 2 6 0" stroke="#333" stroke-width="1.5" fill="none"/><rect x="18" y="30" width="6" height="4" rx="2" fill="${c1}"/><rect x="40" y="30" width="6" height="4" rx="2" fill="${c1}"/>`,
  trophy: (c1, c2) => `<path d="M22 12 h20 v10 q0 10 -10 10 q-10 0 -10 -10 Z" fill="${c1}"/><path d="M22 14 q-8 0 -6 8 q2 5 8 4 M42 14 q8 0 6 8 q-2 5 -8 4" stroke="${c1}" stroke-width="3" fill="none"/><rect x="29" y="32" width="6" height="8" fill="${c2}"/><rect x="22" y="40" width="20" height="6" rx="2" fill="${c2}"/>`,
  ball: (c1, c2) => `<circle cx="32" cy="32" r="18" fill="${c1}"/><path d="M14 32 h36 M32 14 q8 18 0 36" stroke="${c2}" stroke-width="3" fill="none"/>`,
  umbrella: (c1, c2) => `<path d="M8 30 q24 -22 48 0 q-6 -4 -12 0 q-6 -4 -12 0 q-6 -4 -12 0 q-6 -4 -12 0" fill="${c1}"/><rect x="30" y="30" width="3" height="18" fill="${c2}"/><path d="M33 48 q0 5 -5 4" stroke="${c2}" stroke-width="3" fill="none"/>`,
  basket: (c1, c2) => `<path d="M16 26 h32 l-4 22 h-24 Z" fill="${c1}"/><path d="M22 26 q10 -14 20 0" stroke="${c2}" stroke-width="3" fill="none"/><path d="M18 32 h28 M19 38 h26 M21 44 h22" stroke="${c2}" stroke-width="1.5"/>`,
  mirror: (c1, c2) => `<ellipse cx="32" cy="28" rx="14" ry="18" fill="${c2}"/><ellipse cx="32" cy="28" rx="10" ry="14" fill="${c1}"/><rect x="28" y="46" width="8" height="6" fill="${c2}"/>`,
  bath: (c1, c2) => `<rect x="10" y="26" width="44" height="18" rx="8" fill="${c1}"/><rect x="14" y="28" width="36" height="8" rx="4" fill="${c2}"/><circle cx="24" cy="24" r="3" fill="#ffffff" opacity="0.8"/><circle cx="30" cy="21" r="2.5" fill="#ffffff" opacity="0.8"/><rect x="16" y="44" width="4" height="6" fill="#8a6a45"/><rect x="44" y="44" width="4" height="6" fill="#8a6a45"/>`,
  fridge: (c1, c2) => `<rect x="18" y="10" width="28" height="42" rx="3" fill="${c1}"/><rect x="18" y="24" width="28" height="3" fill="${c2}"/><rect x="38" y="15" width="3" height="6" fill="${c2}"/><rect x="38" y="30" width="3" height="10" fill="${c2}"/>`,
  stove: (c1, c2) => `<rect x="14" y="18" width="36" height="30" rx="3" fill="${c1}"/><circle cx="24" cy="24" r="5" fill="${c2}"/><circle cx="40" cy="24" r="5" fill="${c2}"/><rect x="18" y="34" width="28" height="10" rx="2" fill="${c2}"/>`,
  sink: (c1, c2) => `<rect x="16" y="26" width="32" height="10" rx="4" fill="${c1}"/><rect x="20" y="36" width="24" height="14" fill="${c2}"/><path d="M28 26 v-6 q0 -3 4 -3 q4 0 4 3" stroke="#aaa" stroke-width="3" fill="none"/>`,
  toilet: (c1, c2) => `<rect x="20" y="12" width="18" height="14" rx="3" fill="${c1}"/><ellipse cx="28" cy="36" rx="12" ry="10" fill="${c1}"/><ellipse cx="28" cy="34" rx="7" ry="5" fill="${c2}"/><rect x="22" y="44" width="12" height="6" fill="${c2}"/>`,
  washing: (c1, c2) => `<rect x="16" y="14" width="32" height="38" rx="4" fill="${c1}"/><circle cx="32" cy="36" r="10" fill="${c2}"/><circle cx="32" cy="36" r="6" fill="#bdeaff"/><rect x="20" y="18" width="10" height="4" fill="${c2}"/>`,
  food: (c1, c2) => `<ellipse cx="32" cy="38" rx="20" ry="10" fill="#ffffff"/><ellipse cx="32" cy="36" rx="16" ry="8" fill="${c2}"/><circle cx="26" cy="34" r="5" fill="${c1}"/><circle cx="36" cy="37" r="4" fill="${c1}"/><circle cx="33" cy="31" r="3.5" fill="${c1}"/>`,
  drink: (c1, c2) => `<rect x="24" y="16" width="16" height="28" rx="4" fill="${c1}"/><rect x="26" y="22" width="12" height="16" rx="2" fill="${c2}"/><rect x="30" y="8" width="3" height="10" fill="#e84a3a"/>`,
  medicine: (c1, c2) => `<rect x="18" y="20" width="28" height="26" rx="5" fill="${c1}"/><rect x="28" y="26" width="8" height="14" fill="#ffffff"/><rect x="25" y="29" width="14" height="8" fill="#ffffff"/><rect x="22" y="12" width="4" height="10" rx="2" fill="${c2}" transform="rotate(30 24 17)"/>`,
  candy: (c1, c2) => `<circle cx="32" cy="32" r="10" fill="${c1}"/><path d="M24 28 L12 20 L16 32 L12 44 L24 36 M40 28 L52 20 L48 32 L52 44 L40 36" fill="${c2}"/><circle cx="32" cy="32" r="4" fill="#ffffff" opacity="0.6"/>`,
  seedling: (c1, c2) => `<path d="M32 44 v-14" stroke="#3e6e2a" stroke-width="3"/><path d="M32 34 q-10 0 -12 -12 q10 0 12 8 q2 -8 12 -8 q-2 12 -12 12" fill="${c1}"/><ellipse cx="32" cy="48" rx="14" ry="5" fill="${c2}"/>`,
  tool: (c1, c2) => `<rect x="28" y="20" width="6" height="28" rx="3" fill="${c2}"/><circle cx="31" cy="16" r="8" fill="${c1}"/><circle cx="31" cy="16" r="4" fill="#ffffff"/>`,
  floorlamp: (c1, c2) => `<path d="M32 8 L42 22 L22 22 Z" fill="${c1}"/><rect x="30" y="22" width="4" height="24" fill="${c2}"/><ellipse cx="32" cy="50" rx="12" ry="4" fill="${c2}"/>`,
  bookcase: (c1, c2) => `<rect x="14" y="8" width="36" height="46" rx="2" fill="${c1}"/><rect x="18" y="12" width="28" height="3" fill="${c2}"/><rect x="18" y="24" width="28" height="3" fill="${c2}"/><rect x="18" y="36" width="28" height="3" fill="${c2}"/><rect x="20" y="15" width="4" height="9" fill="#e84a3a"/><rect x="25" y="15" width="4" height="9" fill="#4aa3ff"/><rect x="30" y="15" width="4" height="9" fill="#5ab88a"/><rect x="22" y="27" width="4" height="9" fill="#f7d02c"/><rect x="28" y="27" width="4" height="9" fill="#e84ad0"/><rect x="24" y="39" width="4" height="9" fill="#4aa3ff"/><rect x="32" y="39" width="4" height="9" fill="#ff8a3a"/>`,
};

// ---------------- SVG → CanvasTexture（带缓存） ----------------
const texCache = new Map<string, THREE.CanvasTexture>();

export function itemSvgMarkup(id: string, shape?: string, c1?: string, c2?: string): string {
  const body = CREATURE_SVG[id] ?? (shape && SHAPE_TPLS[shape] ? SHAPE_TPLS[shape](c1 ?? '#c9a86a', c2 ?? '#8a6239') : `<circle cx="32" cy="32" r="16" fill="#ccc"/>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">${body}</svg>`;
}

export function itemSvgTexture(id: string, shape?: string, c1?: string, c2?: string): THREE.CanvasTexture {
  const key = `${id}|${shape ?? ''}|${c1 ?? ''}|${c2 ?? ''}`;
  const hit = texCache.get(key);
  if (hit) return hit;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const tex = new THREE.CanvasTexture(canvas);
  const img = new Image();
  img.onload = () => { ctx.drawImage(img, 0, 0, 128, 128); tex.needsUpdate = true; };
  img.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(itemSvgMarkup(id, shape, c1, c2));
  texCache.set(key, tex);
  return tex;
}

export function itemSvgDataUrl(id: string, shape?: string, c1?: string, c2?: string): string {
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(itemSvgMarkup(id, shape, c1, c2));
}

export function hasCreatureSvg(id: string): boolean {
  return id in CREATURE_SVG;
}
