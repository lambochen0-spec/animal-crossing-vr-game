// 程序化像素贴图：全部用 Canvas 手绘 16x16 像素，NearestFilter 保持锐利像素风
import * as THREE from 'three';

type Pix = (x: number, y: number, c: string) => void;

function makeCanvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d')!;
  const pix: Pix = (x, y, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1); };
  return { c, ctx, pix };
}

function toTexture(c: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// 简易噪声抖动
function dither(pix: Pix, w: number, h: number, base: string, spots: [string, number][]) {
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const r = Math.random();
    let acc = 0; let col = base;
    for (const [c, p] of spots) { acc += p; if (r < acc) { col = c; break; } }
    if (col !== base || base) pix(x, y, col);
  }
}

// ---------- 地形图集（48x16: 草顶 | 草侧 | 泥土 | 沙 | 沙侧 | 路 | 路侧 | 石板 | 石板侧） ----------
export function terrainAtlas(): THREE.CanvasTexture {
  const { c, pix } = makeCanvas(144, 16);
  const R = (i: number) => i * 16;
  // 0 草顶
  dither((x, y, col) => pix(R(0) + x, y, col), 16, 16, '#5fbf4a', [['#54b03f', 0.25], ['#6fce58', 0.2], ['#4da63b', 0.1]]);
  // 1 草侧：上3格草，下面泥土
  dither((x, y, col) => { if (y < 4) pix(R(1) + x, y, col); }, 16, 4, '#5fbf4a', [['#54b03f', 0.3], ['#6fce58', 0.2]]);
  dither((x, y, col) => pix(R(1) + x, y + 4, col), 16, 12, '#8a6239', [['#7a5330', 0.25], ['#9b7247', 0.2]]);
  // 2 泥土
  dither((x, y, col) => pix(R(2) + x, y, col), 16, 16, '#8a6239', [['#7a5330', 0.3], ['#9b7247', 0.2], ['#6b4527', 0.1]]);
  // 3 沙顶
  dither((x, y, col) => pix(R(3) + x, y, col), 16, 16, '#ead9a0', [['#e2cd8b', 0.3], ['#f4e6b4', 0.2]]);
  // 4 沙侧
  dither((x, y, col) => pix(R(4) + x, y, col), 16, 16, '#dcc687', [['#cfb877', 0.3], ['#ead9a0', 0.2]]);
  // 5 砖路顶
  dither((x, y, col) => { if (col) pix(R(5) + x, y, col); }, 16, 16, '', []);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const mortar = (y % 8 === 0) || ((x + (y < 8 ? 0 : 4)) % 8 === 0);
    pix(R(5) + x, y, mortar ? '#9d8f7a' : (Math.random() < 0.15 ? '#c9b997' : '#c2b28c'));
  }
  // 6 砖路侧
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    pix(R(6) + x, y, (y % 8 === 0) ? '#8d7f6a' : '#ad9c7b');
  }
  // 7 木板顶
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const seam = x % 4 === 0;
    pix(R(7) + x, y, seam ? '#7c5a33' : (Math.random() < 0.12 ? '#a5773f' : '#96683a'));
  }
  // 8 木板侧
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    pix(R(8) + x, y, (x % 4 === 0) ? '#6b4c2b' : '#845c33');
  }
  return toTexture(c);
}

// 地形图集区域（u0,u1）
export const ATLAS = {
  grassTop: [0 / 9, 1 / 9] as [number, number],
  grassSide: [1 / 9, 2 / 9] as [number, number],
  dirt: [2 / 9, 3 / 9] as [number, number],
  sandTop: [3 / 9, 4 / 9] as [number, number],
  sandSide: [4 / 9, 5 / 9] as [number, number],
  pathTop: [5 / 9, 6 / 9] as [number, number],
  pathSide: [6 / 9, 7 / 9] as [number, number],
  plankTop: [7 / 9, 8 / 9] as [number, number],
  plankSide: [8 / 9, 9 / 9] as [number, number],
};

