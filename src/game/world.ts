// 岛屿世界：体素地形、河流与桥、建筑、果树、岩石、花、虫、鱼、挖掘点、氛围粒子
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { terrainAtlas, ATLAS, remapBoxUV, waterTexture, leafTexture, trunkTexture, flowerSvgTexture, rockTexture, digSpotTexture, roofTexture, wallTexture, tentSvgTexture } from './textures';
import { makePokeBall, makeFruitDrop } from './items3d';
import { FRUIT_IDS, FLOWER_IDS, BUG_DEFS, FISH_DEFS, weightedPick } from './data';
import { VILLAGER_PROFILES } from './villagers';

export const TILE = 2;
export const N = 160;                // 160x160 格大岛（面积约为旧版 2.8 倍）
export const HALF = (N * TILE) / 2;  // 160
export const WATER_Y = -1.0;

// ---------------- 地形高度 ----------------
export function riverCenter(x: number): number {
  return -18 + 14 * Math.sin(x * 0.028) + 5 * Math.sin(x * 0.011 + 2.0);
}

// 二层高原（西北部）：顶部平整可活动，仅南侧坡道可步行上下，其余为陡坡
const PLATEAU = { x0: -120, x1: -50, z0: -125, z1: -70, h: 3.0 };
const RAMP = { x0: -85, x1: -55, z0: -70, z1: -52 }; // 南侧坡道
const BASE_H = 0.45;

// 矿山孤岛（地图右上角），经一座对角断桥与主岛相连
export const MINE_ISLE = { x0: 98, x1: 138, z0: -138, z1: -98, h: 1.5 };
const MINE_BRIDGE_A = { x: 80, z: -80 };  // 主岛端
const MINE_BRIDGE_B = { x: 103, z: -103 }; // 矿岛端

function segT(x: number, z: number): number {
  // 点在断桥中心线上的投影参数（0~1）
  const dx = MINE_BRIDGE_B.x - MINE_BRIDGE_A.x, dz = MINE_BRIDGE_B.z - MINE_BRIDGE_A.z;
  const L2 = dx * dx + dz * dz;
  return Math.max(0, Math.min(1, ((x - MINE_BRIDGE_A.x) * dx + (z - MINE_BRIDGE_A.z) * dz) / L2));
}
export function onMineBridge(x: number, z: number): boolean {
  const t = segT(x, z);
  const cx = MINE_BRIDGE_A.x + (MINE_BRIDGE_B.x - MINE_BRIDGE_A.x) * t;
  const cz = MINE_BRIDGE_A.z + (MINE_BRIDGE_B.z - MINE_BRIDGE_A.z) * t;
  const dSeg = Math.hypot(x - cx, z - cz);
  const L = Math.hypot(MINE_BRIDGE_B.x - MINE_BRIDGE_A.x, MINE_BRIDGE_B.z - MINE_BRIDGE_A.z);
  const along = t * L;
  return dSeg < 2.6 && along > -1 && along < L + 1;
}
export function mineBridgeDeck(x: number, z: number): number {
  const t = segT(x, z);
  return 0.64 + t * 1.0; // 主岛岸 0.64 → 矿岛岸 1.64
}

function smooth(t: number) { return t * t * (3 - 2 * t); }

export function onRamp(x: number, z: number): boolean {
  return x >= RAMP.x0 && x <= RAMP.x1 && z >= RAMP.z0 && z <= RAMP.z1 + 6;
}

export function rawHeight(x: number, z: number): number {
  // 矿山孤岛：矩形台地 + 边缘 8 格渐变入海
  {
    const dx = Math.max(MINE_ISLE.x0 - x, 0, x - MINE_ISLE.x1);
    const dz = Math.max(MINE_ISLE.z0 - z, 0, z - MINE_ISLE.z1);
    const d = Math.hypot(dx, dz);
    if (d <= 0) return MINE_ISLE.h;
    if (d < 8) return MINE_ISLE.h + (-2.6 - MINE_ISLE.h) * smooth(d / 8);
  }
  // 高原与坡道：不受河流/海岸影响（高原边缘直接临海形成海崖）
  if (x >= PLATEAU.x0 && x <= PLATEAU.x1 && z >= PLATEAU.z0 && z <= PLATEAU.z1) {
    return PLATEAU.h; // 高原顶部：平整活动区
  }
  if (x >= RAMP.x0 && x <= RAMP.x1 && z >= RAMP.z0 && z <= RAMP.z1) {
    return BASE_H + (PLATEAU.h - BASE_H) * smooth((RAMP.z1 - z) / (RAMP.z1 - RAMP.z0)); // 坡道
  }
  // 其余全岛平整，仅河流/海岸保留高低差
  let h = BASE_H;
  // 河流下切
  const d = Math.abs(z - riverCenter(x));
  if (d < 7) {
    const t = smooth(1 - d / 7);
    h = h * (1 - t) + (-1.9) * t;
  }
  // 岛屿边缘落入海中
  const r = Math.hypot(x, z);
  if (r > 115) {
    const t = smooth(Math.min(1, (r - 115) / 22));
    h = h * (1 - t) + (-2.6) * t;
  }
  return h;
}

