// 房屋室内场景：SVG 地板/墙纸 + 盒体家具，房间宽敞（16×11），对标原版动森室内
import * as THREE from 'three';
import type { InteriorStyle, FurnitureItem } from './villagers';
import { itemSvgTexture } from './itemsvg';

export const ROOM_W = 16;   // x 方向
export const ROOM_D = 11;   // z 方向
const WALL_H = 4.2;

function svgTexture(svg: string, repeatX: number, repeatY: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.magFilter = THREE.NearestFilter;
  const img = new Image();
  img.onload = () => { ctx.drawImage(img, 0, 0, 256, 256); tex.needsUpdate = true; };
  img.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  // 同步先铺底色，避免解码前黑屏
  ctx.fillStyle = '#cbb98f'; ctx.fillRect(0, 0, 256, 256);
  return tex;
}

function box(w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

function lam(color: string | number) { return new THREE.MeshLambertMaterial({ color }); }

// 单件家具（局部坐标，返回组与碰撞半径）
export function buildFurniture(f: FurnitureItem): { g: THREE.Group; r: number } {
  const g = new THREE.Group();
  const c1 = f.color ?? '#b8804a';
  const c2 = f.color2 ?? '#f7f0e0';
  let r = 1;
  switch (f.kind) {
    case 'bed': {
      const w = f.w ?? 3, d = f.d ?? 2.2;
      g.add(box(w, 0.5, d, lam(c1), 0, 0.25, 0));                       // 床架
      g.add(box(w - 0.3, 0.3, d - 0.3, lam('#ffffff'), 0, 0.62, 0));    // 床垫
      g.add(box(w - 0.3, 0.28, d * 0.55, lam(c2), 0, 0.78, d * 0.16));  // 被子
      g.add(box(w - 0.7, 0.22, 0.6, lam(c2), 0, 0.78, -d / 2 + 0.45)); // 枕头（横放在床头一端）
      g.add(box(w, 0.9, 0.15, lam(c1), 0, 0.45, -d / 2));               // 床头板
      r = Math.max(w, d) / 2;
      break;
    }
    case 'table': {
      g.add(box(1.8, 0.14, 1.2, lam(c1), 0, 0.95, 0));
      for (const [sx, sz] of [[-0.7, -0.4], [0.7, -0.4], [-0.7, 0.4], [0.7, 0.4]])
        g.add(box(0.14, 0.95, 0.14, lam(c1), sx, 0.48, sz));
      g.add(box(0.7, 0.1, 0.5, lam(c2), 0, 1.07, 0)); // 桌布/摆件
      r = 1;
      break;
    }
    case 'chair': {
      g.add(box(0.9, 0.12, 0.9, lam(c1), 0, 0.55, 0));
      g.add(box(0.9, 0.9, 0.12, lam(c1), 0, 1, -0.4));
      for (const [sx, sz] of [[-0.35, -0.35], [0.35, -0.35], [-0.35, 0.35], [0.35, 0.35]])
        g.add(box(0.1, 0.55, 0.1, lam(c1), sx, 0.28, sz));
      r = 0.55;
      break;
    }
    case 'rug': {
      const w = f.w ?? 4, d = f.d ?? 3;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), lam(c1));
      m.rotation.x = -Math.PI / 2; m.position.y = 0.03; m.receiveShadow = true;
      g.add(m);
      const inner = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.6, d - 0.6), lam(c2 === '#f7f0e0' ? c1 : c2));
      inner.rotation.x = -Math.PI / 2; inner.position.y = 0.045; inner.receiveShadow = true;
      g.add(inner);
      r = 0; // 地毯可踩
      break;
    }
    case 'lamp': {
      g.add(box(0.5, 0.12, 0.5, lam('#8a6a45'), 0, 0.06, 0));
      g.add(box(0.12, 1.3, 0.12, lam('#8a6a45'), 0, 0.75, 0));
      const shade = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.6, 4), lam(c1));
      shade.position.y = 1.7; shade.rotation.y = Math.PI / 4;
      g.add(shade);
      const light = new THREE.PointLight(0xffd9a0, 0.9, 7);
      light.position.y = 1.9;
      g.add(light);
      r = 0.4;
      break;
    }
    case 'plant': {
      g.add(box(0.6, 0.5, 0.6, lam('#b5673a'), 0, 0.25, 0)); // 花盆
      g.add(box(0.16, 0.8, 0.16, lam('#3e6e2a'), 0, 0.8, 0));
      g.add(box(0.8, 0.7, 0.8, lam(c1), 0, 1.4, 0));
      g.add(box(0.5, 0.4, 0.5, lam(c1), 0.3, 1.9, 0.2));
      r = 0.45;
      break;
    }
    case 'shelf': {
      g.add(box(2, 2.2, 0.5, lam(c1), 0, 1.1, 0));
      for (const y of [0.7, 1.3, 1.9]) g.add(box(1.8, 0.08, 0.46, lam('#8a6a45'), 0, y, 0.03));
      r = 0.8;
      break;
    }
    case 'dresser': {
      g.add(box(1.6, 1.6, 0.8, lam(c1), 0, 0.8, 0));
      for (const y of [0.5, 1.05]) {
        g.add(box(1.4, 0.42, 0.06, lam(c2), 0, y, 0.41));
        g.add(box(0.3, 0.06, 0.06, lam('#6e5335'), 0, y, 0.45));
      }
      r = 0.8;
      break;
    }
    case 'sofa': {
      g.add(box(2.4, 0.5, 1.1, lam(c1), 0, 0.3, 0));
      g.add(box(2.4, 0.8, 0.3, lam(c1), 0, 0.75, -0.4));
      g.add(box(0.3, 0.65, 1.1, lam(c1), -1.05, 0.6, 0));
      g.add(box(0.3, 0.65, 1.1, lam(c1), 1.05, 0.6, 0));
      g.add(box(1, 0.3, 0.5, lam(c2), -0.5, 0.68, 0.1));
      g.add(box(1, 0.3, 0.5, lam(c2), 0.55, 0.68, 0.1));
      r = 1.2;
      break;
    }
    case 'decor': {
      const w = f.w ?? 0.9;
      g.add(box(w, 0.8, w, lam(c1), 0, 0.4, 0)); // 展示台
      if (f.item) {
        // 物品 SVG 图（鱼/虫/化石/商品各不同）
        const t = itemSvgTexture(f.item, f.shape, f.c1, f.c2);
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }));
        sp.scale.setScalar(1.2); sp.position.y = 1.55;
        g.add(sp);
      } else if (f.emoji) {
        const c = document.createElement('canvas');
        c.width = c.height = 64;
        const ctx = c.getContext('2d')!;
        ctx.font = '50px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(f.emoji, 32, 36);
        const t = new THREE.CanvasTexture(c);
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }));
        sp.scale.setScalar(1.1); sp.position.y = 1.5;
        g.add(sp);
      }
      r = 0.5;
      break;
    }
  }
  g.position.set(f.x, 0, f.z);
  if (f.rotY) g.rotation.y = f.rotY;
  return { g, r };
}