// 重映射 BoxGeometry UV 到图集区域：top / bottom / side
export function remapBoxUV(geo: THREE.BoxGeometry, top: [number, number], side: [number, number], bottom?: [number, number]) {
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  // BoxGeometry 面顺序: +x,-x,+y,-y,+z,-z，每面4顶点
  for (let face = 0; face < 6; face++) {
    let region = side;
    if (face === 2) region = top;
    else if (face === 3) region = bottom || side;
    for (let v = 0; v < 4; v++) {
      const i = face * 4 + v;
      const u = uv.getX(i), w = uv.getY(i);
      uv.setXY(i, region[0] + u * (region[1] - region[0]), w);
    }
  }
  uv.needsUpdate = true;
}

// ---------- 水面 ----------
export function waterTexture(): THREE.CanvasTexture {
  const { c, pix } = makeCanvas(32, 32);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const r = Math.random();
    pix(x, y, r < 0.08 ? '#8fd8f0' : r < 0.2 ? '#5fb8e0' : '#3fa8d8');
  }
  const t = toTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(24, 24);
  return t;
}

// ---------- 树叶 / 树干 ----------
export function leafTexture(base = '#3e8e3a', light = '#55a54c', dark = '#2f7030'): THREE.CanvasTexture {
  const { c, pix } = makeCanvas(16, 16);
  dither(pix, 16, 16, base, [[light, 0.28], [dark, 0.22]]);
  return toTexture(c);
}
export function trunkTexture(): THREE.CanvasTexture {
  const { c, pix } = makeCanvas(16, 16);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const stripe = (x % 5 === 0) || (x % 5 === 1 && y % 7 < 3);
    pix(x, y, stripe ? '#5e4023' : (Math.random() < 0.1 ? '#7d5a35' : '#6e4c2a'));
  }
  return toTexture(c);
}

// ---------- 花朵 ----------
export function flowerTexture(petal: string, center: string): THREE.CanvasTexture {
  const { c, pix } = makeCanvas(8, 8);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const dx = x - 3.5, dy = y - 3.5;
    const d = dx * dx + dy * dy;
    if (d < 1.6) pix(x, y, center);
    else if (d < 9) pix(x, y, petal);
  }
  const t = toTexture(c);
  return t;
}

// ---------- SVG 小花（带茎叶花瓣，用于十字面片） ----------
export function flowerSvgTexture(petal: string, center: string): THREE.CanvasTexture {
  // SVG 绘制整株小花：茎、两片叶、五瓣花、花心
  const petals = Array.from({ length: 5 }, (_, k) =>
    `<ellipse cx="32" cy="13" rx="7" ry="10" fill="${petal}" stroke="rgba(0,0,0,0.12)" stroke-width="1" transform="rotate(${k * 72} 32 25)"/>`
  ).join('');
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">`
    + `<rect x="30.6" y="26" width="2.8" height="36" rx="1.4" fill="#3e8e3a"/>`
    + `<ellipse cx="24" cy="46" rx="7" ry="3.2" fill="#4aa44a" transform="rotate(-28 24 46)"/>`
    + `<ellipse cx="40" cy="52" rx="7" ry="3.2" fill="#4aa44a" transform="rotate(28 40 52)"/>`
    + petals
    + `<circle cx="32" cy="25" r="6" fill="${center}" stroke="rgba(0,0,0,0.15)" stroke-width="1"/>`
    + `</svg>`;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  const img = new Image();
  img.onload = () => { ctx.drawImage(img, 0, 0, 128, 128); tex.needsUpdate = true; };
  img.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  return tex;
}