// 量化高度；避开与水面(-1.0)共面的高度，消除岸边闪烁
// 径向渐变光斑纹理（中心亮 → 边缘透明）
let _poolTex: THREE.CanvasTexture | null = null;
function glowPoolTexture(): THREE.CanvasTexture {
  if (_poolTex) return _poolTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  g.addColorStop(0, 'rgba(255,220,160,0.95)');
  g.addColorStop(0.4, 'rgba(255,210,140,0.45)');
  g.addColorStop(1, 'rgba(255,200,120,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  _poolTex = new THREE.CanvasTexture(c);
  return _poolTex;
}

const hq = (x: number, z: number) => {
  let h = Math.round(rawHeight(x, z) * 2) / 2;
  if (h > -1.45 && h < -0.55) h = -1.5;
  return h;
};

// 平滑双线性采样（格高已量化，行走时坡度平缓）
// 桥面行走高度：两端与地面平缓衔接（+0.14 避免木板与地面共面闪烁）
export function bridgeDeckHeight(z: number): number {
  const deck = 0.84;
  const bankS = hq(0, -27) + 0.14; // 南端地面
  const bankN = hq(0, -3) + 0.14;  // 北端地面
  if (z < -19) return bankS + (deck - bankS) * smooth((z + 27) / 8);
  if (z > -11) return deck + (bankN - deck) * smooth((z + 11) / 8);
  return deck;
}

export function groundHeight(x: number, z: number): number {
  // 矿岛断桥桥面：沿对角线平缓爬升
  if (onMineBridge(x, z)) return mineBridgeDeck(x, z);
  // 博物馆台阶：与视觉台阶方块逐段对齐（三级踏步 + 高台基座；基于博物馆所在地形高度，避免建筑悬空/台阶上不去）
  if (z > 46.4 && z < 58.7) {
    const mg = hq(0, 54); // 博物馆基座地形高度
    if (Math.abs(x) < 7.1 && z > 49.4) return mg + 0.8;              // 高台基座顶面
    if (Math.abs(x) < 2.4 && z > 48.6 && z < 49.8) return mg + 0.8;  // 最高一级台阶
    if (Math.abs(x) < 3.2 && z > 47.5 && z < 48.7) return mg + 0.535; // 中间一级
    if (Math.abs(x) < 4.0 && z < 47.6) return mg + 0.27;             // 最低一级
  }
  if (onBridge(x, z)) {
    // 桥面与两岸平滑衔接
    const deckH = bridgeDeckHeight(z);
    const t = Math.min(1, Math.abs(x) / 3.4);
    return deckH * (1 - smooth(t)) + bridgeBankHeight(z) * smooth(t);
  }
  // 按体素方块取整：行走高度与渲染的方块顶面完全一致，杜绝岸边/坡地穿模
  const i = Math.max(0, Math.min(N - 1, Math.floor((x + HALF) / TILE)));
  const j = Math.max(0, Math.min(N - 1, Math.floor((z + HALF) / TILE)));
  return hq((i - N / 2 + 0.5) * TILE, (j - N / 2 + 0.5) * TILE);
}

function bridgeBankHeight(z: number): number {
  // 桥两端岸边高度
  return z < riverCenter(0) ? hq(0, -27) : hq(0, -3);
}

export function onBridge(x: number, z: number): boolean {
  return Math.abs(x) < 3.2 && z > -27 && z < -3;
}

export function isWaterAt(x: number, z: number): boolean {
  if (onBridge(x, z) || onMineBridge(x, z)) return false;
  return rawHeight(x, z) < -0.75;
}

function distToSeg(px: number, pz: number, ax: number, az: number, bx: number, bz: number) {
  const dx = bx - ax, dz = bz - az;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}

// 路网（参考《新地平线》式布局：广场居中，北侧公共区，河南岸住宅区）
const PATHS: [number, number, number, number][] = [
  [0, 20, -30, 26],      // 广场 → 友好商店
  [0, 20, 30, 26],       // 广场 → 裁缝店
  [0, 20, 0, 54],        // 广场 → 博物馆
  [0, 20, 44, 20],       // 广场 → 玩家家
  [0, 20, 0, -3],        // 广场 → 桥北
  [0, -27, 0, -46],      // 桥南 → 住宅街
  [-72, -46, 72, -46],   // 住宅街 A 排
  [-44, -46, -44, -78],  // A 排 → B 排（西）
  [44, -46, 44, -78],    // A 排 → B 排（东）
  [-72, -46, -70, -56],  // 住宅街 → 高原坡道
];

export type TileType = 'grass' | 'sand' | 'path' | 'dirt';
export function tileType(x: number, z: number): TileType {
  // 矿山孤岛：裸露的泥土地
  if (x > MINE_ISLE.x0 && x < MINE_ISLE.x1 && z > MINE_ISLE.z0 && z < MINE_ISLE.z1) return 'dirt';
  const h = rawHeight(x, z);
  if (h < 0.15) return 'sand';
  for (const [ax, az, bx, bz] of PATHS) {
    if (distToSeg(x, z, ax, az, bx, bz) < 1.9) return 'path';
  }
  if (Math.hypot(x, z - 20) < 9.5) return 'dirt'; // 广场圆盘
  return 'grass';
}

// ---------------- 小工具 ----------------
export function emojiSprite(emoji: string, size = 1.1): THREE.Sprite {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.font = '52px serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(emoji, 32, 36);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  const m = new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false });
  const s = new THREE.Sprite(m);
  s.scale.setScalar(size);
  return s;
}

function box(w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

// ---------------- 实体类型 ----------------
export interface Pickup {
  id: number;
  item: string;
  bells?: number;
  mesh: THREE.Group;
  vel: THREE.Vector3;
  grounded: boolean;
  bobT: number;
}

// 树的渲染全部走 World 的 InstancedMesh（树干/树叶/果子各一个实例网格），
// Tree 只保留逻辑数据（位置/果子槽/摇晃计时），不再有实体模型
export class Tree {
  group = new THREE.Group(); // 兼容旧代码（不入场景，无模型）
  fruitId: string;
  fruits: number[] = [];     // 果子实例槽位
  fruitSpots: [number, number, number][] = []; // 每颗果子的本地偏移（与 fruits 平行）
  shakeT = 0;
  regrowT = 0;
  chopsLeft = 3;      // 斧头可砍次数（原版：每天每树最多3块木材）
  chopResetAt = 0;
  x: number; z: number;
  s: number;        // 缩放
  trunkH: number;   // 树干高
  gy: number;       // 地面高度
  leaves: [number, number, number, number][]; // [lx,ly,lz,ls] ×4
  instSlot = -1;    // 树干/树叶实例槽位
  constructor(x: number, z: number, fruitId: string, _leafMat: THREE.Material, _trunkMat: THREE.Material, small = false) {
    this.x = x; this.z = z; this.fruitId = fruitId;
    const s = small ? 0.55 : 1;
    this.s = s;
    this.trunkH = 2.2 * s;
    this.gy = groundHeight(x, z);
    this.group.position.set(x, this.gy, z);
    this.leaves = [
      [0, this.trunkH + 0.9 * s, 0, 2.6], [-0.9 * s, this.trunkH + 0.4 * s, 0.4 * s, 1.6],
      [0.9 * s, this.trunkH + 0.5 * s, -0.3 * s, 1.7], [0.1 * s, this.trunkH + 1.6 * s, 0.2 * s, 1.8],
    ];
  }
  // 果子挂点：前后左右四个面（与实例化果子共用）
  static FRUIT_SPOTS: [number, number, number][] = [
    [0, 2.35, 1.66], [0, 2.45, -1.66], [1.66, 2.3, 0], [-1.66, 2.5, 0],
  ];
}

export interface Rock { x: number; z: number; group: THREE.Group; cooldownUntil: number; }
export interface Flower { id: number; x: number; z: number; itemId: string; slot: number; } // slot = 实例网格槽位（花草已实例化渲染）
export interface DigSpot { id: number; x: number; z: number; mesh: THREE.Mesh; }
export interface Sapling { x: number; z: number; group: THREE.Group; growT: number; fruit?: string; }

export class Bug {
  group = new THREE.Group();
  itemId: string;
  wingL: THREE.Mesh; wingR: THREE.Mesh;
  basePos: THREE.Vector3;
  t = Math.random() * 10;
  fleeT = 0;
  constructor(def: { itemId: string; color: number; accent: number }, pos: THREE.Vector3) {
    this.itemId = def.itemId;
    this.basePos = pos.clone();
    const bodyMat = new THREE.MeshLambertMaterial({ color: def.accent });
    const wingMat = new THREE.MeshLambertMaterial({ color: def.color, transparent: true, opacity: 0.9, side: THREE.DoubleSide });
    const body = box(0.14, 0.14, 0.5, bodyMat);
    body.castShadow = false;
    this.group.add(body);
    this.wingL = box(0.5, 0.04, 0.4, wingMat, -0.3, 0.08, 0);
    this.wingR = box(0.5, 0.04, 0.4, wingMat, 0.3, 0.08, 0);
    this.wingL.castShadow = this.wingR.castShadow = false;
    this.group.add(this.wingL, this.wingR);
    this.group.position.copy(pos);
  }
  update(dt: number) {
    this.t += dt;
    const g = this.group;
    if (this.fleeT > 0) {
      this.fleeT -= dt;
      g.position.y += dt * 4;
      g.position.x += dt * 3;
    } else {
      g.position.x = this.basePos.x + Math.sin(this.t * 0.7) * 1.6;
      g.position.z = this.basePos.z + Math.cos(this.t * 0.9) * 1.6;
      g.position.y = this.basePos.y + 0.6 + Math.sin(this.t * 2.2) * 0.35;
    }
    const flap = Math.sin(this.t * 25) * 0.9;
    this.wingL.rotation.z = flap;
    this.wingR.rotation.z = -flap;
    g.rotation.y = Math.atan2(Math.cos(this.t * 0.7), -Math.sin(this.t * 0.9));
  }
}

export class Fish {
  group = new THREE.Group();
  itemId: string;
  x: number; off: number;
  dir = 1;
  speed = 1.2 + Math.random();
  state: 'swim' | 'lure' | 'gone' = 'swim';
  tail: THREE.Mesh;
  t = Math.random() * 5;
  // 海鱼：围绕海上锚点小圈漫游（河鱼则沿河来回）
  sea = false;
  seaAnchor = new THREE.Vector3();
  seaAngle = Math.random() * Math.PI * 2;
  seaR = 3 + Math.random() * 3;
  constructor(itemId: string, size: number, x: number) {
    this.itemId = itemId;
    this.x = x;
    this.off = (Math.random() - 0.5) * 3;
    // 动森式鱼影：贴近水面下方的深色剪影
    const mat = new THREE.MeshBasicMaterial({ color: 0x14304a, transparent: true, opacity: 0.85 });
    const body = box(0.7 * size, 0.22 * size, 1.3 * size, mat);
    body.castShadow = false;
    const fin = box(0.5 * size, 0.14 * size, 0.4 * size, mat, 0, 0.1 * size, -0.2 * size);
    fin.castShadow = false;
    this.tail = box(0.5 * size, 0.18 * size, 0.5 * size, mat, 0, 0, 0.85 * size);
    this.tail.castShadow = false;
    this.group.add(body, fin, this.tail);
  }
  get pos() { return this.group.position; }
  update(dt: number, lurePos: THREE.Vector3 | null) {
    this.t += dt;
    const g = this.group;
    if (this.state === 'lure') {
      if (lurePos) {
        const dx = lurePos.x - g.position.x, dz = lurePos.z - g.position.z;
        const d = Math.hypot(dx, dz);
        if (d > 1.2) {
          g.position.x += (dx / d) * dt * 2.2;
          g.position.z += (dz / d) * dt * 2.2;
          g.rotation.y = Math.atan2(dx, dz);
        }
      }
    } else if (this.state === 'swim') {
      if (this.sea) {
        // 海鱼：绕锚点慢慢转圈
        this.seaAngle += this.dir * this.speed * 0.25 * dt;
        const nx = this.seaAnchor.x + Math.cos(this.seaAngle) * this.seaR;
        const nz = this.seaAnchor.z + Math.sin(this.seaAngle) * this.seaR;
        g.rotation.y = Math.atan2(nx - g.position.x, nz - g.position.z);
        g.position.set(nx, WATER_Y - 0.12, nz);
      } else {
        this.x += this.dir * this.speed * dt;
        if (this.x > 110) { this.x = 110; this.dir = -1; }
        if (this.x < -110) { this.x = -110; this.dir = 1; }
        const z = riverCenter(this.x) + this.off;
        g.position.set(this.x, WATER_Y - 0.12, z);
        g.rotation.y = this.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      }
    }
    this.tail.rotation.y = Math.sin(this.t * 8) * 0.5;
  }
}

// ---------------- 世界 ----------------
export class World {
  // 静态建筑/装饰合并：建成后不动的物体合并成大 mesh，大幅降低 draw call（VR 优化）
  private mergables: THREE.Object3D[] = [];
  private staticMerged = false;
  group = new THREE.Group();
  colliders: { x: number; z: number; r: number }[] = [];
  trees: Tree[] = [];
  rocks: Rock[] = [];
  flowers: Flower[] = [];
  bugs: Bug[] = [];
  fishes: Fish[] = [];
  digSpots: DigSpot[] = [];
  pickups: Pickup[] = [];
  saplings: Sapling[] = [];
  weeds: { id: number; x: number; z: number; slot: number }[] = []; // slot = 实例网格槽位
  houses: { name: string; x: number; z: number }[] = [];
  shopPos = new THREE.Vector3(-24, 0, 22.4);
  nookPos = new THREE.Vector3(-20, 0, 21.5);
  boardPos = new THREE.Vector3(3, 0, 4);
  lamps: THREE.PointLight[] = [];
  lampBulbs: THREE.MeshLambertMaterial[] = [];
  lampPools: THREE.MeshBasicMaterial[] = [];
  water!: THREE.Mesh;
  lureFish: Fish | null = null;
  lurePos = new THREE.Vector3();
  stars!: THREE.Points;
  moon!: THREE.Sprite;
  moonLight!: THREE.DirectionalLight;
  fireflies!: THREE.Points;
  petals!: THREE.Points;
  private nextId = 1;
  /** 由外部（game.ts）设置以启用树实例视锥体裁剪 */
  camera: THREE.PerspectiveCamera | null = null;
  private _frustum = new THREE.Frustum();
  private _sphere = new THREE.Sphere();
  private _projScreenMatrix = new THREE.Matrix4();
  private leafMat: THREE.Material;
  private trunkMat: THREE.Material;
  private flowerMats: Record<string, THREE.Material> = {};
  // ---- 花草实例化（100 花×2 面片 + 80 草×3 叶片 ≈440 mesh → 4 个 draw call）----
  private flowerI: Record<string, { im: THREE.InstancedMesh; free: number[] }> = {};
  private weedI: THREE.InstancedMesh | null = null;
  private freeWeedSlots: number[] = [];
  // 花：十字双面片（各角度可见），顶点抬到茎高
  private flowerCrossGeo = (() => {
    const a = new THREE.PlaneGeometry(1.05, 1.05);
    a.translate(0, 0.52, 0);
    const b = new THREE.PlaneGeometry(1.05, 1.05);
    b.rotateY(Math.PI / 2);
    b.translate(0, 0.52, 0);
    return mergeGeometries([a, b])!;
  })();
  // 杂草：3 叶片合一（随机性由实例矩阵的旋转/高度表达）
  private weedGeo = (() => {
    const mk = (ry: number, tx: number, tz: number) => {
      const g = new THREE.BoxGeometry(0.5, 0.75, 0.12);
      g.translate(0, 0.375, 0);
      g.rotateY(ry);
      g.translate(tx, 0, tz);
      return g;
    };
    return mergeGeometries([mk(0, 0, 0), mk(1.1, 0.18, -0.1), mk(2.2, -0.15, 0.12)])!;
  })();

  private ensureFlowerInst(itemId: string) {
    if (!this.flowerI[itemId]) {
      const cap = 220;
      const im = new THREE.InstancedMesh(this.flowerCrossGeo, this.flowerMats[itemId], cap);
      im.castShadow = true;
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      const zero = new THREE.Matrix4().makeScale(0, 0, 0);
      for (let i = 0; i < cap; i++) im.setMatrixAt(i, zero);
      im.instanceMatrix.needsUpdate = true;
      this.group.add(im);
      const free: number[] = [];
      for (let i = cap - 1; i >= 0; i--) free.push(i);
      this.flowerI[itemId] = { im, free };
    }
    return this.flowerI[itemId];
  }

  private ensureWeedInst() {
    if (!this.weedI) {
      const cap = 120;
      this.weedI = new THREE.InstancedMesh(this.weedGeo, new THREE.MeshLambertMaterial({ color: 0x4a7a35 }), cap);
      this.weedI.castShadow = false;
      this.weedI.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      const zero = new THREE.Matrix4().makeScale(0, 0, 0);
      for (let i = 0; i < cap; i++) this.weedI.setMatrixAt(i, zero);
      this.weedI.instanceMatrix.needsUpdate = true;
      this.group.add(this.weedI);
      for (let i = cap - 1; i >= 0; i--) this.freeWeedSlots.push(i);
    }
    return this.weedI;
  }

  // 带 Y 旋转的实例矩阵写入
  private setInstR(im: THREE.InstancedMesh, idx: number, x: number, y: number, z: number, ry: number, sy: number) {
    this.imQ.setFromAxisAngle(this.imAxisY, ry);
    this.imM.compose(this.imV.set(x, y, z), this.imQ, this.imS.set(1, sy, 1));
    im.setMatrixAt(idx, this.imM);
  }

  private clearInst(im: THREE.InstancedMesh, idx: number) {
    im.setMatrixAt(idx, this.imM.makeScale(0, 0, 0));
    im.instanceMatrix.needsUpdate = true;
  }
  private digTex: THREE.Texture;
  private falling: { mesh: THREE.Object3D; vy: number; item: string; groundY: number }[] = [];

  // 露营帐篷（高原广场，考察中的宝可梦用）
  campTent: THREE.Group | null = null;
  readonly campPos = new THREE.Vector3(-85, 0, -95);
  private campCollider: { x: number; z: number; r: number } | null = null;

  constructor() {
    this.leafMat = new THREE.MeshLambertMaterial({ map: leafTexture() });
    this.trunkMat = new THREE.MeshLambertMaterial({ map: trunkTexture() });
    this.digTex = digSpotTexture();
    this.buildTerrain();
    this.buildWater();
    this.buildBridge();
    this.buildMineIsle();
    this.buildBuildings();
    this.buildTrees();
    this.initTreeInstancing(); // 树全部实例化渲染（150棵树只占9个 draw call）
    this.buildRocks();
    this.buildFlowers();
    this.buildBugs();
    this.buildFishes();
    this.buildDigSpots();
    this.buildWeeds();
    this.scatterBranches();
    this.buildAmbient();
    // 桥面走廊保持畅通：移除落在桥体及两端引道上的碰撞体（树/石/杂物）
    this.colliders = this.colliders.filter(c => !(Math.abs(c.x) < 4.2 && c.z > -30 && c.z < 0));
  }

  // ---------- 杂草（可拔除） ----------
  private buildWeeds() {
    for (let i = 0; i < 80; i++) this.spawnWeed();
  }
  spawnWeed() {
    const p = this.randomGrassPos(8);
    if (!p) return;
    const im = this.ensureWeedInst();
    if (!this.freeWeedSlots.length) return;
    const slot = this.freeWeedSlots.pop()!;
    // 随机朝向 + 高度（0.8~1.15 倍），叶片几何体已合一
    this.setInstR(im, slot, p[0], groundHeight(p[0], p[1]), p[1], Math.random() * Math.PI * 2, 0.8 + Math.random() * 0.35);
    im.instanceMatrix.needsUpdate = true;
    this.weeds.push({ id: this.nextId++, x: p[0], z: p[1], slot });
  }
  removeWeed(w: { id: number }) {
    const wd = this.weeds.find(x => x.id === w.id);
    if (wd && this.weedI) {
      this.clearInst(this.weedI, wd.slot);
      this.freeWeedSlots.push(wd.slot);
    }
    this.weeds = this.weeds.filter(x => x.id !== w.id);
  }

  // ---------- 地面树枝 ----------
  private scatterBranches() {
    for (const t of this.trees) {
      if (Math.random() < 0.55) {
        const pos = new THREE.Vector3(
          t.x + (Math.random() - 0.5) * 4, 0,
          t.z + (Math.random() - 0.5) * 4);
        if (isWaterAt(pos.x, pos.z)) continue;
        pos.y = groundHeight(pos.x, pos.z) + 0.35;
        this.addPickup('branch', pos);
      }
    }
  }

  // ---------- 地形 ----------
  private buildTerrain() {
    const atlas = terrainAtlas();
    const mat = new THREE.MeshLambertMaterial({ map: atlas });
    const makeGeo = (top: [number, number], side: [number, number]) => {
      const g = new THREE.BoxGeometry(TILE, 1, TILE);
      remapBoxUV(g, top, side);
      return g;
    };
    const geos: Record<TileType, THREE.BufferGeometry> = {
      grass: makeGeo(ATLAS.grassTop, ATLAS.grassSide),
      sand: makeGeo(ATLAS.sandTop, ATLAS.sandSide),
      path: makeGeo(ATLAS.pathTop, ATLAS.pathSide),
      dirt: makeGeo(ATLAS.dirt, ATLAS.dirt),
    };
    const byType: Record<TileType, THREE.Matrix4[]> = { grass: [], sand: [], path: [], dirt: [] };
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const x = (i - N / 2 + 0.5) * TILE;
      const z = (j - N / 2 + 0.5) * TILE;
      const h = hq(x, z);
      const bottom = -3;
      const height = Math.max(0.5, h - bottom);
      m4.makeScale(1, height, 1);
      m4.setPosition(x, bottom + height / 2, z);
      byType[tileType(x, z)].push(m4.clone());
    }
    for (const type of Object.keys(byType) as TileType[]) {
      const list = byType[type];
      if (!list.length) continue;
      const inst = new THREE.InstancedMesh(geos[type], mat, list.length);
      list.forEach((m, i) => inst.setMatrixAt(i, m));
      inst.receiveShadow = true;
      this.group.add(inst);
    }
  }

  private buildWater() {
    const tex = waterTexture();
    const geo = new THREE.PlaneGeometry(560, 560);
    this.water = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({
      map: tex, transparent: true, opacity: 0.72,
    }));
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.y = WATER_Y;
    this.group.add(this.water);
  }

  private buildBridge() {
    const mat = new THREE.MeshLambertMaterial({ map: terrainAtlas() });
    const deck = new THREE.Group();
    for (let zi = 0; zi < 11; zi++) {
      const z = -25 + zi * 2.2;
      const plankTop = bridgeDeckHeight(z);
      const g = new THREE.BoxGeometry(6.4, 0.5, 2.2);
      remapBoxUV(g, ATLAS.plankTop, ATLAS.plankSide);
      const p = new THREE.Mesh(g, mat);
      p.position.set(0, plankTop - 0.25, z);
      p.castShadow = p.receiveShadow = true;
      deck.add(p);
    }
    const railMat = new THREE.MeshLambertMaterial({ color: 0x7c5a33 });
    for (const sx of [-3, 3]) {
      for (let zi = 0; zi < 6; zi++) {
        const z = -25 + zi * 4.4;
        deck.add(box(0.25, 1, 0.25, railMat, sx, bridgeDeckHeight(z) + 0.5, z));
      }
      for (let zi = 0; zi < 5; zi++) {
        const z = -25 + zi * 4.4 + 2.2;
        deck.add(box(0.18, 0.18, 4.4, railMat, sx, bridgeDeckHeight(z) + 0.95, z));
      }
    }
    // 桥墩（伸入水中）
    for (const pz of [-18, -10]) {
      for (const px of [-2.4, 2.4]) {
        deck.add(box(0.6, 2.2, 0.6, railMat, px, -0.4, pz));
      }
    }
    this.group.add(deck);
    // 桥两侧护栏不设碰撞，桥面由 onBridge 判定
  }

  // ---------- 建筑 ----------

  // ===== 矿山孤岛：对角断桥（修复前后两态）+ 矿洞入口 =====
  bridgeFixed = false;
  private mineBridgeGood = new THREE.Group();
  private mineBridgeBad = new THREE.Group();
  bridgeBarrier: { x: number; z: number; r: number } | null = null;

  private buildMineIsle() {
    const mat = new THREE.MeshLambertMaterial({ map: terrainAtlas() });
    const railMat = new THREE.MeshLambertMaterial({ color: 0x7c5a33 });
    const A = MINE_BRIDGE_A, B = MINE_BRIDGE_B;
    const dir = new THREE.Vector3(B.x - A.x, 0, B.z - A.z);
    dir.normalize();
    const yaw = Math.atan2(dir.x, dir.z);
    const mkPlank = (t: number): THREE.Mesh => {
      const x = A.x + (B.x - A.x) * t, z = A.z + (B.z - A.z) * t;
      const g = new THREE.BoxGeometry(5.6, 0.5, 2.4);
      remapBoxUV(g, ATLAS.plankTop, ATLAS.plankSide);
      const p = new THREE.Mesh(g, mat);
      p.position.set(x, mineBridgeDeck(x, z) - 0.25, z);
      p.rotation.y = yaw;
      p.castShadow = p.receiveShadow = true;
      return p;
    };
    // 完好的桥：全部桥板
    for (let i = 0; i < 12; i++) this.mineBridgeGood.add(mkPlank(i / 11));
    // 断桥：中段缺失（t 0.4~0.66 断开），断口处插警示木牌
    for (let i = 0; i < 12; i++) {
      const t = i / 11;
      if (t > 0.38 && t < 0.68) continue; // 缺口
      this.mineBridgeBad.add(mkPlank(t));
    }
    const midX = A.x + (B.x - A.x) * 0.44, midZ = A.z + (B.z - A.z) * 0.44;
    const sign = new THREE.Group();
    sign.add(box(0.22, 1.8, 0.22, railMat, 0, 0.9, 0));
    sign.add(box(1.8, 0.9, 0.12, new THREE.MeshLambertMaterial({ color: 0xc9a86a }), 0, 1.7, 0));
    sign.add(emojiSprite('🚧', 0.8).translateY(1.7).translateZ(0.12));
    sign.position.set(midX, mineBridgeDeck(midX, midZ), midZ);
    sign.rotation.y = yaw;
    this.mineBridgeBad.add(sign);
    // 断口前的路障（修复前挡住去路）
    const bar = new THREE.Group();
    bar.add(box(3.6, 0.5, 0.3, new THREE.MeshLambertMaterial({ color: 0xd9c9a0 }), 0, 0.7, 0));
    bar.add(box(0.3, 1.2, 0.3, railMat, -1.5, 0.6, 0));
    bar.add(box(0.3, 1.2, 0.3, railMat, 1.5, 0.6, 0));
    bar.position.set(midX, mineBridgeDeck(midX, midZ), midZ);
    bar.rotation.y = yaw;
    this.mineBridgeBad.add(bar);
    this.mineBridgeGood.visible = false;
    this.group.add(this.mineBridgeGood, this.mineBridgeBad);
    this.bridgeBarrier = { x: midX, z: midZ, r: 3.0 };
    this.colliders.push(this.bridgeBarrier);

    // 矿洞入口：石丘 + 黑色洞口 + 木框支架（星露谷矿井风）
    const mound = new THREE.Group();
    const rockMat = new THREE.MeshLambertMaterial({ color: 0x8a8578 });
    const rockMat2 = new THREE.MeshLambertMaterial({ color: 0x75705f });
    mound.add(box(10, 5, 6, rockMat, 0, 2.5, -1.6));
    mound.add(box(7, 7, 5, rockMat2, 0.4, 3.5, -2.6));
    mound.add(box(4.5, 9, 4, rockMat, 0.8, 4.5, -3.6));
    // 洞口（黑色门洞 + 木支架）
    const dark = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 3.2), new THREE.MeshBasicMaterial({ color: 0x0a0a12 }));
    dark.position.set(0, 1.6, 1.45);
    mound.add(dark);
    const woodMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2f });
    mound.add(box(0.4, 3.6, 0.4, woodMat, -1.5, 1.8, 1.5));
    mound.add(box(0.4, 3.6, 0.4, woodMat, 1.5, 1.8, 1.5));
    mound.add(box(3.6, 0.4, 0.4, woodMat, 0, 3.7, 1.5));
    mound.add(emojiSprite('⛏️', 1.2).translateY(4.6).translateZ(1.5));
    const mx = 118, mz = -126;
    mound.position.set(mx, groundHeight(mx, mz), mz);
    this.group.add(mound);
    this.mergables.push(mound);
    this.colliders.push({ x: mx, z: mz - 1, r: 4.6 });
    this.houses.push({ name: '矿洞', x: mx, z: mz + 4.2 }); // 洞口正前方可进入
    // 岛上散落的矿石装饰
    for (const [rx, rz] of [[106, -112], [130, -108], [126, -132], [104, -130]]) {
      const g = new THREE.Group();
      g.add(box(1.3, 1, 1.2, rockMat, 0, 0.5, 0));
      g.add(box(0.8, 0.6, 0.7, rockMat2, 0.5, 0.9, 0.3));
      g.position.set(rx, groundHeight(rx, rz), rz);
      this.group.add(g);
      this.colliders.push({ x: rx, z: rz, r: 1 });
    }
  }

  // 把登记过的静态建筑/装饰合并成少量大 mesh（按 60m 区块 + 材质分桶）
  // 只合并不透明、无贴图的纯色 MeshLambert 件；贴图/半透明/会动的保持原样
  mergeStaticDecor() {
    if (this.staticMerged) return;
    this.staticMerged = true;
    const CHUNK = 60;
    const matCache = new Map<string, THREE.MeshLambertMaterial>();
    const buckets = new Map<string, { mat: THREE.MeshLambertMaterial; geos: THREE.BufferGeometry[] }>();
    for (const root of this.mergables) {
      root.updateMatrixWorld(true);
      const meshes: THREE.Mesh[] = [];
      root.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh); });
      for (const mesh of meshes) {
        const mat = mesh.material as THREE.MeshLambertMaterial;
        if (Array.isArray(mat) || !mat.isMeshLambertMaterial) continue;
        if (mat.map || mat.transparent) continue; // emoji 牌/贴图/玻璃等不合并（原件保留在场景）
        const e = mesh.matrixWorld.elements;
        const cx = Math.floor(e[12] / CHUNK), cz = Math.floor(e[14] / CHUNK);
        const mKey = `${mat.color.getHexString()}|${mat.emissive.getHexString()}`;
        const bKey = `${mKey}|${cx},${cz}`;
        let bucket = buckets.get(bKey);
        if (!bucket) {
          let m2 = matCache.get(mKey);
          if (!m2) { m2 = new THREE.MeshLambertMaterial({ color: mat.color.getHex(), emissive: mat.emissive.getHex() }); matCache.set(mKey, m2); }
          bucket = { mat: m2, geos: [] };
          buckets.set(bKey, bucket);
        }
        const geo = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
        bucket.geos.push(geo);
        mesh.removeFromParent(); // 只移除被合并的件，贴图/半透明件留在原建筑上
      }
    }
    let mergedCount = 0;
    for (const b of buckets.values()) {
      if (!b.geos.length) continue;
      const merged = mergeGeometries(b.geos, false);
      if (!merged) continue;
      for (const g of b.geos) g.dispose();
      const mesh = new THREE.Mesh(merged, b.mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false; // 静态：不再更新矩阵
      this.group.add(mesh);
      mergedCount++;
    }
    (window as unknown as { __mergeStat?: unknown }).__mergeStat = { buckets: mergedCount, sources: this.mergables.length };
    this.mergables = [];
  }

  // ================= 树的实例化渲染（150棵树从 ~1950 个 mesh 降到 9 个） =================
  private static TREE_CAP = 320;
  private static FRUIT_CAP = 700;
  private trunkI!: THREE.InstancedMesh;
  private leafI: THREE.InstancedMesh[] = [];
  private fruitBodyI!: THREE.InstancedMesh;
  private fruitTopI!: THREE.InstancedMesh;
  private fruitStemI!: THREE.InstancedMesh;
  private fruitLeafI!: THREE.InstancedMesh;
  private freeTreeSlots: number[] = [];
  private freeFruitSlots: number[] = [];
  private imM = new THREE.Matrix4();
  private imQ = new THREE.Quaternion();
  private imAxisY = new THREE.Vector3(0, 1, 0);
  private imV = new THREE.Vector3();
  private imS = new THREE.Vector3();
  private imE = new THREE.Euler();
  private imPivot = new THREE.Vector3();

  private initTreeInstancing() {
    const unit = new THREE.BoxGeometry(1, 1, 1);
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    const mk = (mat: THREE.Material, cap: number) => {
      const im = new THREE.InstancedMesh(unit.clone(), mat, cap);
      im.castShadow = true;
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      im.instanceFrustumCulled = true;
      for (let i = 0; i < cap; i++) im.setMatrixAt(i, zero);
      im.instanceMatrix.needsUpdate = true;
      this.group.add(im);
      return im;
    };
    this.trunkI = mk(this.trunkMat, World.TREE_CAP);
    for (let i = 0; i < 4; i++) this.leafI.push(mk(this.leafMat, World.TREE_CAP));
    this.fruitBodyI = mk(new THREE.MeshLambertMaterial({ color: 0xffffff }), World.FRUIT_CAP);
    this.fruitTopI = mk(new THREE.MeshLambertMaterial({ color: 0xffffff }), World.FRUIT_CAP);
    this.fruitStemI = mk(new THREE.MeshLambertMaterial({ color: 0x5e4023 }), World.FRUIT_CAP);
    this.fruitLeafI = mk(new THREE.MeshLambertMaterial({ color: 0x3e8e3a }), World.FRUIT_CAP);
    for (let i = World.TREE_CAP - 1; i >= 0; i--) this.freeTreeSlots.push(i);
    for (let i = World.FRUIT_CAP - 1; i >= 0; i--) this.freeFruitSlots.push(i);
    for (const t of this.trees) this.registerTree(t);
  }

  private setInst(im: THREE.InstancedMesh, idx: number, x: number, y: number, z: number, sx: number, sy: number, sz: number) {
    this.imM.compose(this.imV.set(x, y, z), this.imQ.identity(), this.imS.set(sx, sy, sz));
    im.setMatrixAt(idx, this.imM);
  }

  // 注册一棵树进实例网格（果子另挂）
  registerTree(t: Tree) {
    if (t.instSlot >= 0 || !this.freeTreeSlots.length) return;
    t.instSlot = this.freeTreeSlots.pop()!;
    this.writeTreeInstances(t);
    if (t.fruitId) this.growFruits(t);
  }

  // 写树干+树叶实例矩阵（摇晃时带旋转，绕树冠底部支点）
  private writeTreeInstances(t: Tree, rz = 0, rx = 0) {
    const i = t.instSlot;
    if (i < 0) return;
    this.setInst(this.trunkI, i, t.x, t.gy + t.trunkH / 2, t.z, 0.8 * t.s, t.trunkH, 0.8 * t.s);
    this.trunkI.instanceMatrix.needsUpdate = true;
    this.imE.set(rx, 0, rz);
    this.imQ.setFromEuler(this.imE);
    this.imPivot.set(0, t.trunkH, 0); // 支点：树冠底部
    for (let li = 0; li < 4; li++) {
      const [lx, ly, lz, ls] = t.leaves[li];
      // 旋转：local → (local - pivot) 旋转 → + pivot → + 树位置
      const px = lx - this.imPivot.x, py = ly - this.imPivot.y, pz = lz - this.imPivot.z;
      const v = this.imV.set(px, py, pz).applyQuaternion(this.imQ);
      this.imM.compose(
        new THREE.Vector3(t.x + v.x + this.imPivot.x, t.gy + v.y + this.imPivot.y, t.z + v.z + this.imPivot.z),
        this.imQ,
        this.imS.set(ls * t.s, ls * 0.8 * t.s, ls * t.s),
      );
      this.leafI[li].setMatrixAt(i, this.imM);
      this.leafI[li].instanceMatrix.needsUpdate = true;
    }
  }

  // 结果子（实例化：主体+顶盖+梗+叶 四个实例网格）
  growFruits(t: Tree) {
    if (t.fruits.length > 0 || !t.fruitId) return;
    const color = new THREE.Color(fruitColor(t.fruitId));
    for (const [fx, fy, fz] of Tree.FRUIT_SPOTS) {
      if (!this.freeFruitSlots.length) return;
      const slot = this.freeFruitSlots.pop()!;
      const wx = t.x + fx * t.s, wy = t.gy + fy * t.s, wz = t.z + fz * t.s;
      this.setInst(this.fruitBodyI, slot, wx, wy, wz, 0.34, 0.36, 0.34);
      this.setInst(this.fruitTopI, slot, wx, wy + 0.22, wz, 0.22, 0.16, 0.22);
      this.setInst(this.fruitStemI, slot, wx, wy + 0.34, wz, 0.08, 0.14, 0.08);
      this.setInst(this.fruitLeafI, slot, wx + 0.12, wy + 0.34, wz, 0.18, 0.06, 0.12);
      this.fruitBodyI.setColorAt(slot, color);
      this.fruitTopI.setColorAt(slot, color);
      t.fruits.push(slot);
      t.fruitSpots.push([fx, fy, fz]);
    }
    for (const im of [this.fruitBodyI, this.fruitTopI, this.fruitStemI, this.fruitLeafI]) im.instanceMatrix.needsUpdate = true;
    if (this.fruitBodyI.instanceColor) this.fruitBodyI.instanceColor.needsUpdate = true;
    if (this.fruitTopI.instanceColor) this.fruitTopI.instanceColor.needsUpdate = true;
  }

  // 摘掉一颗果子（返回这颗果子的世界坐标，没有则 null）
  pickFruit(t: Tree): THREE.Vector3 | null {
    const slot = t.fruits.pop();
    const spot = t.fruitSpots.pop();
    if (slot === undefined || !spot) return null;
    this.freeFruitSlot(slot);
    return new THREE.Vector3(t.x + spot[0] * t.s, t.gy + spot[1] * t.s, t.z + spot[2] * t.s);
  }

  private freeFruitSlot(slot: number) {
    const zero = this.imM.makeScale(0, 0, 0);
    for (const im of [this.fruitBodyI, this.fruitTopI, this.fruitStemI, this.fruitLeafI]) {
      im.setMatrixAt(slot, zero);
      im.instanceMatrix.needsUpdate = true;
    }
    this.freeFruitSlots.push(slot);
  }

  private freeTree(t: Tree) {
    if (t.instSlot < 0) return;
    const zero = this.imM.makeScale(0, 0, 0);
    this.trunkI.setMatrixAt(t.instSlot, zero);
    this.trunkI.instanceMatrix.needsUpdate = true;
    for (const l of this.leafI) { l.setMatrixAt(t.instSlot, zero); l.instanceMatrix.needsUpdate = true; }
    this.freeTreeSlots.push(t.instSlot);
    t.instSlot = -1;
    while (t.fruits.length) this.pickFruit(t);
  }

  // 造一颗真实的果子模型（摇落/过渡动画用）
  makeFruitMesh(fruitId: string): THREE.Group {
    const mat = new THREE.MeshLambertMaterial({ color: fruitColor(fruitId || 'apple') });
    const f = new THREE.Group();
    f.add(box(0.34, 0.36, 0.34, mat, 0, 0, 0));
    f.add(box(0.22, 0.16, 0.22, mat, 0, 0.22, 0));
    f.add(box(0.08, 0.14, 0.08, new THREE.MeshLambertMaterial({ color: 0x5e4023 }), 0, 0.34, 0));
    f.add(box(0.18, 0.06, 0.12, new THREE.MeshLambertMaterial({ color: 0x3e8e3a }), 0.12, 0.34, 0));
    return f;
  }

  // ===== 广场篝火堆（篝火晚会） =====
  bonfireBuilt = false;
  readonly bonfirePos = new THREE.Vector3(0, 0, 12);
  private bonfireFlames: THREE.Mesh[] = [];
  private bonfireLight: THREE.PointLight | null = null;

  buildBonfire() {
    if (this.bonfireBuilt) return;
    this.bonfireBuilt = true;
    const x = this.bonfirePos.x, z = this.bonfirePos.z;
    const y = groundHeight(x, z);
    const g = new THREE.Group();
    // 石圈
    const stoneMat = new THREE.MeshLambertMaterial({ color: 0x8a8578 });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.add(box(0.7, 0.5, 0.6, stoneMat, Math.cos(a) * 1.5, 0.25, Math.sin(a) * 1.5));
    }
    // 柴堆（交叉木柴）
    const logMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2f });
    const log1 = box(0.4, 1.6, 0.4, logMat, 0, 0.7, 0); log1.rotation.z = 0.5;
    const log2 = box(0.4, 1.6, 0.4, logMat, 0, 0.7, 0); log2.rotation.x = 0.5;
    const log3 = box(0.4, 1.6, 0.4, logMat, 0, 0.7, 0); log3.rotation.z = -0.5; log3.rotation.y = 1.2;
    g.add(log1, log2, log3);
    // 火焰（发光方块，update 里闪烁）
    const flameMat = new THREE.MeshLambertMaterial({ color: 0xf2a65a, emissive: 0xd86a20 });
    const flameMat2 = new THREE.MeshLambertMaterial({ color: 0xf7d774, emissive: 0xd89a30 });
    const f1 = box(0.8, 1.2, 0.8, flameMat, 0, 1.1, 0);
    const f2 = box(0.5, 0.9, 0.5, flameMat2, 0.15, 1.35, 0.1);
    const f3 = box(0.3, 0.6, 0.3, flameMat2, -0.15, 1.5, -0.1);
    g.add(f1, f2, f3);
    this.bonfireFlames = [f1, f2, f3];
    // 火光
    const light = new THREE.PointLight(0xff9a40, 2.2, 18, 1.6);
    light.position.set(0, 2.2, 0);
    g.add(light);
    this.bonfireLight = light;
    g.position.set(x, y, z);
    this.group.add(g);
    this.bonfireGroup = g;
    this.colliders.push({ x, z, r: 2.1 });
  }

  // 篝火晚会第二天：撤掉火堆
  private bonfireGroup?: THREE.Group;
  removeBonfire() {
    if (!this.bonfireBuilt) return;
    this.bonfireBuilt = false;
    if (this.bonfireGroup) { this.group.remove(this.bonfireGroup); this.bonfireGroup = undefined; }
    this.bonfireLight = null;
    const bp = this.bonfirePos;
    this.colliders = this.colliders.filter(c => !(Math.abs(c.x - bp.x) < 0.01 && Math.abs(c.z - bp.z) < 0.01 && c.r === 2.1));
  }

  // ===== 岛民冰淇淋店（经营玩法）：粉白条纹餐车 + 雨棚 + 冰淇淋招牌 =====
  readonly iceStallPos = new THREE.Vector3(-14, 0, 16); // 默认位置（玩家用地契选址时会改）
  iceStallBuilt = false;
  buildIceCreamStall(sx?: number, sz?: number) {
    if (this.iceStallBuilt) return;
    this.iceStallBuilt = true;
    if (sx !== undefined && sz !== undefined) this.iceStallPos.set(sx, 0, sz);
    const x = this.iceStallPos.x, z = this.iceStallPos.z;
    const y = groundHeight(x, z);
    const g = new THREE.Group();
    const pink = new THREE.MeshLambertMaterial({ color: 0xf2a8c0 });
    const cream = new THREE.MeshLambertMaterial({ color: 0xfff4e0 });
    const wood = new THREE.MeshLambertMaterial({ color: 0x8a6239 });
    // 车身 + 柜台
    g.add(box(3.6, 1.7, 2, cream, 0, 0.85, 0));
    g.add(box(3.8, 0.18, 2.2, pink, 0, 1.78, 0));
    // 车轮
    const wheelMat = new THREE.MeshLambertMaterial({ color: 0x5a4a3a });
    for (const wx of [-1.2, 1.2]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.2, 12), wheelMat);
      w.rotation.x = Math.PI / 2; w.position.set(wx, 0.45, 1.05);
      g.add(w);
    }
    // 撑杆 + 粉白条纹雨棚
    for (const px of [-1.7, 1.7]) g.add(box(0.12, 2.2, 0.12, wood, px, 2.8, 0.9));
    for (let i = 0; i < 6; i++) {
      const s = box(0.72, 0.1, 2.4, i % 2 ? pink : cream, -1.8 + 0.36 + i * 0.72, 3.9, 0.3);
      s.rotation.x = 0.22;
      g.add(s);
    }
    // 招牌：巨型冰淇淋蛋筒
    g.add(box(0.12, 1.6, 0.12, wood, 2.3, 0.8, 0));
    const coneMat = new THREE.MeshLambertMaterial({ color: 0xd9a05a });
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.9, 8), coneMat);
    cone.rotation.x = Math.PI; cone.position.set(2.3, 1.85, 0);
    const scoop = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), pink);
    scoop.position.set(2.3, 2.5, 0);
    const cherry = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), new THREE.MeshLambertMaterial({ color: 0xe84a5a }));
    cherry.position.set(2.3, 2.95, 0);
    g.add(cone, scoop, cherry);
    this.iceStallGroup = g;
    // 柜台上的小料盒 + 菜单牌
    g.add(box(0.5, 0.25, 0.4, new THREE.MeshLambertMaterial({ color: 0xf7d774 }), -0.9, 1.99, 0.4));
    g.add(box(0.5, 0.25, 0.4, new THREE.MeshLambertMaterial({ color: 0x9ad0f2 }), -0.3, 1.99, 0.4));
    g.add(box(0.9, 0.7, 0.08, wood, 0.9, 2.3, 0.6));
    g.add(emojiSprite('🍦', 0.8).translateX(0.9).translateY(2.35).translateZ(0.7));
    g.position.set(x, y, z);
    this.group.add(g);
    this.colliders.push({ x, z, r: 2.4 });
  }

  // 店铺升级外观：2级「小店」加侧柜+旗帜+地垫；3级「名店」加金招牌+气球+灯串
  private iceStallGroup?: THREE.Group;
  private stallLevel = 1;
  upgradeIceStall(level: number) {
    const g = this.iceStallGroup;
    if (!g || level <= this.stallLevel) return;
    this.stallLevel = level;
    const gold = new THREE.MeshLambertMaterial({ color: 0xf7d774, emissive: 0x554400 });
    const wood = new THREE.MeshLambertMaterial({ color: 0x8a6239 });
    if (level >= 2) {
      // 侧柜（外卖窗口）
      g.add(box(1.4, 1.2, 1.2, new THREE.MeshLambertMaterial({ color: 0xfff4e0 }), -2.6, 0.6, 0.2));
      g.add(box(1.5, 0.14, 1.3, new THREE.MeshLambertMaterial({ color: 0xf2a8c0 }), -2.6, 1.27, 0.2));
      // 门口地垫
      g.add(box(2.6, 0.06, 1.6, new THREE.MeshLambertMaterial({ color: 0xe84a5a }), 0, 0.03, 2.2));
      // 三角旗串
      for (let i = 0; i < 5; i++) {
        const flag = box(0.22, 0.3, 0.04, new THREE.MeshLambertMaterial({ color: [0xe84a5a, 0xf7d774, 0x4a90d9, 0x5ab88a, 0xf2a8c0][i] }), -1.4 + i * 0.7, 3.3 - Math.sin((i / 4) * Math.PI) * 0.25, 1.15);
        g.add(flag);
      }
      g.add(emojiSprite('🚩', 0.5).translateX(-2.3).translateY(4.3).translateZ(0.9));
    }
    if (level >= 3) {
      // 金色大招牌（名店）
      g.add(box(1.8, 0.7, 0.12, gold, 0, 4.5, 0.3));
      g.add(emojiSprite('👑', 0.6).translateX(0).translateY(4.55).translateZ(0.42));
      // 气球束
      const balloonColors = [0xe84a5a, 0x4a90d9, 0xf7d774];
      balloonColors.forEach((c, i) => {
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), new THREE.MeshLambertMaterial({ color: c }));
        b.position.set(2.9 + i * 0.3, 3.6 + (i % 2) * 0.35, 0.6);
        g.add(b);
        g.add(box(0.03, 1.2, 0.03, wood, 2.9 + i * 0.3, 2.9 + (i % 2) * 0.35, 0.6));
      });
      // 灯串
      for (let i = 0; i < 6; i++) {
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 5), new THREE.MeshLambertMaterial({ color: 0xfff2c0, emissive: 0xccaa44 }));
        bulb.position.set(-1.75 + i * 0.7, 3.55 - Math.sin((i / 5) * Math.PI) * 0.2, 1.12);
        g.add(bulb);
      }
    }
  }

  // ===== 观光码头（南岸木栈桥）+ 观光船 =====
  readonly pierPos = new THREE.Vector3(40, 0, 70); // 栈桥上岸口
  boat!: THREE.Group;
  constructor_pier_done = false;
  buildPier() {
    if (this.constructor_pier_done) return;
    this.constructor_pier_done = true;
    // 从 x=40 向南找水线，栈桥伸进水里
    let pz = 60;
    while (pz < HALF - 2 && !isWaterAt(40, pz)) pz += 1;
    this.pierPos.set(40, 0, pz - 4);
    const wood = new THREE.MeshLambertMaterial({ color: 0x9a7a52 });
    const woodDark = new THREE.MeshLambertMaterial({ color: 0x7a5f3e });
    const g = new THREE.Group();
    // 甲板（8 块木板）
    for (let i = 0; i < 8; i++) g.add(box(2.2, 0.14, 0.9, i % 2 ? wood : woodDark, 0, 0.5, i * 1.0 - 3.5));
    // 支柱 + 栏杆（柱子从水底一直顶到栏杆，不再悬空）
    for (const pzz of [-3.4, -1.2, 1.2, 3.4]) {
      for (const px of [-1.05, 1.05]) g.add(box(0.16, 2.4, 0.16, woodDark, px, 0.2, pzz));
    }
    for (const px of [-1.05, 1.05]) g.add(box(0.08, 0.08, 7.6, wood, px, 1.32, 0));
    // 码头灯
    g.add(box(0.16, 1.8, 0.16, woodDark, -1, 1.3, 3.4));
    g.add(emojiSprite('🏮', 0.7).translateX(-1).translateY(2.3).translateZ(3.4));
    const gy = Math.max(0.1, groundHeight(40, pz - 4));
    g.position.set(40, gy, pz - 4);
    this.group.add(g);
    this.mergables.push(g); // 码头栈桥参与合并

    // 观光船：木壳船身 + 白舱室 + 桅杆小旗（初始藏在前方远处海面）
    const boat = new THREE.Group();
    const hull = new THREE.MeshLambertMaterial({ color: 0x8a5f3a });
    boat.add(box(6.5, 1.6, 3, hull, 0, 0.8, 0));
    boat.add(box(5.5, 0.9, 2.4, new THREE.MeshLambertMaterial({ color: 0xa87f4e }), 0, 1.9, 0)); // 甲板沿
    boat.add(box(2.6, 1.7, 2, new THREE.MeshLambertMaterial({ color: 0xf7f0e0 }), -1, 2.8, 0)); // 舱室
    boat.add(box(2.8, 0.3, 2.2, new THREE.MeshLambertMaterial({ color: 0x4a8e5a }), -1, 3.8, 0)); // 舱顶
    boat.add(box(0.14, 4.4, 0.14, woodDark, 1.6, 3.6, 0)); // 桅杆
    const flag = box(1.3, 0.8, 0.06, new THREE.MeshLambertMaterial({ color: 0xf2b8c6 }), 2.3, 5.2, 0);
    boat.add(flag);
    boat.add(emojiSprite('🍦', 0.9).translateY(2.9).translateZ(1.15));
    boat.position.set(40, 0.4, pz + 160); // 远处待命
    boat.visible = false;
    this.group.add(boat);
    this.boat = boat;
  }

  // 修好断桥：切换到完整桥，移除路障碰撞
  setBridgeFixed(fixed: boolean) {
    if (this.bridgeFixed === fixed) return;
    this.bridgeFixed = fixed;
    this.mineBridgeGood.visible = fixed;
    this.mineBridgeBad.visible = !fixed;
    if (fixed && this.bridgeBarrier) {
      this.colliders = this.colliders.filter(c => c !== this.bridgeBarrier);
      this.bridgeBarrier = null;
    }
  }

  // 房屋窗户发光登记：夜晚主人在家时亮灯
  houseWindows: { name: string; mats: THREE.MeshLambertMaterial[] }[] = [];
  setHouseLit(name: string, lit: boolean, isNight: boolean) {
    const h = this.houseWindows.find(w => w.name === name);
    if (!h) return;
    for (const m of h.mats) {
      if (isNight && lit) { m.emissive.set(0xffb85a); m.emissiveIntensity = 1.1; m.color.set(0xffe8b0); }
      else if (isNight) { m.emissive.set(0x000000); m.color.set(0x1a2433); }
      else { m.emissive.set(0x223344); m.emissiveIntensity = 1; m.color.set(0xbfe8ff); }
    }
  }

  // 精致小屋（对标原版动森：坡屋顶+烟囱+门框+窗框+门前小院）
  private makeHouse(x: number, z: number, st: { wall: string; roofA: string; roofB: string; door: string; accent: string; big?: boolean }, name: string, faceYaw?: number) {
    const { g, winMats, S } = this.buildHouseGroup(st);
    // 门（+z面）朝向指定方向（默认朝向广场）
    const yaw = faceYaw ?? Math.atan2(-x, 20 - z);
    g.rotation.y = yaw;
    g.position.set(x, groundHeight(x, z), z);
    this.group.add(g);
    this.mergables.push(g); // 居民住宅：建好后不动，参与合并
    this.colliders.push({ x, z, r: 4.2 * S });
    this.houses.push({ name, x: x + Math.sin(yaw) * (4.4 * S), z: z + Math.cos(yaw) * (4.4 * S) });
    this.houseWindows.push({ name, mats: winMats });
  }

  private buildHouseGroup(st: { wall: string; roofA: string; roofB: string; door: string; accent: string; big?: boolean }) {
    const g = new THREE.Group();
    const S = st.big ? 1.3 : 1; // 大户型
    const wallMat = new THREE.MeshLambertMaterial({ map: wallTexture(st.wall, st.accent) });
    const roofMat = new THREE.MeshLambertMaterial({ map: roofTexture(st.roofA, st.roofB) });
    const trimMat = new THREE.MeshLambertMaterial({ color: st.accent });

    // 墙身 + 墙裙
    g.add(box(6 * S, 3.4 * S, 5 * S, wallMat, 0, 1.7 * S, 0));
    g.add(box(6.2 * S, 0.5, 5.2 * S, trimMat, 0, 0.25, 0));
    // 四坡屋顶 + 屋檐
    const roof = new THREE.Mesh(new THREE.ConeGeometry(4.6 * S, 2.4 * S, 4), roofMat);
    roof.position.y = (3.4 + 1.2) * S; roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    g.add(roof);
    const eave = new THREE.Mesh(new THREE.ConeGeometry(5 * S, 0.7 * S, 4), roofMat);
    eave.position.y = 3.55 * S; eave.rotation.y = Math.PI / 4;
    eave.castShadow = true;
    g.add(eave);
    // 烟囱
    g.add(box(0.8, 1.6, 0.8, trimMat, 1.8 * S, 4.6 * S, -1 * S));
    g.add(box(1, 0.3, 1, new THREE.MeshLambertMaterial({ color: 0x6a6a72 }), 1.8 * S, 5.4 * S, -1 * S));

    // 门（彩门 + 门框 + 门垫）
    const doorMat = new THREE.MeshLambertMaterial({ color: st.door });
    g.add(box(1.5, 2.3, 0.12, doorMat, 0, 1.15, 2.52 * S));
    g.add(box(1.8, 0.18, 0.2, trimMat, 0, 2.4, 2.55 * S));
    g.add(box(0.18, 2.5, 0.2, trimMat, -0.85, 1.2, 2.55 * S));
    g.add(box(0.18, 2.5, 0.2, trimMat, 0.85, 1.2, 2.55 * S));
    g.add(box(0.16, 0.16, 0.16, new THREE.MeshLambertMaterial({ color: 0xffd34d }), 0.5, 1.15, 2.62 * S)); // 门把手
    const mat2 = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1), new THREE.MeshLambertMaterial({ color: st.accent }));
    mat2.rotation.x = -Math.PI / 2; mat2.position.set(0, 0.06, 3.3 * S);
    g.add(mat2);

    // 窗户（窗框 + 十字棂 + 玻璃，夜晚可点亮）
    const winMats: THREE.MeshLambertMaterial[] = [];
    for (const wx of [-1.9 * S, 1.9 * S]) {
      g.add(box(1.3, 1.3, 0.14, trimMat, wx, 1.9, 2.5 * S));
      const glass = new THREE.MeshLambertMaterial({ color: 0xbfe8ff, emissive: 0x223344 });
      winMats.push(glass);
      g.add(box(1.05, 1.05, 0.16, glass, wx, 1.9, 2.52 * S));
      g.add(box(0.1, 1.05, 0.18, trimMat, wx, 1.9, 2.53 * S));
      g.add(box(1.05, 0.1, 0.18, trimMat, wx, 1.9, 2.53 * S));
      g.add(box(1.5, 0.16, 0.3, trimMat, wx, 2.62, 2.55 * S)); // 窗楣
    }
    // 侧面窗
    const sideGlass = new THREE.MeshLambertMaterial({ color: 0xbfe8ff, emissive: 0x223344 });
    winMats.push(sideGlass);
    g.add(box(0.14, 1.2, 1.2, trimMat, 3.02 * S, 1.9, 0));
    g.add(box(0.16, 0.95, 0.95, sideGlass, 3.04 * S, 1.9, 0));

    // 门前小院：矮篱笆（左右后三面）+ 石板路 + 花盆
    const fenceMat = new THREE.MeshLambertMaterial({ color: 0xf7f0e0 });
    const fy = 5.4 * S, fx = 4.4 * S;
    for (const sz of [-1, 1]) {
      for (let i = 0; i < 5; i++) g.add(box(0.14, 0.7, 0.14, fenceMat, sz * fx, 0.35, 2.5 * S + i * (fy - 2.5 * S) / 4));
      g.add(box(0.1, 0.12, fy - 2.5 * S, fenceMat, sz * fx, 0.55, (2.5 * S + fy) / 2));
      // 前排栅栏：中间留出 1.8S 宽的院门开口
      for (let i = 0; i < 3; i++) g.add(box(0.14, 0.7, 0.14, fenceMat, sz * (fx - i * (fx - 0.9 * S) / 2), 0.35, fy));
      g.add(box(fx - 0.9 * S, 0.12, 0.1, fenceMat, sz * (0.9 * S + (fx - 0.9 * S) / 2), 0.55, fy));
    }
    for (let i = 0; i < 3; i++) {
      const stone = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.8), new THREE.MeshLambertMaterial({ color: 0xcfc8b8 }));
      stone.rotation.x = -Math.PI / 2;
      stone.position.set(0, 0.05, (4 + i * 1.4) * S);
      g.add(stone);
    }
    const potMat = new THREE.MeshLambertMaterial({ color: 0xb5673a });
    for (const px of [-1.5 * S, 1.5 * S]) {
      g.add(box(0.5, 0.45, 0.5, potMat, px, 0.22, 3.1 * S));
      g.add(box(0.55, 0.45, 0.55, new THREE.MeshLambertMaterial({ color: 0xe86a8a }), px, 0.65, 3.1 * S));
    }

    return { g, winMats, S };
  }

  private buildBuildings() {
    // ===== 友好商店（喵喵商会）：木屋商店 + 条纹雨棚 + 招牌（对标 Nook's Cranny）=====
    const shop = new THREE.Group();
    const shopWall = new THREE.MeshLambertMaterial({ map: wallTexture('#e8d5a8', '#c9b385') });
    shop.add(box(8, 4, 6, shopWall, 0, 2, 0));
    shop.add(box(8.3, 0.5, 6.3, new THREE.MeshLambertMaterial({ color: 0x8a6239 }), 0, 0.25, 0));
    const shopRoof = new THREE.Mesh(new THREE.ConeGeometry(6.4, 2.6, 4), new THREE.MeshLambertMaterial({ map: roofTexture('#4a8e5a', '#3e7e4e') }));
    shopRoof.position.y = 5.3; shopRoof.rotation.y = Math.PI / 4; shopRoof.castShadow = true;
    shop.add(shopRoof);
    // 条纹雨棚
    const awnA = new THREE.MeshLambertMaterial({ color: 0x4a8e5a });
    const awnB = new THREE.MeshLambertMaterial({ color: 0xf7f0e0 });
    for (let i = 0; i < 8; i++) {
      const s = box(1, 0.12, 1.6, i % 2 ? awnA : awnB, -3.5 + i, 3.3, 3.6);
      s.rotation.x = 0.35;
      shop.add(s);
    }
    // 店门 + 橱窗
    shop.add(box(1.6, 2.6, 0.14, new THREE.MeshLambertMaterial({ color: 0x6a4a2f }), 0, 1.3, 3.02));
    const shopGlass = new THREE.MeshLambertMaterial({ color: 0xbfe8ff, emissive: 0x334455 });
    for (const wx of [-2.6, 2.6]) {
      shop.add(box(2, 1.6, 0.14, new THREE.MeshLambertMaterial({ color: 0x8a6239 }), wx, 1.8, 3.02));
      shop.add(box(1.7, 1.3, 0.16, shopGlass, wx, 1.8, 3.04));
    }
    // 招牌 + 门口木箱装饰
    shop.add(box(3.4, 1, 0.2, new THREE.MeshLambertMaterial({ color: 0x8a6239 }), 0, 4.2, 3.1));
    shop.add(emojiSprite('🍃', 1.2).translateY(4.2).translateZ(3.3));
    const crateMat = new THREE.MeshLambertMaterial({ map: trunkTexture() });
    shop.add(box(0.9, 0.9, 0.9, crateMat, -4.6, 0.45, 2.6));
    shop.add(box(0.7, 0.7, 0.7, crateMat, -4.5, 1.25, 2.7));
    shop.add(emojiSprite('🍎', 0.9).translateX(-4.5).translateY(2).translateZ(2.7));
    const shopYaw = Math.atan2(0 - (-30), 20 - 26);
    shop.rotation.y = shopYaw;
    shop.position.set(-30, groundHeight(-30, 26), 26);
    this.group.add(shop);
    this.mergables.push(shop);
    this.colliders.push({ x: -30, z: 26, r: 5.4 });
    this.shopPos.set(-30 + Math.sin(shopYaw) * 5.2, 0, 26 + Math.cos(shopYaw) * 5.2);
    this.houses.push({ name: '友好商店', x: this.shopPos.x, z: this.shopPos.z }); // 可从店门进入
    this.nookPos.set(-30 + Math.sin(shopYaw) * 6.6, 0, 26 + Math.cos(shopYaw) * 6.6);

    // ===== 服务处（广场东侧建筑形态，对标原版 Resident Services：砖墙 + 墨绿坡屋顶 + 拱形大门 + 旗杆）=====
    const svc = new THREE.Group();
    const svcWall = new THREE.MeshLambertMaterial({ map: wallTexture('#e8d5a8', '#c9a86a') });
    const svcTrim = new THREE.MeshLambertMaterial({ color: 0x8a6239 });
    // 基座抬高 + 主体
    svc.add(box(9.6, 0.6, 7.6, new THREE.MeshLambertMaterial({ color: 0xb0a890 }), 0, 0.3, 0));
    svc.add(box(9, 4.4, 7, svcWall, 0, 0.6 + 2.2, 0));
    // 墨绿四坡屋顶 + 屋脊
    const svcRoofMat = new THREE.MeshLambertMaterial({ color: 0x3e6b4a });
    const svcRoof = new THREE.Mesh(new THREE.ConeGeometry(7, 2.6, 4), svcRoofMat);
    svcRoof.position.y = 0.6 + 4.4 + 1.3; svcRoof.rotation.y = Math.PI / 4; svcRoof.castShadow = true;
    svc.add(svcRoof);
    svc.add(box(1.6, 0.5, 1.6, svcRoofMat, 0, 0.6 + 4.4 + 2.5, 0));
    // 旗杆 + 绿叶旗（原版服务处标志）
    svc.add(box(0.16, 4.6, 0.16, svcTrim, 0, 0.6 + 4.4 + 2.6 + 2.3, 0));
    svc.add(box(1.2, 0.75, 0.07, new THREE.MeshLambertMaterial({ color: 0x4a8e5a }), 0.68, 0.6 + 4.4 + 2.6 + 4.2, 0));
    svc.add(emojiSprite('🍃', 0.7).translateY(0.6 + 4.4 + 2.6 + 4.2).translateX(0.68).translateZ(0.1));
    // 木门（西侧朝广场）：圆窗 + 木框 + 小雨棚，对标原版服务处正门
    const svcDoorMat = new THREE.MeshLambertMaterial({ color: 0x5a3a26 });
    const svcWinMat = new THREE.MeshLambertMaterial({ color: 0xfff2c0, emissive: 0x000000 });
    this.houseWindows.push({ name: '服务处', mats: [svcWinMat] });
    svc.add(box(0.18, 3, 2.4, svcTrim, -4.5, 0.6 + 1.5, 0));            // 门框
    svc.add(box(0.22, 2.7, 2, svcDoorMat, -4.54, 0.6 + 1.35, 0));       // 深色门板
    const doorWin = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.1, 16), svcWinMat);
    doorWin.rotation.z = Math.PI / 2;
    doorWin.position.set(-4.68, 0.6 + 2, 0);
    svc.add(doorWin);                                                    // 门上圆窗
    svc.add(box(0.14, 0.5, 0.14, new THREE.MeshLambertMaterial({ color: 0xf7d02c }), -4.7, 0.6 + 1.2, 0.7)); // 门把手
    svc.add(box(3.2, 0.28, 1.8, svcRoofMat, -4.85, 0.6 + 3.2, 0));      // 贴墙雨棚（无立柱）
    // 台阶（西侧面三级）
    for (let i = 0; i < 2; i++) svc.add(box(1.1, 0.3, 3.4 - i * 0.8, new THREE.MeshLambertMaterial({ color: 0xcfc8b8 }), -5.1 - i * 0.9, 0.45 - i * 0.3, 0));
    // 两侧圆窗（西立面）
    for (const wz of [-2.6, 2.6]) {
      const win = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.16, 16), svcWinMat);
      win.rotation.z = Math.PI / 2;
      win.position.set(-4.52, 0.6 + 2.4, wz);
      svc.add(win);
      svc.add(box(0.3, 0.18, 1.7, svcTrim, -4.55, 0.6 + 3.2, wz)); // 窗眉
    }
    svc.position.set(13, groundHeight(13, 20), 20);
    this.group.add(svc);
    this.mergables.push(svc);
    this.colliders.push({ x: 13, z: 20, r: 5.2 });
    this.houses.push({ name: '服务处', x: 13 - 6.4, z: 20 }); // 西门进入

    // ===== 博物馆（北侧，对标原版：立柱 + 三角楣 + 台阶）=====
    const mus = new THREE.Group();
    const musWall = new THREE.MeshLambertMaterial({ map: wallTexture('#e8e2d5', '#c9c2b0') });
    // 抬高底座（高台基座，对标原版博物馆）
    mus.add(box(14.2, 0.8, 9.2, new THREE.MeshLambertMaterial({ color: 0xb0a890 }), 0, 0.4, 0));
    mus.add(box(13, 5, 8, musWall, 0, 0.8 + 2.5, 0));
    // 三角楣
    const ped = new THREE.Mesh(new THREE.ConeGeometry(7.6, 2.4, 4), new THREE.MeshLambertMaterial({ color: 0x8a94a6 }));
    ped.position.y = 0.8 + 6.2; ped.rotation.y = Math.PI / 4; ped.castShadow = true;
    mus.add(ped);
    // 四根立柱
    const colMat = new THREE.MeshLambertMaterial({ color: 0xf2eee0 });
    for (const cx of [-4.5, -1.5, 1.5, 4.5]) {
      mus.add(box(0.8, 4.6, 0.8, colMat, cx, 0.8 + 2.3, 4.4));
      mus.add(box(1.1, 0.4, 1.1, colMat, cx, 0.8 + 4.8, 4.4));
      mus.add(box(1.1, 0.4, 1.1, colMat, cx, 0.8 + 0.2, 4.4));
    }
    // 大门 + 台阶（越靠近门口越高，逐级登台入馆）+ 猫头鹰招牌
    mus.add(box(2.4, 3.4, 0.2, new THREE.MeshLambertMaterial({ color: 0x5a4a6a }), 0, 0.8 + 1.7, 4.02));
    for (let i = 0; i < 3; i++) mus.add(box(4.8 + i * 1.6, 0.27, 1.2, new THREE.MeshLambertMaterial({ color: 0xcfc8b8 }), 0, 0.665 - i * 0.265, 4.8 + i * 1.1));
    mus.add(box(2.6, 1, 0.2, new THREE.MeshLambertMaterial({ color: 0x5a4a6a }), 0, 0.8 + 4, 4.15));
    mus.add(emojiSprite('🦉', 1).translateY(0.8 + 4).translateZ(4.35));
    mus.position.set(0, hq(0, 54), 54); // 基座贴地形（groundHeight 在台阶区会额外加高，不能用它）
    mus.rotation.y = Math.PI; // 门朝南向广场
    this.group.add(mus);
    this.mergables.push(mus);
    this.colliders.push({ x: 0, z: 55.5, r: 7.4 }); // 留出台阶区域，玩家能走到门前
    this.houses.push({ name: '博物馆', x: 0, z: 47.4 });

    // ===== 裁缝店（广场东侧，对标 Able Sisters）=====
    const tailor = new THREE.Group();
    const tWall = new THREE.MeshLambertMaterial({ map: wallTexture('#e8d5e8', '#c9b3c9') });
    tailor.add(box(6, 3.6, 5, tWall, 0, 1.8, 0));
    const tRoof = new THREE.Mesh(new THREE.ConeGeometry(4.8, 2, 4), new THREE.MeshLambertMaterial({ map: roofTexture('#9a6ab8', '#8a5aa8') }));
    tRoof.position.y = 4.6; tRoof.rotation.y = Math.PI / 4; tRoof.castShadow = true;
    tailor.add(tRoof);
    const tAwnA = new THREE.MeshLambertMaterial({ color: 0x9a6ab8 });
    for (let i = 0; i < 6; i++) {
      const s = box(1, 0.12, 1.4, i % 2 ? tAwnA : awnB, -2.5 + i, 3, 3.1);
      s.rotation.x = 0.35;
      tailor.add(s);
    }
    tailor.add(box(1.4, 2.4, 0.14, new THREE.MeshLambertMaterial({ color: 0x6a4a6e }), 0, 1.2, 2.52));
    tailor.add(box(2.4, 0.9, 0.2, new THREE.MeshLambertMaterial({ color: 0x6a4a6e }), 0, 3.8, 2.7));
    tailor.add(emojiSprite('🧵', 1).translateY(3.8).translateZ(2.9));
    const tGlass = new THREE.MeshLambertMaterial({ color: 0xbfe8ff, emissive: 0x334455 });
    tailor.add(box(1.2, 1.2, 0.14, tGlass, -1.8, 1.8, 2.52));
    tailor.add(box(1.2, 1.2, 0.14, tGlass, 1.8, 1.8, 2.52));
    const tYaw = Math.atan2(0 - 30, 20 - 26);
    tailor.rotation.y = tYaw;
    tailor.position.set(30, groundHeight(30, 26), 26);
    this.group.add(tailor);
    this.mergables.push(tailor);
    this.colliders.push({ x: 30, z: 26, r: 4.4 });
    this.houses.push({ name: '裁缝店', x: 30 + Math.sin(tYaw) * 4, z: 26 + Math.cos(tYaw) * 4 });

    // 玩家帐篷（初期）→ 偿还贷款后升级为房子
    this.buildPlayerHome(44, 20);

    // ===== 村民之家（来自各宝可梦文件夹的档案，由 applyResidents 分配槽位）=====
    for (const p of VILLAGER_PROFILES) {
      if (p.house) this.makeHouse(p.home.x, p.home.z, p.house, `${p.def.name}的家`);
    }

    // 布告栏（广场）
    const board = new THREE.Group();
    const bm = new THREE.MeshLambertMaterial({ color: 0x8a6239 });
    board.add(box(0.25, 2.2, 0.25, bm, -0.8, 1.1, 0));
    board.add(box(0.25, 2.2, 0.25, bm, 0.8, 1.1, 0));
    board.add(box(2.2, 1.4, 0.15, new THREE.MeshLambertMaterial({ color: 0xc9a86a }), 0, 1.8, 0));
    board.add(emojiSprite('📋', 0.9).translateY(1.8).translateZ(0.2));
    board.position.set(5, groundHeight(5, 16), 16);
    this.group.add(board);
    this.mergables.push(board);
    this.colliders.push({ x: 5, z: 16, r: 0.9 });
    this.boardPos.set(5, 0, 16);

    // 路灯（夜晚自动点亮）：广场环 + 路网沿线 + 住宅街
    const lampMat = new THREE.MeshLambertMaterial({ color: 0x3a3a44 });
    const lampSpots: [number, number][] = [
      [-8, 12], [8, 12], [-8, 28], [8, 28],    // 广场四角（广场外圈）
      [-17, 28.5], [17, 28.5],                 // 商店街（路北侧）
      [4, 40], [-8, 47.5], [8, 47.5],          // 博物馆大道（台阶两侧让开）
      [24, 23.5], [36, 23.5],                  // 玩家家路（路北侧）
      [4, -6], [4, -24],                       // 桥头（路东侧）
      [-20, -42.5], [-48, -42.5], [4, -42.5], [32, -42.5], [60, -42.5], // 住宅街 A（路北侧）
      [-47.5, -64], [47.5, -64],               // B 排路口（路外侧）
      [-77, -48],                              // 高原坡道口（路旁）
    ];
    for (const [lx, lz] of lampSpots) {
      const lamp = new THREE.Group();
      lamp.add(box(0.22, 3, 0.22, lampMat, 0, 1.5, 0));
      const bulbMat = new THREE.MeshLambertMaterial({ color: 0xfff2c0, emissive: 0x000000 });
      lamp.add(box(0.55, 0.55, 0.55, bulbMat, 0, 3.1, 0));
      const light = new THREE.PointLight(0xffd9a0, 0, 22);
      light.decay = 1; // 衰减放缓，光线能到达地面
      light.position.set(0, 2.7, 0);
      lamp.add(light);
      // 地面光晕（径向渐变：中间亮、边缘柔和消失）
      const poolMat = new THREE.MeshBasicMaterial({ map: glowPoolTexture(), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
      const pool = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 6.4), poolMat);
      pool.rotation.x = -Math.PI / 2;
      pool.position.y = 0.1;
      lamp.add(pool);
      this.lampPools.push(poolMat);
      this.lamps.push(light);
      this.lampBulbs.push(bulbMat);
      lamp.position.set(lx, groundHeight(lx, lz), lz);
      this.group.add(lamp);
      this.colliders.push({ x: lx, z: lz, r: 0.5 });
    }

    // 邮箱（玩家家门口）
    const mail = new THREE.Group();
    mail.add(box(0.2, 1, 0.2, bm, 0, 0.5, 0));
    mail.add(box(0.8, 0.5, 0.5, new THREE.MeshLambertMaterial({ color: 0xd9534f }), 0, 1.2, 0));
    mail.position.set(39.5, groundHeight(39.5, 23.5), 23.5);
    this.group.add(mail);
    this.mergables.push(mail);
    this.colliders.push({ x: 39.5, z: 23.5, r: 0.5 });
  }

  // 玩家帐篷 → 房子
  homeTent!: THREE.Group;
  homeHouse!: THREE.Group;
  homeUpgraded = false;

  // 露营者搬入后，动态补建住宅（固定槽位）
  addResidentHome(p: import('./villagers').VillagerProfile) {
    if (p.house) this.makeHouse(p.home.x, p.home.z, p.house, `${p.def.name}的家`);
  }

  // 高原广场扎起考察帐篷（动森露营地风格：小一号条纹帐篷）
  buildCampTent() {
    if (this.campTent) return;
    const t = new THREE.Group();
    const tentMat = new THREE.MeshLambertMaterial({ map: tentSvgTexture('#7ec8e3', '#f7f0e0', true) });
    const roof = new THREE.Mesh(new THREE.ConeGeometry(3.6, 2.8, 4), tentMat);
    roof.position.y = 1.4;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    t.add(roof);
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x8a6239 });
    t.add(box(0.2, 3.8, 0.2, poleMat, 0, 1.9, 0));
    const ballMat = new THREE.MeshLambertMaterial({ color: 0x4a8e5a });
    t.add(box(0.34, 0.34, 0.34, ballMat, 0, 3.95, 0));
    t.add(box(0.07, 0.6, 0.07, poleMat, 0, 4.3, 0));
    t.add(box(0.6, 0.36, 0.05, ballMat, 0.34, 4.42, 0));
    // 营火
    const fireMat = new THREE.MeshLambertMaterial({ color: 0xe2853a, emissive: 0x813a10 });
    t.add(box(0.5, 0.4, 0.5, new THREE.MeshLambertMaterial({ color: 0x6b4a2f }), 2.6, 0.2, 1.6));
    t.add(box(0.3, 0.5, 0.3, fireMat, 2.6, 0.6, 1.6));
    const cx = this.campPos.x, cz = this.campPos.z;
    t.position.set(cx, groundHeight(cx, cz), cz);
    this.group.add(t);
    this.campTent = t;
    this.campCollider = { x: cx, z: cz, r: 3.2 };
    this.colliders.push(this.campCollider);
  }

  removeCampTent() {
    if (!this.campTent) return;
    this.group.remove(this.campTent);
    this.campTent = null;
    if (this.campCollider) {
      this.colliders = this.colliders.filter(c => c !== this.campCollider);
      this.campCollider = null;
    }
  }

  private buildPlayerHome(x: number, z: number) {
    // 帐篷（原版动森风：SVG 条纹帐篷布 + 门帘 + 顶球小旗 + 拉绳地钉）
    const t = new THREE.Group();
    const tentMat = new THREE.MeshLambertMaterial({ map: tentSvgTexture('#f2c94c', '#f7f0e0', true) });
    const roof = new THREE.Mesh(new THREE.ConeGeometry(4.4, 3.2, 4), tentMat);
    roof.position.y = 1.6; // 帐篷布下端贴地
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    t.add(roof);
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x8a6239 });
    // 中柱 + 顶球 + 小旗
    t.add(box(0.22, 4.6, 0.22, poleMat, 0, 2.3, 0));
    const ballMat = new THREE.MeshLambertMaterial({ color: 0xe2556b });
    t.add(box(0.4, 0.4, 0.4, ballMat, 0, 4.75, 0));
    t.add(box(0.08, 0.7, 0.08, poleMat, 0, 5.2, 0));
    t.add(box(0.7, 0.42, 0.05, ballMat, 0.4, 5.35, 0));
    // 门帘已直接印在帐篷布上（tentSvgTexture door 参数），无需独立门模型
    // 四角拉绳：从篷布边缘斜拉到外侧地钉（沿对角线方向）
    const ropeMat = new THREE.MeshLambertMaterial({ color: 0xd9c9a0 });
    const up = new THREE.Vector3(0, 1, 0);
    for (const [ax, az] of [[0.7071, 0.7071], [-0.7071, 0.7071], [0.7071, -0.7071], [-0.7071, -0.7071]]) {
      const anchor = new THREE.Vector3(ax * 1.8, 1.9, az * 1.8);  // 篷布对角棱中段
      const stake = new THREE.Vector3(ax * 5.2, 0.1, az * 5.2);   // 外侧地钉
      const len = anchor.distanceTo(stake);
      const rope = new THREE.Mesh(new THREE.BoxGeometry(0.07, len, 0.07), ropeMat);
      rope.position.copy(anchor).add(stake).multiplyScalar(0.5);
      rope.quaternion.setFromUnitVectors(up, stake.clone().sub(anchor).normalize());
      t.add(rope);
      t.add(box(0.16, 0.45, 0.16, poleMat, stake.x, 0.22, stake.z)); // 地钉
    }
    const homeYaw = Math.atan2(-x, -z);
    t.rotation.y = homeYaw;
    t.position.set(x, groundHeight(x, z), z);
    this.homeTent = t;
    this.group.add(t);
    this.colliders.push({ x, z, r: 3.6 });
    this.houses.push({ name: '你的帐篷', x: x + Math.sin(homeYaw) * 3.4, z: z + Math.cos(homeYaw) * 3.4 });

    // 房子（初始隐藏，精致版）
    const { g, winMats } = this.buildHouseGroup({ wall: '#f2e3c6', roofA: '#d9853b', roofB: '#c97530', door: '#8a5a3b', accent: '#d9c49a' });
    g.rotation.y = Math.atan2(-x, 20 - z);
    g.position.set(x, groundHeight(x, z), z);
    g.visible = false;
    this.homeHouse = g;
    this.group.add(g);
    this.houseWindows.push({ name: '你的家', mats: winMats });
  }

  upgradeHome() {
    this.homeUpgraded = true;
    this.homeTent.visible = false;
    this.homeHouse.visible = true;
    const h = this.houses.find(h => h.name === '你的帐篷');
    if (h) h.name = '你的家';
  }

  // 偿还金币房贷后扩建房子（更大一号）
  homeExpanded = false;
  expandHome() {
    this.homeExpanded = true;
    this.homeHouse.scale.setScalar(1.22);
  }

  // ---------- 植被/石头 ----------
  private randomGrassPos(minR = 0): [number, number] | null {
    for (let tries = 0; tries < 40; tries++) {
      const x = (Math.random() - 0.5) * (HALF * 2 - 10);
      const z = (Math.random() - 0.5) * (HALF * 2 - 10);
      if (Math.hypot(x, z) < minR) continue;
      if (tileType(x, z) !== 'grass') continue;
      if (Math.hypot(x, z) > 108) continue;
      if (onRamp(x, z)) continue;
      if (this.colliders.some(c => Math.hypot(x - c.x, z - c.z) < c.r + 2.5)) continue;
      return [x, z];
    }
    return null;
  }

  private buildTrees() {
    for (let i = 0; i < 150; i++) {
      // 广场周边留出开阔视野（半径17内不种树）
      const p = this.randomGrassPos(17);
      if (!p) continue;
      // 果树与非果树各占一半
      const isFruit = i % 2 === 0;
      const fruit = isFruit ? FRUIT_IDS[Math.floor(Math.random() * FRUIT_IDS.length)] : '';
      const tree = new Tree(p[0], p[1], fruit, this.leafMat, this.trunkMat);
      this.trees.push(tree);
      this.colliders.push({ x: p[0], z: p[1], r: 0.85 });
    }
  }

  private buildRocks() {
    const mat = new THREE.MeshLambertMaterial({ map: rockTexture() });
    for (let i = 0; i < 14; i++) {
      const p = this.randomGrassPos(10);
      if (!p) continue;
      const g = new THREE.Group();
      g.add(box(1.6, 1.2, 1.4, mat, 0, 0.6, 0));
      g.add(box(0.9, 0.7, 0.9, mat, 0.7, 0.35, 0.4));
      g.add(box(0.7, 0.5, 0.7, mat, -0.7, 0.25, -0.3));
      g.position.set(p[0], groundHeight(p[0], p[1]), p[1]);
      this.group.add(g);
      this.rocks.push({ x: p[0], z: p[1], group: g, cooldownUntil: 0 });
      this.colliders.push({ x: p[0], z: p[1], r: 1.2 });
    }
  }

  private buildFlowers() {
    for (let i = 0; i < 100; i++) {
      const p = this.randomGrassPos(9);
      if (!p) continue;
      this.addFlower(p[0], p[1], FLOWER_IDS[Math.floor(Math.random() * FLOWER_IDS.length)]);
    }
  }

  addFlower(x: number, z: number, itemId: string) {
    if (!this.flowerMats[itemId]) {
      const colors: Record<string, [string, string]> = {
        flower_red: ['#e2455a', '#ffd34d'],
        flower_yellow: ['#ffd34d', '#e2863b'],
        flower_white: ['#f7f7f0', '#ffd34d'],
      };
      const [petal, center] = colors[itemId] || ['#e2455a', '#ffd34d'];
      // SVG 绘制的整株小花（带茎叶），十字面片各角度可见
      this.flowerMats[itemId] = new THREE.MeshLambertMaterial({
        map: flowerSvgTexture(petal, center),
        transparent: true,
        alphaTest: 0.35,
        side: THREE.DoubleSide,
      });
    }
    const fi = this.ensureFlowerInst(itemId);
    if (!fi.free.length) return; // 槽位满了就不再种（容量 220/色）
    const slot = fi.free.pop()!;
    this.setInst(fi.im, slot, x, groundHeight(x, z), z, 1, 1, 1);
    fi.im.instanceMatrix.needsUpdate = true;
    this.flowers.push({ id: this.nextId++, x, z, itemId, slot });
  }

  removeFlower(f: Flower) {
    const fi = this.flowerI[f.itemId];
    if (fi) {
      this.clearInst(fi.im, f.slot);
      fi.free.push(f.slot);
    }
    this.flowers = this.flowers.filter(x => x.id !== f.id);
  }

  // ---------- 虫 ----------
  private buildBugs() {
    for (let i = 0; i < 10; i++) this.spawnBug(false);
  }
  spawnBug(night: boolean) {
    const candidates = BUG_DEFS.filter(d => d.night === night);
    const def = candidates.length ? weightedPick(candidates.map(c => ({ ...c, weight: c.weight }))) : BUG_DEFS[0];
    const anchor = this.flowers.length && !night
      ? this.flowers[Math.floor(Math.random() * this.flowers.length)]
      : null;
    const pos = anchor
      ? new THREE.Vector3(anchor.x, groundHeight(anchor.x, anchor.z) + 1, anchor.z)
      : new THREE.Vector3((Math.random() - 0.5) * 60, 0, (Math.random() - 0.5) * 60);
    if (!anchor) pos.y = groundHeight(pos.x, pos.z) + 1;
    const bug = new Bug(def, pos);
    this.group.add(bug.group);
    this.bugs.push(bug);
  }
  removeBug(b: Bug) {
    this.group.remove(b.group);
    this.bugs = this.bugs.filter(x => x !== b);
  }

  // ---------- 鱼 ----------
  private buildFishes() {
    // 河鱼 9 条（沿河来回）
    for (let i = 0; i < 9; i++) {
      const def = weightedPick(FISH_DEFS);
      const fish = new Fish(def.itemId, def.size, (Math.random() - 0.5) * 220);
      fish.update(0, null);
      this.group.add(fish.group);
      this.fishes.push(fish);
    }
    // 海鱼 6 条（环岛海域锚点漫游）
    for (let i = 0; i < 6; i++) {
      const def = weightedPick(FISH_DEFS);
      const fish = new Fish(def.itemId, def.size, 0);
      fish.sea = true;
      // 在岛外缘找水域锚点（半径逐步外扩，保证一定落在水里）
      let r = 55;
      while (true) {
        const a = Math.random() * Math.PI * 2;
        const ax = Math.cos(a) * r, az = Math.sin(a) * r;
        if (isWaterAt(ax, az)) { fish.seaAnchor.set(ax, 0, az); break; }
        r += 2;
        if (r > 200) break;
      }
      fish.group.position.set(fish.seaAnchor.x, WATER_Y - 0.12, fish.seaAnchor.z);
      this.group.add(fish.group);
      this.fishes.push(fish);
    }
  }
  respawnFish(fish: Fish) {
    const def = weightedPick(FISH_DEFS);
    const nf = new Fish(def.itemId, def.size, (Math.random() - 0.5) * 220);
    // 海鱼在原海域重生
    nf.sea = fish.sea;
    nf.seaAnchor.copy(fish.seaAnchor);
    nf.update(0, null);
    this.group.remove(fish.group);
    this.group.add(nf.group);
    this.fishes = this.fishes.map(f => f === fish ? nf : f);
  }

  // ---------- 挖掘点 ----------
  private buildDigSpots() {
    for (let i = 0; i < 8; i++) this.spawnDigSpot();
  }
  spawnDigSpot() {
    const p = this.randomGrassPos(9);
    if (!p) return;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), new THREE.MeshBasicMaterial({ map: this.digTex, transparent: true, polygonOffset: true, polygonOffsetFactor: -2 }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(p[0], groundHeight(p[0], p[1]) + 0.08, p[1]);
    this.group.add(m);
    this.digSpots.push({ id: this.nextId++, x: p[0], z: p[1], mesh: m });
  }
  removeDigSpot(s: DigSpot) {
    this.group.remove(s.mesh);
    this.digSpots = this.digSpots.filter(x => x.id !== s.id);
  }

  // ---------- 氛围 ----------
  private buildAmbient() {
    // 星星
    const starGeo = new THREE.BufferGeometry();
    const starPos: number[] = [];
    for (let i = 0; i < 700; i++) {
      const a = Math.random() * Math.PI * 2, e = Math.random() * Math.PI * 0.45 + 0.1;
      starPos.push(Math.cos(a) * Math.cos(e) * 220, Math.sin(e) * 220, Math.sin(a) * Math.cos(e) * 220);
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
    this.stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.9, sizeAttenuation: false, transparent: true, opacity: 0 }));
    this.group.add(this.stars);

    // 月亮（弯月 + 柔和月晕）
    const mc = document.createElement('canvas');
    mc.width = mc.height = 128;
    const mctx = mc.getContext('2d')!;
    const mg = mctx.createRadialGradient(64, 64, 10, 64, 64, 62);
    mg.addColorStop(0, 'rgba(255,248,220,0.5)');
    mg.addColorStop(0.55, 'rgba(220,228,255,0.16)');
    mg.addColorStop(1, 'rgba(220,228,255,0)');
    mctx.fillStyle = mg;
    mctx.fillRect(0, 0, 128, 128);
    mctx.fillStyle = '#fdf6dd';
    mctx.beginPath(); mctx.arc(64, 64, 26, 0, Math.PI * 2); mctx.fill();
    mctx.globalCompositeOperation = 'destination-out';
    mctx.beginPath(); mctx.arc(76, 56, 22, 0, Math.PI * 2); mctx.fill(); // 擦掉一口成弯月
    mctx.globalCompositeOperation = 'source-over';
    const moonTex = new THREE.CanvasTexture(mc);
    this.moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonTex, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    this.moon.scale.setScalar(46);
    this.moon.position.set(70, 95, -110);
    this.group.add(this.moon);
    // 月光（清冷的定向光，夜晚照亮全岛）
    this.moonLight = new THREE.DirectionalLight(0x9db8ff, 0);
    this.moonLight.position.set(60, 90, -60);
    this.group.add(this.moonLight);

    // 萤火虫
    const ffGeo = new THREE.BufferGeometry();
    const ffPos: number[] = [];
    for (let i = 0; i < 40; i++) {
      const x = (Math.random() - 0.5) * 200, z = (Math.random() - 0.5) * 200;
      ffPos.push(x, groundHeight(x, z) + 1 + Math.random() * 1.5, z);
    }
    ffGeo.setAttribute('position', new THREE.Float32BufferAttribute(ffPos, 3));
    this.fireflies = new THREE.Points(ffGeo, new THREE.PointsMaterial({ color: 0xd8ff6a, size: 0.25, transparent: true, opacity: 0 }));
    this.group.add(this.fireflies);

    // 飘落花瓣
    const pGeo = new THREE.BufferGeometry();
    const pPos: number[] = [];
    for (let i = 0; i < 48; i++) {
      pPos.push((Math.random() - 0.5) * 220, 2 + Math.random() * 8, (Math.random() - 0.5) * 220);
    }
    pGeo.setAttribute('position', new THREE.Float32BufferAttribute(pPos, 3));
    this.petals = new THREE.Points(pGeo, new THREE.PointsMaterial({ color: 0xffc7dd, size: 0.32, transparent: true, opacity: 0.85 }));
    this.group.add(this.petals);
  }

  // ---------- 掉落物 ----------
  addPickup(item: string, pos: THREE.Vector3, bells?: number, toss = false) {
    const g = new THREE.Group();
    if (item === 'branch') {
      // 树枝 3D 模型：一根斜树枝 + 小枝杈
      const branchMat = new THREE.MeshLambertMaterial({ color: 0x7a5330 });
      const stick = box(0.7, 0.12, 0.12, branchMat, 0, 0.1, 0);
      stick.rotation.z = 0.25; stick.rotation.y = Math.random() * Math.PI;
      const twig = box(0.3, 0.09, 0.09, branchMat, 0.15, 0.22, 0);
      twig.rotation.z = 0.9; twig.rotation.y = stick.rotation.y;
      g.add(stick, twig);
    } else {
      if (item === 'bells') {
        g.add(emojiSprite('💰', 1.3));
      } else if (item === 'apple' || item === 'cherry' || item === 'orange' || item === 'peach') {
        g.add(makeFruitDrop(item, 1.15)); // 树果掉落保持水果形态
      } else {
        // 其他物品（摆件/材料/生物等）掉落形态：精灵球（对应原版动森的"叶子"）
        const ball = makePokeBall(1.15);
        ball.position.y = 0.05;
        g.add(ball);
      }
    }
    g.position.copy(pos);
    const p: Pickup = {
      id: this.nextId++, item, bells, mesh: g,
      vel: toss ? new THREE.Vector3((Math.random() - 0.5) * 4, 4.5, (Math.random() - 0.5) * 4) : new THREE.Vector3(),
      grounded: !toss, bobT: Math.random() * 6,
    };
    this.group.add(g);
    this.pickups.push(p);
    return p;
  }
  removePickup(p: Pickup) {
    this.group.remove(p.mesh);
    this.pickups = this.pickups.filter(x => x.id !== p.id);
  }

  // ---------- 树交互 ----------
  shakeTree(tree: Tree): number {
    tree.shakeT = 0.6;
    let dropped = 0;
    const gy = tree.gy;
    while (tree.fruits.length > 0) {
      const wp = this.pickFruit(tree);
      if (!wp) break;
      const mesh = this.makeFruitMesh(tree.fruitId);
      mesh.position.copy(wp);
      this.group.add(mesh);
      this.falling.push({ mesh, vy: 0, item: tree.fruitId, groundY: gy });
      dropped++;
    }
    if (dropped > 0) tree.regrowT = 150; // 150秒后重新结果
    return dropped;
  }

  plantSapling(x: number, z: number, fruit?: string) {
    const g = new THREE.Group();
    const stemMat = new THREE.MeshLambertMaterial({ color: 0x3e8e3a });
    g.add(box(0.15, 0.9, 0.15, stemMat, 0, 0.45, 0));
    g.add(box(0.6, 0.4, 0.6, this.leafMat, 0, 1, 0));
    g.position.set(x, groundHeight(x, z), z);
    this.group.add(g);
    this.saplings.push({ x, z, group: g, growT: 75, fruit });
  }

  // 吃饱后用铲子把整棵树铲起（树从世界移除，等待重新移栽）
  removeTree(t: Tree) {
    const i = this.trees.indexOf(t);
    if (i < 0) return;
    this.trees.splice(i, 1);
    this.freeTree(t); // 释放实例槽
    const ci = this.colliders.findIndex(c => c.x === t.x && c.z === t.z && c.r === 0.85);
    if (ci >= 0) this.colliders.splice(ci, 1);
  }

  // ---------- 帧更新 ----------
  private waterT = 0;
  // decoSkip：VR 保帧率时隔帧跳过纯装饰动画（花瓣/萤火虫），物理与交互不受影响
  update(dt: number, _time24: number, isNight: boolean, now: number, decoSkip = false) {
    // 水面流动
    this.waterT += dt * 0.02;
    (this.water.material as THREE.MeshLambertMaterial).map!.offset.set(this.waterT, this.waterT * 0.6);

    // ---- 树实例视锥体裁剪（VR 保帧率核心：减少 GPU vertex shader 调用） ----
    // 外部设置 this.camera 后启用；Three.js instanceFrustumCulled 自动生效（render 时剔除）
    if (this.camera) {
      this.camera.updateMatrixWorld(true);
      this._projScreenMatrix.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
      this._frustum.setFromProjectionMatrix(this._projScreenMatrix);

      // 筛选可见树（树冠半径 ≈ 3m，用 4m 球体）
      const visible: Tree[] = [];
      for (const t of this.trees) {
        this._sphere.set(new THREE.Vector3(t.x, t.gy + t.trunkH * 0.6, t.z), 4);
        if (this._frustum.intersectsSphere(this._sphere)) visible.push(t);
      }

      if (visible.length < this.trees.length) {
        // 保存原始 instSlot 后再重排，确保所有共享 InstancedMesh 一致性
        const origSlots = visible.map(t => t.instSlot);
        const tmp = this.imM;

        // trunkI：可见实例搬到数组前部
        for (let i = 0; i < visible.length; i++) {
          const src = origSlots[i];
          if (src !== i) { this.trunkI.getMatrixAt(src, tmp); this.trunkI.setMatrixAt(i, tmp); }
          visible[i].instSlot = i;
        }
        this.trunkI.count = visible.length;
        this.trunkI.instanceMatrix.needsUpdate = true;

        // leafI[0..3]：同步重排
        for (const l of this.leafI) {
          for (let i = 0; i < visible.length; i++) {
            const src = origSlots[i];
            if (src !== i) { l.getMatrixAt(src, tmp); l.setMatrixAt(i, tmp); }
          }
          l.count = visible.length;
          l.instanceMatrix.needsUpdate = true;
        }
      }
    }

    // 树摇摆 & 结果（实例矩阵更新）
    for (const t of this.trees) {
      if (t.shakeT > 0) {
        t.shakeT -= dt;
        if (t.shakeT <= 0) {
          this.writeTreeInstances(t); // 回正
        } else {
          this.writeTreeInstances(t, Math.sin(t.shakeT * 40) * 0.07 * t.shakeT, Math.cos(t.shakeT * 34) * 0.05 * t.shakeT);
        }
      }
      if (t.fruits.length === 0 && t.regrowT > 0) {
        t.regrowT -= dt;
        if (t.regrowT <= 0) this.growFruits(t);
      }
    }
    // 果实下落
    for (const f of [...this.falling]) {
      f.vy -= dt * 14;
      f.mesh.position.y += f.vy * dt;
      if (f.mesh.position.y <= f.groundY + 0.25) {
        this.group.remove(f.mesh);
        this.falling.splice(this.falling.indexOf(f), 1);
        const pos = f.mesh.position.clone();
        pos.y = f.groundY + 0.3;
        pos.x += (Math.random() - 0.5) * 1.6;
        pos.z += (Math.random() - 0.5) * 1.6;
        this.addPickup(f.item, pos, undefined, false);
      }
    }
    // 树苗成长
    for (const s of [...this.saplings]) {
      s.growT -= dt;
      const sc = 1 + (75 - s.growT) / 75;
      s.group.scale.setScalar(Math.min(1.6, sc));
      if (s.growT <= 0) {
        this.group.remove(s.group);
        this.saplings.splice(this.saplings.indexOf(s), 1);
        const fruit = s.fruit ?? FRUIT_IDS[Math.floor(Math.random() * FRUIT_IDS.length)]; // 移栽的果树苗保持原品种
        const tree = new Tree(s.x, s.z, fruit, this.leafMat, this.trunkMat);
        this.trees.push(tree);
        this.registerTree(tree); // 实例化渲染注册
        this.colliders.push({ x: s.x, z: s.z, r: 0.85 });
      }
    }
    // 虫
    for (const b of [...this.bugs]) {
      b.update(dt);
      if (b.fleeT < -2) this.removeBug(b);
    }
    // 篝火火焰闪烁
    if (this.bonfireFlames.length) {
      const t = now / 1000;
      this.bonfireFlames.forEach((f, i) => {
        const s = 1 + Math.sin(t * (6 + i * 1.7) + i * 2.1) * 0.12;
        f.scale.set(s, 1 + Math.sin(t * (7 + i) + i) * 0.18, s);
      });
      if (this.bonfireLight) this.bonfireLight.intensity = 2.2 + Math.sin(t * 8) * 0.4;
    }
    // 鱼
    for (const f of this.fishes) f.update(dt, f === this.lureFish ? this.lurePos : null);
    // 掉落物
    for (const p of this.pickups) {
      if (!p.grounded) {
        p.vel.y -= dt * 12;
        p.mesh.position.addScaledVector(p.vel, dt);
        const gy = groundHeight(p.mesh.position.x, p.mesh.position.z) + 0.35;
        if (p.mesh.position.y <= gy) { p.mesh.position.y = gy; p.grounded = true; }
      } else {
        p.bobT += dt;
        const gy = groundHeight(p.mesh.position.x, p.mesh.position.z) + 0.35;
        p.mesh.position.y = gy + Math.sin(p.bobT * 3) * 0.08;
        p.mesh.rotation.y += dt * 1.5;
      }
    }
    // 日夜氛围
    const nightF = isNight ? 1 : 0;
    (this.stars.material as THREE.PointsMaterial).opacity = nightF * 0.9;
    (this.moon.material as THREE.SpriteMaterial).opacity = nightF;
    this.moonLight.intensity = nightF * 0.4;
    (this.fireflies.material as THREE.PointsMaterial).opacity = nightF;
    for (const l of this.lamps) l.intensity = nightF * 2.4;
    for (const pm of this.lampPools) pm.opacity = nightF * 0.45;
    for (const b of this.lampBulbs) b.emissive.set(isNight ? 0xffd9a0 : 0x000000);
    // 花瓣飘落（纯装饰，VR 保帧率时隔帧跳过；跳过的帧用双倍 dt 补偿节奏）
    if (!decoSkip) {
      const pp = this.petals.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pp.count; i++) {
        let y = pp.getY(i) - dt * 0.5;
        let x = pp.getX(i) + Math.sin(now * 0.001 + i) * dt * 0.6;
        if (y < 0.3) { y = 6 + Math.random() * 5; x = (Math.random() - 0.5) * 220; pp.setZ(i, (Math.random() - 0.5) * 220); }
        pp.setY(i, y); pp.setX(i, x);
      }
      pp.needsUpdate = true;
    }
    // 萤火虫漂移
    if (isNight && !decoSkip) {
      const fp = this.fireflies.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < fp.count; i++) {
        fp.setX(i, fp.getX(i) + Math.sin(now * 0.0007 + i * 2) * dt * 0.8);
        fp.setY(i, fp.getY(i) + Math.cos(now * 0.0011 + i * 3) * dt * 0.4);
      }
      fp.needsUpdate = true;
    }
    void now;
  }
}

function fruitColor(id: string): number {
  return id === 'apple' ? 0xe2453b : id === 'cherry' ? 0xc2185b : id === 'orange' ? 0xf28c28 : 0xf7b8a0;
}
