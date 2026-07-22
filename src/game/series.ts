// 家具系列系统：每个系列 = 墙纸 + 地板 + 一整套家具（同款 SVG 风格贴图）
// 系列商品随机出现在商店每日轮换；坑洞/摇树/小动物赠送也有极小概率获得（对标原版）
import type { ShopGood } from './shopgoods';

export interface SeriesDef {
  id: string; name: string; icon: string;
  c1: string; c2: string; ac: string;   // 主色 / 辅色 / 点缀色
  wallSvg: string; floorSvg: string;    // 室内 200×200 墙纸 / 地板
  patSvg: string;                       // 家具表面 100×100 贴图
}

// ---------------- SVG 图案小帮手 ----------------
const svg = (w: number, h: number, bg: string, inner: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="${bg}"/>${inner}</svg>`;

// 星星路径
const star = (x: number, y: number, r: number, c: string) =>
  `<path d="M${x},${y - r} L${x + r * 0.3},${y - r * 0.3} L${x + r},${y} L${x + r * 0.3},${y + r * 0.3} L${x},${y + r} L${x - r * 0.3},${y + r * 0.3} L${x - r},${y} L${x - r * 0.3},${y - r * 0.3} Z" fill="${c}"/>`;
// 五瓣花
const flower5 = (x: number, y: number, r: number, petal: string, core: string) => {
  let s = '';
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    s += `<circle cx="${x + Math.cos(a) * r}" cy="${y + Math.sin(a) * r}" r="${r * 0.62}" fill="${petal}"/>`;
  }
  return s + `<circle cx="${x}" cy="${y}" r="${r * 0.45}" fill="${core}"/>`;
};
// 叶子
const leaf = (x: number, y: number, s: number, c: string, rot = 0) =>
  `<g transform="translate(${x},${y}) rotate(${rot})"><ellipse rx="${s}" ry="${s * 0.45}" fill="${c}"/><line x1="${-s}" y1="0" x2="${s}" y2="0" stroke="#00000022" stroke-width="1"/></g>`;
// 月亮
const moon = (x: number, y: number, r: number, c: string) =>
  `<path d="M${x},${y - r} A${r},${r} 0 1,0 ${x},${y + r} A${r * 0.75},${r * 0.75} 0 1,1 ${x},${y - r} Z" fill="${c}"/>`;
// 钻石
const gem = (x: number, y: number, r: number, c: string) =>
  `<path d="M${x},${y - r} L${x + r * 0.8},${y} L${x},${y + r} L${x - r * 0.8},${y} Z" fill="${c}"/><path d="M${x},${y - r} L${x + r * 0.8},${y} L${x},${y + r * 0.35} L${x - r * 0.8},${y} Z" fill="#ffffff55"/>`;

// ---------------- 六个系列 ----------------
function forestSet(): SeriesDef {
  const c1 = '#7ab648', c2 = '#4e7e2e', ac = '#c9a86a';
  const patInner =
    `<line x1="0" y1="25" x2="100" y2="25" stroke="#00000018" stroke-width="3"/>` +
    `<line x1="0" y1="75" x2="100" y2="75" stroke="#00000018" stroke-width="3"/>` +
    leaf(25, 30, 12, c2, -25) + leaf(70, 60, 12, c2, 20) + leaf(45, 85, 9, '#9ed06a', 40) + leaf(85, 15, 9, '#9ed06a', -40);
  const wallInner =
    Array.from({ length: 5 }, (_, i) => leaf(30 + (i % 3) * 60, 35 + i * 36, 16, i % 2 ? c2 : '#9ed06a', i * 55)).join('') +
    `<line x1="0" y1="100" x2="200" y2="100" stroke="#00000010" stroke-width="6"/>`;
  const floorInner =
    Array.from({ length: 5 }, (_, i) => `<rect x="0" y="${i * 40}" width="200" height="38" fill="${i % 2 ? '#b8935e' : '#c9a86a'}"/><line x1="0" y1="${i * 40}" x2="200" y2="${i * 40}" stroke="#8a6239" stroke-width="3"/>`).join('') +
    leaf(50, 60, 12, '#7ab648', 30) + leaf(150, 140, 12, '#7ab648', -60);
  return { id: 'forest', name: '森林', icon: '🌿', c1, c2, ac,
    wallSvg: svg(200, 200, '#dff2c8', wallInner), floorSvg: svg(200, 200, '#c9a86a', floorInner), patSvg: svg(100, 100, c1, patInner) };
}

function oceanSet(): SeriesDef {
  const c1 = '#4aa8e8', c2 = '#2a6ab0', ac = '#bdeaff';
  const bubble = (x: number, y: number, r: number) =>
    `<circle cx="${x}" cy="${y}" r="${r}" fill="#ffffff38"/><circle cx="${x - r * 0.3}" cy="${y - r * 0.3}" r="${r * 0.3}" fill="#ffffff88"/>`;
  const wave = (y: number, c: string) =>
    `<path d="M0,${y} Q12.5,${y - 8} 25,${y} T50,${y} T75,${y} T100,${y} T125,${y} T150,${y} T175,${y} T200,${y}" stroke="${c}" stroke-width="4" fill="none"/>`;
  const patInner = wave(30, c2) + wave(70, c2) + bubble(25, 50, 7) + bubble(70, 20, 5) + bubble(80, 85, 6);
  const wallInner = wave(50, ac) + wave(110, ac) + wave(170, ac) + bubble(50, 80, 12) + bubble(140, 30, 9) + bubble(110, 150, 10) + bubble(30, 180, 7);
  const floorInner =
    `<rect width="200" height="200" fill="#e8f4fa"/>` +
    Array.from({ length: 4 }, (_, i) => Array.from({ length: 4 }, (_, j) =>
      `<rect x="${i * 50 + 2}" y="${j * 50 + 2}" width="46" height="46" rx="8" fill="${(i + j) % 2 ? '#bfe4f5' : '#d8eefb'}"/>`).join('')).join('') +
    bubble(60, 60, 10) + bubble(150, 140, 12);
  return { id: 'ocean', name: '海洋', icon: '🫧', c1, c2, ac,
    wallSvg: svg(200, 200, '#7ec8f2', wallInner), floorSvg: svg(200, 200, '#e8f4fa', floorInner), patSvg: svg(100, 100, c1, patInner) };
}

function sakuraSet(): SeriesDef {
  const c1 = '#f7b8cd', c2 = '#e87ea0', ac = '#fff0f5';
  const patInner = flower5(25, 25, 10, ac, '#f7d02c') + flower5(75, 55, 8, ac, '#f7d02c') + flower5(35, 80, 7, '#ffffff', c2) +
    `<circle cx="85" cy="20" r="3" fill="#ffffff88"/><circle cx="15" cy="55" r="3" fill="#ffffff88"/><circle cx="60" cy="30" r="2.5" fill="#ffffff88"/>`;
  const wallInner = flower5(45, 45, 16, ac, '#f7d02c') + flower5(150, 90, 13, '#ffffff', c2) + flower5(70, 150, 14, ac, '#f7d02c') + flower5(170, 180, 10, '#ffffff', c2) +
    `<circle cx="110" cy="40" r="4" fill="#ffffff99"/><circle cx="30" cy="110" r="4" fill="#ffffff99"/><circle cx="130" cy="135" r="3" fill="#ffffff99"/>`;
  const floorInner =
    Array.from({ length: 5 }, (_, i) => `<rect x="0" y="${i * 40}" width="200" height="38" fill="${i % 2 ? '#f2dce4' : '#f7e8ee'}"/>`).join('') +
    flower5(50, 100, 14, '#f7b8cd', '#f7d02c') + flower5(150, 40, 11, '#f7b8cd', '#f7d02c') + flower5(160, 170, 10, '#f7b8cd', '#f7d02c');
  return { id: 'sakura', name: '樱花', icon: '🌸', c1, c2, ac,
    wallSvg: svg(200, 200, '#fbdce8', wallInner), floorSvg: svg(200, 200, '#f7e8ee', floorInner), patSvg: svg(100, 100, c1, patInner) };
}

function starrySet(): SeriesDef {
  const c1 = '#3a4a9a', c2 = '#232c5e', ac = '#f7d02c';
  const patInner = star(22, 22, 9, ac) + star(70, 40, 6, '#ffffff') + moon(72, 74, 12, ac) +
    `<circle cx="40" cy="60" r="2.5" fill="#ffffff"/><circle cx="15" cy="80" r="2" fill="#ffffff"/><circle cx="90" cy="15" r="2" fill="#ffffff"/>`;
  const wallInner = moon(55, 55, 26, ac) + star(140, 40, 12, '#ffffff') + star(170, 120, 9, ac) + star(40, 150, 11, '#ffffff') + star(110, 175, 7, ac) +
    `<circle cx="90" cy="90" r="3" fill="#ffffff"/><circle cx="160" cy="70" r="2.5" fill="#ffffff"/><circle cx="25" cy="100" r="2.5" fill="#ffffff"/><circle cx="120" cy="140" r="2" fill="#ffffff"/>`;
  const floorInner =
    Array.from({ length: 4 }, (_, i) => Array.from({ length: 4 }, (_, j) =>
      `<rect x="${i * 50 + 2}" y="${j * 50 + 2}" width="46" height="46" fill="${(i + j) % 2 ? '#2c3768' : '#232c5e'}"/>`).join('')).join('') +
    star(75, 75, 14, ac) + star(175, 175, 10, '#ffffff') + star(175, 25, 8, '#ffffff') + star(25, 175, 8, ac);
  return { id: 'starry', name: '星空', icon: '🌙', c1, c2, ac,
    wallSvg: svg(200, 200, '#3a4a9a', wallInner), floorSvg: svg(200, 200, '#232c5e', floorInner), patSvg: svg(100, 100, c1, patInner) };
}

function chocoSet(): SeriesDef {
  const c1 = '#8a5a34', c2 = '#5e3a20', ac = '#f7e3c8';
  const sprinkles = (cols: string[], n: number, w: number, h: number) =>
    Array.from({ length: n }, (_, i) => {
      const x = (i * 37 + 13) % w, y = (i * 53 + 29) % h;
      return `<rect x="${x}" y="${y}" width="10" height="3.5" rx="1.75" fill="${cols[i % cols.length]}" transform="rotate(${(i * 47) % 180} ${x} ${y})"/>`;
    }).join('');
  const drizzle = `<path d="M0,20 Q25,35 50,20 T100,20" stroke="${ac}" stroke-width="5" fill="none"/><path d="M0,60 Q25,75 50,60 T100,60" stroke="${ac}" stroke-width="5" fill="none"/>`;
  const patInner = drizzle + sprinkles(['#f7b8cd', '#7ec8f2', '#f7d02c', '#ffffff'], 10, 100, 100);
  const wallInner =
    `<path d="M0,45 Q50,75 100,45 T200,45" stroke="${ac}" stroke-width="9" fill="none"/>` +
    `<path d="M0,130 Q50,160 100,130 T200,130" stroke="${ac}" stroke-width="9" fill="none"/>` +
    sprinkles(['#f7b8cd', '#7ec8f2', '#f7d02c', '#ffffff'], 16, 200, 200);
  const floorInner =
    Array.from({ length: 4 }, (_, i) => Array.from({ length: 4 }, (_, j) =>
      `<rect x="${i * 50 + 2}" y="${j * 50 + 2}" width="46" height="46" rx="10" fill="${(i + j) % 2 ? '#a8744a' : '#96643c'}"/>`).join('')).join('') +
    sprinkles(['#f7e3c8', '#f7b8cd'], 12, 200, 200);
  return { id: 'choco', name: '甜点', icon: '🍫', c1, c2, ac,
    wallSvg: svg(200, 200, '#8a5a34', wallInner), floorSvg: svg(200, 200, '#96643c', floorInner), patSvg: svg(100, 100, c1, patInner) };
}

function royalSet(): SeriesDef {
  const c1 = '#6a4a9a', c2 = '#4a2e72', ac = '#f7d02c';
  const patInner = gem(25, 25, 11, ac) + gem(75, 75, 11, '#e8d5f5') +
    `<line x1="0" y1="50" x2="100" y2="50" stroke="${ac}" stroke-width="2.5" stroke-dasharray="8 6"/>` +
    `<circle cx="75" cy="20" r="3" fill="${ac}"/><circle cx="25" cy="80" r="3" fill="${ac}"/>`;
  const wallInner =
    Array.from({ length: 3 }, (_, i) => Array.from({ length: 2 }, (_, j) =>
      gem(50 + i * 55, 45 + j * 95, 20, (i + j) % 2 ? ac : '#e8d5f5')).join('')).join('') +
    `<line x1="0" y1="100" x2="200" y2="100" stroke="${ac}" stroke-width="4" stroke-dasharray="14 10"/>` +
    `<line x1="0" y1="8" x2="200" y2="8" stroke="${ac}" stroke-width="5"/><line x1="0" y1="192" x2="200" y2="192" stroke="${ac}" stroke-width="5"/>`;
  const floorInner =
    Array.from({ length: 4 }, (_, i) => Array.from({ length: 4 }, (_, j) =>
      `<rect x="${i * 50 + 2}" y="${j * 50 + 2}" width="46" height="46" fill="${(i + j) % 2 ? '#553a7e' : '#4a2e72'}"/>`).join('')).join('') +
    gem(100, 100, 26, ac) + gem(100, 100, 14, '#e8d5f5');
  return { id: 'royal', name: '皇家', icon: '👑', c1, c2, ac,
    wallSvg: svg(200, 200, '#5e3f8a', wallInner), floorSvg: svg(200, 200, '#4a2e72', floorInner), patSvg: svg(100, 100, c1, patInner) };
}

export const SETS: Record<string, SeriesDef> = Object.fromEntries(
  [forestSet(), oceanSet(), sakuraSet(), starrySet(), chocoSet(), royalSet()].map(s => [s.id, s]));

// ---------------- 系列商品目录 ----------------
// [shape, 中文名, icon, 基础价]
const PIECES: [string, string, string, number][] = [
  ['bed', '软床', '🛏️', 3400], ['sofa', '双人沙发', '🛋️', 2900], ['chair', '椅子', '🪑', 880],
  ['table', '桌子', '🪵', 1300], ['rug', '圆毯', '⭕', 1600], ['lamp', '台灯', '💡', 1080],
  ['dresser', '抽屉柜', '🗄️', 1900], ['shelf', '书架', '📚', 2100], ['clock', '挂钟', '🕰️', 1700],
  ['picture', '挂画', '🖼️', 1900], ['cushion', '坐垫', '🟨', 680], ['doll', '玩偶', '🧸', 2200],
];

export const SERIES_GOODS: ShopGood[] = Object.values(SETS).flatMap(s => {
  const furniture = PIECES.map(([shape, cn, icon, price]): ShopGood => ({
    id: `set_${s.id}_${shape}`, name: `${s.name}${cn}`, icon, price,
    cat: 'furniture', shape, c1: s.c1, c2: s.c2, set: s.id,
    desc: `${s.icon} ${s.name}系列家具，集齐一整套吧！`,
  }));
  const wall: ShopGood = {
    id: `set_${s.id}_wallpaper`, name: `${s.name}墙纸`, icon: '🧻', price: 2600,
    cat: 'furniture', shape: 'wallpaper', c1: s.c1, c2: s.c2, set: s.id,
    desc: `${s.icon} ${s.name}系列墙纸，在家里使用可以更换墙面`,
  };
  const floor: ShopGood = {
    id: `set_${s.id}_flooring`, name: `${s.name}地板`, icon: '🟫', price: 2600,
    cat: 'furniture', shape: 'flooring', c1: s.c1, c2: s.c2, set: s.id,
    desc: `${s.icon} ${s.name}系列地板，在家里使用可以更换地面`,
  };
  return [...furniture, wall, floor];
});

// 随机一件系列商品（坑洞/摇树/赠送用；家具为主，墙纸地板概率略低）
export function randomSetGoodId(): string {
  const s = Object.values(SETS)[Math.floor(Math.random() * 6)];
  const r = Math.random();
  if (r < 0.08) return `set_${s.id}_wallpaper`;
  if (r < 0.16) return `set_${s.id}_flooring`;
  const p = PIECES[Math.floor(Math.random() * PIECES.length)];
  return `set_${s.id}_${p[0]}`;
}