// ---------- SVG 帐篷布（条纹 + 波浪裙边 + 顶部加深；可选把门帘直接印在篷布正面） ----------
export function tentSvgTexture(main: string, accent: string, door = false): THREE.CanvasTexture {
  let stripes = '';
  for (let i = 0; i < 8; i++) {
    stripes += `<rect x="${i * 32}" y="0" width="32" height="230" fill="${i % 2 ? accent : main}"/>`;
  }
  let scallop = '';
  for (let i = 0; i < 8; i++) {
    scallop += `<circle cx="${i * 32 + 16}" cy="230" r="16" fill="${i % 2 ? accent : main}"/>`;
  }
  // 门帘印在 u≈0.75 的那个面中央（旋转后朝向 +z 正面）
  const doorSvg = door
    ? `<rect x="194" y="118" width="28" height="138" fill="#4a3a2a"/>`                 // 门洞
      + `<path d="M194 118 L206 118 Q201 190 198 256 L194 256 Z" fill="${accent}"/>`  // 左帘
      + `<path d="M222 118 L210 118 Q215 190 218 256 L222 256 Z" fill="${accent}"/>`  // 右帘
      + `<circle cx="200" cy="170" r="3.5" fill="#e2556b"/>`                          // 系带
      + `<circle cx="216" cy="170" r="3.5" fill="#e2556b"/>`
      + `<rect x="189" y="108" width="38" height="9" rx="3" fill="#8a6239"/>`         // 门楣
    : '';
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">`
    + stripes + scallop + doorSvg
    + `<rect x="0" y="0" width="256" height="40" fill="rgba(0,0,0,0.18)"/>`
    + `<rect x="0" y="210" width="256" height="10" fill="rgba(0,0,0,0.15)"/>`
    + `</svg>`;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = main; ctx.fillRect(0, 0, 256, 256); // 解码前先铺主色
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  const img = new Image();
  img.onload = () => { ctx.drawImage(img, 0, 0, 256, 256); tex.needsUpdate = true; };
  img.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  return tex;
}

// ---------- SVG 帐篷门帘（掀起的布帘 + 深色门洞 + 门楣门槛） ----------
export function tentDoorSvgTexture(): THREE.CanvasTexture {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 64 64">`
    + `<rect x="15" y="8" width="34" height="56" rx="2" fill="#4a3a2a"/>`                       // 门洞
    + `<path d="M15 8 L27 8 Q22 36 18 64 L15 64 Z" fill="#f7f0e0"/>`                             // 左帘（掀起）
    + `<path d="M49 8 L37 8 Q42 36 46 64 L49 64 Z" fill="#f7f0e0"/>`                             // 右帘（掀起）
    + `<circle cx="20" cy="30" r="3" fill="#e2556b"/>`                                           // 左帘系带
    + `<circle cx="44" cy="30" r="3" fill="#e2556b"/>`                                           // 右帘系带
    + `<rect x="12" y="4" width="40" height="5" rx="2" fill="#8a6239"/>`                         // 门楣
    + `<rect x="11" y="61" width="42" height="3" rx="1" fill="#8a6239"/>`                        // 门槛
    + `</svg>`;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  const img = new Image();
  img.onload = () => { ctx.drawImage(img, 0, 0, 128, 128); tex.needsUpdate = true; };
  img.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  return tex;
}

