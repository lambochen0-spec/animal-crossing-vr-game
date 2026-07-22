// SVG 地板/墙纸生成器：200×200 一格，供室内贴图平铺使用
const head = (body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">${body}</svg>`;

// 木地板（横向木板）
export function floorPlanks(base: string, seam: string): string {
  let rows = '';
  for (let y = 0; y < 200; y += 40) {
    rows += `<rect x="0" y="${y}" width="200" height="38" fill="${base}"/>`
      + `<rect x="0" y="${y + 38}" width="200" height="2" fill="${seam}"/>`
      + `<rect x="${(y / 40) % 2 === 0 ? 70 : 140}" y="${y}" width="2" height="38" fill="${seam}"/>`;
  }
  return head(`<rect width="200" height="200" fill="${base}"/>${rows}`);
}

// 棋盘格地板
export function floorChecker(a: string, b: string): string {
  let cells = '';
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    cells += `<rect x="${i * 50}" y="${j * 50}" width="50" height="50" fill="${(i + j) % 2 ? b : a}"/>`;
  }
  return head(cells);
}

// 圆点墙纸
export function wallDots(bg: string, dot: string): string {
  let dots = '';
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    dots += `<circle cx="${i * 50 + 25}" cy="${j * 50 + (i % 2 ? 25 : 0) + 12}" r="7" fill="${dot}"/>`;
  }
  return head(`<rect width="200" height="200" fill="${bg}"/>${dots}`);
}

// 条纹墙纸
export function wallStripes(bg: string, stripe: string): string {
  let s = '';
  for (let x = 0; x < 200; x += 50) s += `<rect x="${x}" width="22" height="200" fill="${stripe}"/>`;
  return head(`<rect width="200" height="200" fill="${bg}"/>${s}`);
}

// 爱心墙纸（胖丁风）
export function wallHearts(bg: string, heart: string): string {
  const h = (x: number, y: number, s: number) =>
    `<g transform="translate(${x},${y}) scale(${s})"><path d="M0 6 C0 2 4 -2 8 -2 C12 -2 14 1 14 3 C14 1 16 -2 20 -2 C24 -2 28 2 28 6 C28 12 14 20 14 22 C14 20 0 12 0 6 Z" fill="${heart}"/></g>`;
  return head(`<rect width="200" height="200" fill="${bg}"/>${h(30, 30, 1.4)}${h(120, 60, 1)}${h(60, 130, 1.1)}${h(150, 150, 1.4)}${h(110, 110, 0.8)}`);
}

// 波浪墙纸（水系）
export function wallWaves(bg: string, wave: string): string {
  let w = '';
  for (let y = 30; y < 200; y += 55) {
    w += `<path d="M0 ${y} Q25 ${y - 16} 50 ${y} T100 ${y} T150 ${y} T200 ${y}" stroke="${wave}" stroke-width="7" fill="none" stroke-linecap="round"/>`;
  }
  return head(`<rect width="200" height="200" fill="${bg}"/>${w}`);
}

// 叶子墙纸（草系）
export function wallLeaves(bg: string, leaf: string): string {
  const l = (x: number, y: number, r: number, s: number) =>
    `<g transform="translate(${x},${y}) rotate(${r}) scale(${s})"><ellipse cx="0" cy="0" rx="9" ry="17" fill="${leaf}"/><rect x="-1" y="-17" width="2" height="34" fill="${bg}" opacity="0.5"/></g>`;
  return head(`<rect width="200" height="200" fill="${bg}"/>${l(40, 50, -25, 1)}${l(130, 35, 30, 0.8)}${l(70, 130, 15, 1.1)}${l(160, 120, -35, 0.9)}${l(30, 170, 40, 0.7)}${l(150, 175, -10, 0.8)}`);
}

// 爪印墙纸（伊布风）
export function wallPaws(bg: string, paw: string): string {
  const p = (x: number, y: number, s: number) =>
    `<g transform="translate(${x},${y}) scale(${s})" fill="${paw}"><ellipse cx="0" cy="6" rx="10" ry="8"/><circle cx="-10" cy="-6" r="4"/><circle cx="0" cy="-9" r="4"/><circle cx="10" cy="-6" r="4"/></g>`;
  return head(`<rect width="200" height="200" fill="${bg}"/>${p(45, 50, 1.1)}${p(140, 90, 0.9)}${p(70, 150, 1)}${p(160, 170, 0.8)}${p(110, 30, 0.7)}`);
}

// 雪花墙纸（冰系）
export function wallSnow(bg: string, flake: string): string {
  const f = (x: number, y: number, s: number) =>
    `<g transform="translate(${x},${y}) scale(${s})" stroke="${flake}" stroke-width="3" stroke-linecap="round"><line x1="-10" y1="0" x2="10" y2="0"/><line x1="0" y1="-10" x2="0" y2="10"/><line x1="-7" y1="-7" x2="7" y2="7"/><line x1="-7" y1="7" x2="7" y2="-7"/></g>`;
  return head(`<rect width="200" height="200" fill="${bg}"/>${f(50, 45, 1.1)}${f(140, 80, 0.8)}${f(80, 140, 1)}${f(160, 165, 0.9)}${f(30, 175, 0.7)}`);
}

// 星星月亮墙纸（卡比兽的卧室）
export function wallStars(bg: string, star: string): string {
  const s = (x: number, y: number, sc: number) =>
    `<g transform="translate(${x},${y}) scale(${sc})"><path d="M0 -10 L2.5 -3 L10 -3 L4 2 L6 10 L0 5 L-6 10 L-4 2 L-10 -3 L-2.5 -3 Z" fill="${star}"/></g>`;
  const moon = `<path d="M160 30 A18 18 0 1 0 160 66 A14 14 0 1 1 160 30 Z" fill="${star}"/>`;
  return head(`<rect width="200" height="200" fill="${bg}"/>${moon}${s(40, 40, 1)}${s(90, 90, 0.7)}${s(50, 150, 0.9)}${s(140, 130, 0.6)}${s(110, 170, 0.8)}${s(30, 90, 0.5)}`);
}

// 火焰墙纸（小火龙风）
export function wallFlames(bg: string, flame: string): string {
  const f = (x: number, y: number, s: number) =>
    `<g transform="translate(${x},${y}) scale(${s})"><path d="M0 18 C-10 10 -8 0 -2 -6 C-2 -12 2 -16 4 -20 C10 -12 12 -4 8 2 C14 0 14 -4 14 -6 C18 2 16 12 8 18 Z" fill="${flame}"/></g>`;
  return head(`<rect width="200" height="200" fill="${bg}"/>${f(50, 50, 1.1)}${f(140, 90, 0.9)}${f(70, 140, 1)}${f(160, 170, 0.8)}${f(30, 175, 0.7)}`);
}