export class Interior {
  group = new THREE.Group();
  colliders: { x: number; z: number; r: number }[] = [];
  doorPos = new THREE.Vector3(0, 0, ROOM_D / 2 - 1.2); // 出口脚垫
  name = '';

  build(style: InteriorStyle, name: string) {
    this.name = name;
    // 清空旧场景
    this.group.clear();
    this.colliders = [];

    // 地板（SVG 平铺）
    const floorTex = svgTexture(style.floorSvg, ROOM_W / 2, ROOM_D / 2);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(ROOM_W, ROOM_D),
      new THREE.MeshLambertMaterial({ map: floorTex }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.group.add(floor);

    // 墙纸
    const wallTex = svgTexture(style.wallSvg, ROOM_W / 2.4, 1);
    const wallTexS = svgTexture(style.wallSvg, ROOM_D / 2.4, 1);
    const mkWall = (w: number, tex: THREE.Texture, x: number, z: number, ry: number) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, WALL_H), new THREE.MeshLambertMaterial({ map: tex }));
      m.position.set(x, WALL_H / 2, z);
      m.rotation.y = ry;
      m.receiveShadow = true;
      this.group.add(m);
      // 踢脚线
      const base = box(w, 0.24, 0.08, lam('#8a6a45'), x, 0.12, z);
      base.rotation.y = ry;
      this.group.add(base);
    };
    mkWall(ROOM_W, wallTex, 0, -ROOM_D / 2, 0);                    // 后墙
    mkWall(ROOM_D, wallTexS, -ROOM_W / 2, 0, Math.PI / 2);         // 左墙
    mkWall(ROOM_D, wallTexS, ROOM_W / 2, 0, -Math.PI / 2);         // 右墙
    // 前墙（带门洞的两段）
    const doorW = 2;
    for (const s of [-1, 1]) {
      const w = (ROOM_W - doorW) / 2;
      const x = s * (doorW / 2 + w / 2);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, WALL_H), new THREE.MeshLambertMaterial({ map: wallTex }));
      m.position.set(x, WALL_H / 2, ROOM_D / 2);
      m.rotation.y = Math.PI;
      this.group.add(m);
    }
    // 门框 + 门
    const frameMat = lam('#8a6a45');
    this.group.add(box(0.18, 2.6, 0.18, frameMat, -doorW / 2, 1.3, ROOM_D / 2));
    this.group.add(box(0.18, 2.6, 0.18, frameMat, doorW / 2, 1.3, ROOM_D / 2));
    this.group.add(box(doorW + 0.36, 0.18, 0.18, frameMat, 0, 2.68, ROOM_D / 2));
    // 门楣墙（门洞上方补满，不再是空的）
    const lintel = new THREE.Mesh(new THREE.PlaneGeometry(doorW, WALL_H - 2.7), new THREE.MeshLambertMaterial({ map: wallTex }));
    lintel.position.set(0, 2.7 + (WALL_H - 2.7) / 2, ROOM_D / 2);
    lintel.rotation.y = Math.PI;
    this.group.add(lintel);
    // 出口脚垫
    const mat2 = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1), lam('#c96a5a'));
    mat2.rotation.x = -Math.PI / 2;
    mat2.position.set(0, 0.06, ROOM_D / 2 - 0.9);
    this.group.add(mat2);

    // 天花板氛围光（无影灯，室内始终明亮柔和，夜里也像开了灯）
    const ceil = new THREE.PointLight(0xfff2dd, 1.5, 30);
    ceil.position.set(0, WALL_H - 0.4, 0);
    this.group.add(ceil);
    const fill = new THREE.PointLight(0xffe8c8, 0.7, 20);
    fill.position.set(0, 1.6, 2);
    this.group.add(fill);

    // 家具
    for (const f of style.furniture) {
      const { g, r } = buildFurniture(f);
      this.group.add(g);
      if (r > 0) this.colliders.push({ x: f.x, z: f.z, r });
    }

    // 墙体边界作为碰撞（留 0.7 边距）
    // 由 game 统一按房间矩形钳制，这里不加碰撞体
  }
}