// ---------- 角色脸（16x16：玩家 + 各宝可梦官方脸谱） ----------
export function faceTexture(kind: 'player' | VillagerFace, skin: string, muzzle?: string): THREE.CanvasTexture {
  const { c, pix } = makeCanvas(16, 16);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) pix(x, y, skin);
  const eye = '#26262e';
  const rect = (x0: number, y0: number, w: number, h: number, col: string) => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) pix(x, y, col);
  };

  if (kind === 'player') {
    // 大椭圆眼睛（竖长），带高光
    for (const ex of [4, 10]) {
      rect(ex, 7, 2, 4, eye);
      pix(ex, 7, '#ffffff');
    }
    // 小三角鼻
    pix(7, 10, '#c98a6a'); pix(8, 10, '#c98a6a'); pix(7, 11, '#b87757'); pix(8, 11, '#b87757');
    // 腮红
    pix(2, 11, '#ffb0a0'); pix(3, 11, '#ffb0a0'); pix(12, 11, '#ffb0a0'); pix(13, 11, '#ffb0a0');
    // 微笑
    pix(6, 12, '#8a4a3a'); rect(7, 13, 2, 1, '#8a4a3a'); pix(9, 12, '#8a4a3a');
  } else if (kind === 'pikachu') {
    // 皮卡丘：黑色圆眼 + 红色电气袋脸颊 + 小猫嘴
    for (const ex of [4, 10]) {
      rect(ex, 6, 2, 3, eye);
      pix(ex, 6, '#ffffff');
    }
    // 红色圆脸颊（电气袋）
    rect(0, 9, 3, 3, '#e8452c'); rect(13, 9, 3, 3, '#e8452c');
    pix(1, 9, '#f77a5e'); pix(14, 9, '#f77a5e');
    // 小鼻子 + 小猫嘴
    pix(7, 9, '#4a3025'); pix(8, 9, '#4a3025');
    pix(6, 11, '#8a4a3a'); pix(9, 11, '#8a4a3a'); rect(7, 12, 2, 1, '#8a4a3a');
  } else if (kind === 'meowth') {
    // 喵喵：大白眼 + 竖瞳 + 张嘴笑 + 胡须印（金币为3D）
    for (const ex of [3, 10]) {
      rect(ex, 5, 3, 5, '#ffffff');
      rect(ex + 1, 6, 1, 3, eye);
    }
    // 胡须印
    for (const wy of [9, 10]) {
      pix(0, wy, '#c9b89a'); pix(1, wy, '#c9b89a'); pix(14, wy, '#c9b89a'); pix(15, wy, '#c9b89a');
    }
    // 张嘴笑 + 小尖牙
    rect(5, 12, 6, 2, '#b04a3a');
    pix(5, 12, '#ffffff'); pix(10, 12, '#ffffff');
  } else if (kind === 'jigglypuff') {
    // 胖丁：超大蓝绿色眼睛 + 小嘴
    for (const ex of [3, 9]) {
      rect(ex, 5, 4, 5, '#3d9e8f');
      rect(ex, 5, 2, 2, '#ffffff');
      rect(ex + 1, 7, 2, 3, '#2a7a6e');
    }
    // 小嘴
    pix(7, 12, '#a85a6a'); rect(7, 13, 2, 1, '#a85a6a'); pix(9, 12, '#a85a6a');
    // 淡腮红
    pix(1, 10, '#f7a8b8'); pix(14, 10, '#f7a8b8');
  } else if (kind === 'eevee') {
    // 伊布：棕色大眼 + 小鼻嘴
    for (const ex of [4, 10]) {
      rect(ex, 6, 2, 4, '#4a2e1a');
      pix(ex, 6, '#ffffff');
    }
    rect(7, 10, 2, 1, '#3a2a1e');
    pix(6, 12, '#8a5a4a'); pix(9, 12, '#8a5a4a'); rect(7, 13, 2, 1, '#8a5a4a');
  } else if (kind === 'snorlax') {
    // 卡比兽：奶油色大脸盘 + 眯成线的睡眼
    rect(0, 5, 16, 11, muzzle || '#f7ecd0');
    // 闭合的睡眼（横线）
    rect(3, 7, 3, 1, eye); rect(10, 7, 3, 1, eye);
    // 小嘴 + 两颗小牙
    rect(7, 11, 2, 1, '#8a5a4a');
    pix(6, 10, '#ffffff'); pix(9, 10, '#ffffff');
  } else if (kind === 'psyduck') {
    // 可达鸭：呆滞白眼 + 小瞳孔（喙为3D）
    for (const ex of [3, 10]) {
      rect(ex, 5, 3, 4, '#ffffff');
    }
    pix(4, 7, eye); pix(11, 7, eye);
    // 淡淡的困惑眉
    pix(3, 4, '#d9b83a'); pix(12, 4, '#d9b83a');
  } else if (kind === 'charmander') {
    // 小火龙：蓝色大眼 + 小尖牙微笑
    for (const ex of [4, 10]) {
      rect(ex, 6, 2, 4, '#3a6ab8');
      pix(ex, 6, '#ffffff');
    }
    rect(4, 11, 8, 4, muzzle || '#ffe8b0');
    pix(5, 12, '#8a4a3a'); rect(6, 13, 4, 1, '#8a4a3a'); pix(10, 12, '#8a4a3a');
    pix(6, 13, '#ffffff'); pix(9, 13, '#ffffff');
  } else if (kind === 'squirtle') {
    // 杰尼龟：红棕色大眼 + 浅色吻部 + 微笑
    for (const ex of [4, 10]) {
      rect(ex, 6, 2, 4, '#7a3a2a');
      pix(ex, 6, '#ffffff');
    }
    rect(4, 10, 8, 5, muzzle || '#fff3c9');
    pix(5, 12, '#8a5a4a'); rect(6, 13, 4, 1, '#8a5a4a'); pix(10, 12, '#8a5a4a');
  } else if (kind === 'bulbasaur') {
    // 妙蛙种子：红色大眼 + 宽嘴笑 + 额头深斑
    for (const ex of [3, 10]) {
      rect(ex, 6, 3, 4, '#c93a3a');
      pix(ex, 6, '#ffffff');
    }
    // 额头斑块
    rect(5, 2, 2, 2, '#3a8a72'); rect(10, 3, 2, 1, '#3a8a72'); pix(8, 4, '#3a8a72');
    // 宽嘴笑
    rect(4, 12, 8, 1, '#8a4a3a');
    pix(4, 11, '#8a4a3a'); pix(11, 11, '#8a4a3a');
  } else if (kind === 'penguin') {
    // 波加曼：白色大脸盘 + 黑亮眼睛（喙为3D）
    rect(2, 4, 12, 11, muzzle || '#e8f0f7');
    for (const ex of [4, 10]) {
      rect(ex, 6, 2, 3, eye);
      pix(ex, 6, '#ffffff');
    }
    rect(7, 10, 2, 2, '#e8a33b');
  } else if (kind === 'togepi') {
    // 波克比：黑白大圆眼 + 红蓝三角斑纹
    for (const ex of [3, 10]) { rect(ex, 6, 3, 4, eye); pix(ex, 6, '#ffffff'); }
    rect(1, 2, 2, 2, '#e84a3a'); rect(13, 2, 2, 2, '#4aa3ff'); rect(7, 1, 2, 2, '#e84a3a');
    pix(6, 11, '#8a4a3a'); pix(9, 11, '#8a4a3a'); rect(7, 12, 2, 1, '#8a4a3a');
    pix(2, 10, '#ffb0a0'); pix(13, 10, '#ffb0a0');
  } else if (kind === 'gengar') {
    // 耿鬼：红眼坏笑
    rect(3, 5, 4, 2, '#e84a3a'); rect(9, 5, 4, 2, '#e84a3a');
    pix(4, 5, '#7a1020'); pix(10, 5, '#7a1020');
    rect(2, 10, 12, 3, '#f2f2f2'); // 大白牙笑
    for (let i = 0; i < 6; i++) pix(3 + i * 2, 10, '#9a6ac9');
    rect(2, 12, 12, 1, '#3a2a4a');
  } else if (kind === 'lucario') {
    // 路卡利欧：红色眼睛 + 黑色面纹
    rect(3, 5, 4, 3, '#e84a3a'); rect(9, 5, 4, 3, '#e84a3a');
    pix(4, 6, eye); pix(10, 6, eye); pix(4, 5, '#ffffff'); pix(10, 5, '#ffffff');
    rect(0, 3, 3, 8, '#2a2a3e'); rect(13, 3, 3, 8, '#2a2a3e');
    rect(6, 9, 4, 3, muzzle || '#f2ecd8'); rect(7, 10, 2, 1, '#2a2a3e');
    pix(6, 13, '#8a4a3a'); pix(9, 13, '#8a4a3a');
  } else if (kind === 'sylveon') {
    // 仙子伊布：蓝色大眼 + 粉色蝴蝶结纹
    for (const ex of [3, 10]) { rect(ex, 5, 3, 4, '#2a6ad0'); pix(ex, 5, '#ffffff'); pix(ex + 1, 7, '#1a3a7a'); }
    pix(7, 9, '#e88aa8'); pix(8, 9, '#e88aa8');
    pix(6, 11, '#8a4a3a'); pix(9, 11, '#8a4a3a'); rect(7, 12, 2, 1, '#8a4a3a');
    pix(2, 10, '#f2a8c0'); pix(13, 10, '#f2a8c0');
  } else if (kind === 'mimikyu') {
    // 谜拟Q：手绘的豆豆眼 + 波浪嘴（画出来的脸）
    pix(4, 6, eye); pix(5, 6, eye); pix(10, 6, eye); pix(11, 6, eye);
    pix(4, 7, eye); pix(11, 7, eye);
    for (let i = 0; i < 6; i++) pix(5 + i, 11 + (i % 2), '#4a3a2a'); // 波浪嘴
    pix(2, 9, '#c9a86a'); pix(13, 9, '#c9a86a');
  } else if (kind === 'dedenne') {
    // 咚咚鼠：黑豆眼 + 橙色电气袋 + 长胡须
    for (const ex of [4, 10]) { rect(ex, 5, 2, 3, eye); pix(ex, 5, '#ffffff'); }
    rect(0, 8, 3, 3, '#e8763b'); rect(13, 8, 3, 3, '#e8763b');
    pix(1, 5, '#2a2a2e'); pix(2, 4, '#2a2a2e'); pix(13, 5, '#2a2a2e'); pix(14, 4, '#2a2a2e'); // 胡须
    pix(7, 8, '#4a3025'); pix(8, 8, '#4a3025');
    rect(7, 11, 2, 2, '#f2f2f2'); // 门牙
  } else if (kind === 'rowlet') {
    // 木木枭：白色脸盘 + 黑亮大眼 + 小喙
    rect(2, 4, 12, 9, muzzle || '#f7f2e0');
    for (const ex of [4, 10]) { rect(ex, 6, 2, 3, eye); pix(ex, 6, '#ffffff'); }
    rect(7, 9, 2, 2, '#e8a33b');
    pix(6, 12, '#8a5a4a'); pix(9, 12, '#8a5a4a');
  } else if (kind === 'scorbunny') {
    // 炎兔儿：橘色大眼 + 鼻子上的红色OK绷
    for (const ex of [3, 10]) { rect(ex, 5, 3, 4, '#e8763b'); pix(ex, 5, '#ffffff'); pix(ex + 1, 7, '#8a3a10'); }
    rect(7, 8, 2, 1, '#e84a3a'); rect(7, 9, 2, 1, '#e84a3a'); // 鼻贴
    pix(7, 10, '#4a3025'); pix(8, 10, '#4a3025');
    rect(7, 12, 2, 2, '#f2f2f2'); // 门牙
  } else if (kind === 'yamper') {
    // 来电汪：柯基脸 + 吐舌头 + 白鼻梁
    rect(6, 4, 4, 8, '#f7f2e0');
    for (const ex of [3, 11]) { rect(ex, 5, 2, 3, eye); pix(ex, 5, '#ffffff'); }
    rect(7, 9, 2, 2, '#2a2a2e');
    rect(7, 12, 2, 3, '#f2a8c0'); // 舌头
    pix(2, 10, '#ffb0a0'); pix(13, 10, '#ffb0a0');
  } else if (kind === 'dragonite') {
    // 快龙：温柔大眼 + 小鼻孔
    for (const ex of [3, 10]) { rect(ex, 5, 3, 4, eye); pix(ex, 5, '#ffffff'); }
    rect(5, 9, 6, 4, muzzle || '#f7ecd0');
    pix(6, 10, '#8a5a3a'); pix(9, 10, '#8a5a3a');
    pix(5, 12, '#8a5a3a'); pix(10, 12, '#8a5a3a'); rect(7, 13, 2, 1, '#8a5a3a');
  } else {
    // 兜底：大眼 + 吻部
    const mz = muzzle || '#fff3e0';
    rect(4, 9, 8, 6, mz);
    for (const ex of [4, 10]) {
      rect(ex, 6, 2, 3, eye);
      pix(ex, 6, '#ffffff');
    }
    rect(7, 9, 2, 2, '#5a3a2e');
    pix(6, 12, '#8a5a4a'); pix(9, 12, '#8a5a4a'); rect(7, 13, 2, 1, '#8a5a4a');
  }
  return toTexture(c);
}
type VillagerFace = 'pikachu' | 'meowth' | 'jigglypuff' | 'eevee' | 'snorlax' | 'psyduck' | 'charmander' | 'squirtle' | 'bulbasaur' | 'penguin'
  | 'togepi' | 'gengar' | 'lucario' | 'sylveon' | 'mimikyu' | 'dedenne' | 'rowlet' | 'scorbunny' | 'yamper' | 'dragonite';

