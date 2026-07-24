// 商品/家具的 3D 实体模型：大家具复用室内的 buildFurniture，小物件用参数化小模型
import * as THREE from 'three';
import { buildFurniture } from './interiors';
import type { FurnitureItem } from './villagers/types';
import type { ShopGood } from './shopgoods';
import { SETS } from './series';

// 系列贴图缓存：系列 id → 家具表面 CanvasTexture
const setTexCache = new Map<string, THREE.CanvasTexture>();
function setTexture(setId: string): THREE.CanvasTexture | null {
  const def = SETS[setId];
  if (!def) return null;
  const hit = setTexCache.get(setId);
  if (hit) return hit;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = def.c1; ctx.fillRect(0, 0, 128, 128); // 解码前先铺主色
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  const img = new Image();
  img.onload = () => { ctx.drawImage(img, 0, 0, 128, 128); tex.needsUpdate = true; };
  img.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(def.patSvg);
  setTexCache.set(setId, tex);
  return tex;
}

// 把模型里主色（c1）的材质替换为系列贴图材质
function applySetTexture(model: THREE.Object3D, good: ShopGood) {
  if (!good.set) return;
  const tex = setTexture(good.set);
  if (!tex) return;
  const target = new THREE.Color(good.c1).getHex();
  const mat = new THREE.MeshLambertMaterial({ map: tex, color: '#ffffff' });
  model.traverse(o => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mm = m.material as THREE.MeshLambertMaterial;
    if (mm && mm.color && mm.color.getHex() === target && !mm.map) m.material = mat;
  });
}

function lam(color: string | number) {
  return new THREE.MeshLambertMaterial({ color: typeof color === 'string' ? new THREE.Color(color) : color });
}
function box(w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

// 大型造型 → 室内家具种类（有现成 3D 模型）
const KIND_MAP: Record<string, FurnitureItem['kind']> = {
  chair: 'chair', armchair: 'sofa', sofa: 'sofa', bed: 'bed',
  table: 'table', desk: 'table', rug: 'rug',
  lamp: 'lamp', floorlamp: 'lamp', plant: 'plant', vase: 'plant',
  shelf: 'shelf', bookcase: 'shelf', wardrobe: 'shelf',
  dresser: 'dresser', fridge: 'dresser', washing: 'dresser',
};

// 小型造型：手工参数化小模型（自然尺寸 0.4~0.9）
function buildSmall(shape: string, c1: string, c2: string): THREE.Group | null {
  const g = new THREE.Group();
  const m1 = lam(c1), m2 = lam(c2);
  switch (shape) {
    case 'stool': {
      g.add(box(0.7, 0.12, 0.7, m1, 0, 0.5, 0));
      for (const [sx, sz] of [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]])
        g.add(box(0.1, 0.5, 0.1, m2, sx, 0.25, sz));
      return g;
    }
    case 'cushion': {
      g.add(box(0.8, 0.28, 0.8, m1, 0, 0.14, 0));
      g.add(box(0.6, 0.1, 0.6, m2, 0, 0.3, 0));
      return g;
    }
    case 'tv': {
      g.add(box(0.9, 0.6, 0.08, lam('#22262e'), 0, 0.55, 0));           // 屏幕
      g.add(box(0.7, 0.42, 0.02, lam('#4aa3d8'), 0, 0.56, 0.05));       // 亮屏
      g.add(box(0.3, 0.16, 0.24, m1, 0, 0.16, 0));                      // 底座
      return g;
    }
    case 'radio': {
      g.add(box(0.7, 0.42, 0.3, m1, 0, 0.21, 0));
      g.add(box(0.24, 0.24, 0.04, m2, -0.14, 0.22, 0.16));              // 喇叭
      const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 10), lam('#333333'));
      knob.rotation.x = Math.PI / 2; knob.position.set(0.18, 0.2, 0.17);
      g.add(knob);
      g.add(box(0.03, 0.5, 0.03, lam('#888888'), 0.3, 0.65, 0));        // 天线
      return g;
    }
    case 'clock': {
      const face = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.08, 18), m1);
      face.rotation.x = Math.PI / 2; face.position.y = 0.5;
      g.add(face);
      const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.02, 18), lam('#ffffff'));
      dial.rotation.x = Math.PI / 2; dial.position.set(0, 0.5, 0.05);
      g.add(dial);
      g.add(box(0.03, 0.14, 0.02, lam('#333333'), 0, 0.54, 0.07));      // 时针
      g.add(box(0.1, 0.03, 0.02, lam('#333333'), 0.05, 0.5, 0.07));     // 分针
      g.add(box(0.4, 0.08, 0.12, m2, 0, 0.18, 0));                      // 底座
      return g;
    }
    case 'picture': {
      g.add(box(0.7, 0.55, 0.06, m1, 0, 0.55, 0));                      // 画框
      g.add(box(0.54, 0.4, 0.02, m2, 0, 0.55, 0.04));                   // 画面
      g.add(box(0.1, 0.34, 0.04, m1, 0, 0.17, -0.05));                  // 支架
      return g;
    }
    case 'fan': {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.1, 14), m2);
      base.position.y = 0.05; g.add(base);
      g.add(box(0.08, 0.6, 0.08, m2, 0, 0.4, 0));                       // 立杆
      for (let i = 0; i < 3; i++) {
        const blade = box(0.5, 0.12, 0.03, m1, 0, 0, 0);
        blade.position.set(Math.cos(i * Math.PI * 2 / 3) * 0.18, 0.78 + Math.sin(i * Math.PI * 2 / 3) * 0.18, 0);
        blade.rotation.z = i * Math.PI * 2 / 3;
        g.add(blade);
      }
      return g;
    }
    case 'umbrella': {
      const canopy = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.4, 8), m1);
      canopy.position.y = 1.0; g.add(canopy);
      g.add(box(0.05, 1.1, 0.05, m2, 0, 0.55, 0));                      // 伞杆
      return g;
    }
    case 'ball': {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 10), m1);
      s.position.y = 0.32; s.castShadow = true; g.add(s);
      const stripe = new THREE.Mesh(new THREE.SphereGeometry(0.325, 14, 6, 0, Math.PI * 2, Math.PI / 2 - 0.3, 0.6), m2);
      stripe.position.y = 0.32; g.add(stripe);
      return g;
    }
    case 'doll': {
      g.add(box(0.34, 0.4, 0.24, m1, 0, 0.2, 0));                       // 身体
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 9), m2);
      head.position.y = 0.58; head.castShadow = true; g.add(head);
      g.add(box(0.08, 0.22, 0.08, m2, -0.22, 0.3, 0));                  // 手臂
      g.add(box(0.08, 0.22, 0.08, m2, 0.22, 0.3, 0));
      return g;
    }
    case 'food': {
      const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.26, 0.06, 14), lam('#ffffff'));
      plate.position.y = 0.06; g.add(plate);
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), m1);
      dome.position.y = 0.16; dome.scale.y = 0.7; g.add(dome);
      g.add(box(0.08, 0.1, 0.08, m2, 0, 0.3, 0));                       // 点缀
      return g;
    }
    case 'drink': {
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.34, 12), m1);
      cup.position.y = 0.17; g.add(cup);
      g.add(box(0.04, 0.3, 0.04, m2, 0.06, 0.42, 0));                   // 吸管
      return g;
    }
    case 'seedling': {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.16, 0.26, 10), m2);
      pot.position.y = 0.13; g.add(pot);
      g.add(box(0.05, 0.3, 0.05, lam('#3e8e3a'), 0, 0.4, 0));           // 茎
      g.add(box(0.22, 0.06, 0.14, lam('#58b34a'), -0.1, 0.5, 0));       // 叶
      g.add(box(0.22, 0.06, 0.14, lam('#58b34a'), 0.1, 0.56, 0));
      return g;
    }
    case 'wallpaper': {
      // 一卷墙纸：斜放着的圆筒 + 展开垂下的一角
      const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.8, 12), m1);
      roll.position.set(0, 0.55, 0); roll.rotation.z = 0.28; roll.castShadow = true;
      g.add(roll);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.06, 12), m2);
      cap.position.set(-0.11, 0.94, 0); cap.rotation.z = 0.28;
      g.add(cap);
      g.add(box(0.3, 0.5, 0.03, m2, 0.16, 0.26, 0.1));                  // 垂下的纸边
      return g;
    }
    case 'flooring': {
      // 一叠地板样品砖
      for (let i = 0; i < 3; i++)
        g.add(box(0.7, 0.07, 0.7, i % 2 ? m1 : m2, i * 0.04 - 0.04, 0.05 + i * 0.08, i * -0.03));
      return g;
    }
    default:
      return null;
  }
}