// ---------- 玩家发丝贴图（头顶/后脑用）：从发旋向外流淌的弧状发丝 ----------
export function playerHairTexture(base: string, dark: string, light: string): THREE.CanvasTexture {
  const { c, pix } = makeCanvas(16, 16);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) pix(x, y, base);
  // 发旋中心（偏头顶后部）
  const cx = 8, cy = 5;
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const dx = x - cx, dy = y - cy;
    const ang = Math.atan2(dy, dx);
    const r = Math.hypot(dx, dy);
    // 螺旋明暗纹
    const v = Math.sin(ang * 3 + r * 1.1);
    if (v > 0.55) pix(x, y, light);
    else if (v < -0.55) pix(x, y, dark);
  }
  // 发旋点
  pix(cx, cy, dark); pix(cx + 1, cy, dark); pix(cx, cy + 1, dark); pix(cx + 1, cy + 1, dark);
  return toTexture(c);
}

// ---------- 玩家刘海贴图（带透明通道的参差发梢） ----------
export function playerBangTexture(base: string, dark: string): THREE.CanvasTexture {
  const { c, pix } = makeCanvas(16, 16);
  // 全透明底
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) pix(x, y, 'rgba(0,0,0,0)');
  // 每缕发梢长度不一
  const tips = [10, 12, 9, 11, 13, 10, 12, 9, 11, 13, 10, 12, 9, 11, 10, 12];
  for (let x = 0; x < 16; x++) {
    for (let y = 0; y < tips[x]; y++) {
      // 发丝竖纹明暗
      pix(x, y, x % 3 === 2 ? dark : base);
    }
  }
  const t = toTexture(c);
  return t;
}

// ---------- 屋顶 / 墙面 / 帐篷 ----------
export function roofTexture(colA: string, colB: string): THREE.CanvasTexture {
  const { c, pix } = makeCanvas(16, 16);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const shingle = ((y >> 2) + (x >> 2)) % 2 === 0;
    pix(x, y, shingle ? colA : colB);
  }
  return toTexture(c);
}
export function wallTexture(base: string, trim: string): THREE.CanvasTexture {
  const { c, pix } = makeCanvas(16, 16);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    pix(x, y, (x % 4 === 0) ? trim : base);
  }
  return toTexture(c);
}
export function tentTexture(colA = '#e2556b', colB = '#f7f0e0'): THREE.CanvasTexture {
  const { c, pix } = makeCanvas(16, 16);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    pix(x, y, (x >> 2) % 2 === 0 ? colA : colB);
  }
  return toTexture(c);
}
export function doorTexture(): THREE.CanvasTexture {
  const { c, pix } = makeCanvas(16, 16);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const frame = x < 2 || x > 13 || y < 2;
    pix(x, y, frame ? '#5e4023' : '#8a5f36');
  }
  pix(11, 9, '#f7d774');
  return toTexture(c);
}

// ---------- 石头 ----------
export function rockTexture(): THREE.CanvasTexture {
  const { c, pix } = makeCanvas(16, 16);
  dither(pix, 16, 16, '#9a9aa2', [['#86868f', 0.3], ['#b0b0b8', 0.2], ['#74747d', 0.1]]);
  return toTexture(c);
}

// ---------- 星形挖掘点 ----------
export function digSpotTexture(): THREE.CanvasTexture {
  const { c, ctx } = makeCanvas(16, 16);
  ctx.clearRect(0, 0, 16, 16);
  ctx.fillStyle = '#6b4f30';
  // 星形裂缝
  ctx.fillRect(7, 2, 2, 12);
  ctx.fillRect(2, 7, 12, 2);
  ctx.fillRect(4, 4, 2, 2); ctx.fillRect(10, 10, 2, 2);
  ctx.fillRect(10, 4, 2, 2); ctx.fillRect(4, 10, 2, 2);
  const t = toTexture(c);
  return t;
}

// ---------- 影子 ----------
export function shadowTexture(): THREE.CanvasTexture {
  const { c, ctx } = makeCanvas(16, 16);
  const g = ctx.createRadialGradient(8, 8, 1, 8, 8, 7);
  g.addColorStop(0, 'rgba(0,0,0,0.35)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 16, 16);
  return toTexture(c);
}