// 商品 → 3D 模型（自然尺寸，未缩放；系列商品会贴上对应风格的 SVG 贴图）
export function modelForGood(good: ShopGood): THREE.Group {
  const kind = KIND_MAP[good.shape];
  if (kind) {
    const { g } = buildFurniture({ kind, x: 0, z: 0, color: good.c1, color2: good.c2 });
    applySetTexture(g, good);
    return g;
  }
  const small = buildSmall(good.shape, good.c1, good.c2);
  if (small) { applySetTexture(small, good); return small; }
  // 兜底：彩带礼盒（不再是「盒子+一张图」）
  const g = new THREE.Group();
  g.add(box(0.6, 0.5, 0.6, lam(good.c1), 0, 0.25, 0));
  g.add(box(0.64, 0.12, 0.64, lam(good.c2), 0, 0.52, 0));
  g.add(box(0.12, 0.56, 0.64, lam(good.c2), 0, 0.28, 0));
  return g;
}

// 适配摆放台：模型大于台面限制就整体缩小到能放下，小于则保持原尺寸
export function fitToStand(model: THREE.Group, maxW = 0.95, maxH = 1.2): number {
  const bb = new THREE.Box3().setFromObject(model);
  const size = bb.getSize(new THREE.Vector3());
  const w = Math.max(size.x, size.z);
  if (w > maxW || size.y > maxH) {
    const s = Math.min(maxW / w, maxH / size.y);
    model.scale.setScalar(s);
  }
  // 让模型底面贴在台面上
  const bb2 = new THREE.Box3().setFromObject(model);
  model.position.y -= bb2.min.y;
  const size2 = bb2.getSize(new THREE.Vector3());
  return Math.max(size2.x, size2.z) / 2 + 0.15; // 返回占用半径（碰撞用）
}

// 模型水平占地半径（玩家家中摆放时的碰撞用）
export function footprint(model: THREE.Group): number {
  const bb = new THREE.Box3().setFromObject(model);
  const size = bb.getSize(new THREE.Vector3());
  return Math.max(0.45, Math.max(size.x, size.z) / 2);
}
