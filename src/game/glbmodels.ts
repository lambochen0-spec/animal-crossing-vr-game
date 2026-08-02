// 外部 GLB 模型管线：Quaternius/Kenney CC0 低模物品（水果/鱼/料理）
// 统一处理：材质扁平化(Standard→Lambert)、纹理降采样(>512 缩到 512)、归一化(最长边≈0.5)
// 用法：游戏启动时 void glbmodels.preloadAll(); 之后 getModel(itemId) 同步取克隆。

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// itemId → GLB 文件（public/models/ 下，运行时用根相对路径访问）
const MODEL_FILES: Record<string, string> = {
  apple: 'models/fruit_apple.glb',
  cherry: 'models/fruit_cherry.glb',
  orange: 'models/fruit_orange.glb',
  peach: 'models/fruit_apple.glb', // 桃桃果：复用苹果 GLB，靠 getModel 的 per-item 色调改色区分
  crucian: 'models/fish_1.glb',
  carp: 'models/fish_2.glb',
  bass: 'models/fish_3.glb',
  koi: 'models/fish_4.glb',
  u_cookie: 'models/food_cookie.glb',
  u_cake: 'models/food_cake.glb',
  u_bento: 'models/food_bento.glb',
};

// 贴图缺失时的兜底主色（与 data.ts / shopgoods.ts 的物品主色一致）。
// 仅当 GLB 声明了 baseColorTexture 但贴图加载失败时使用；补上贴图后自动恢复原贴图。
const FALLBACK_COLORS: Record<string, number> = {
  apple: 0xe2453b,
  cherry: 0xc2185b,
  orange: 0xf28c28,
  u_cookie: 0xc9855a,
  u_cake: 0xf2a8c0,
  u_bento: 0x5ab88a,
};

// 复用其他 GLB 时的 per-item 色调（getModel 返回克隆后对材质 color 做替换，peach → 粉橙）
// 只作用于该 itemId 的克隆：克隆前先复制材质，避免污染缓存里共享的材质对象，不影响 apple 等原模型
const TINT_COLORS: Record<string, number> = {
  peach: 0xffa8c8,
};

// 已加载的原始 scene（已处理：Lambert 材质 / 降采样 / 归一化），getModel 每次返回克隆
const cache = new Map<string, THREE.Group>();

// 预加载去重队列（正在加载 / 已加载的 itemId）
export const preloadQueue = new Set<string>();

// ---------- 材质扁平化：MeshStandardMaterial/Physical → MeshLambertMaterial ----------
// 场景是 Lambert 光照，PBR 材质会偏暗发灰；保留 map/color/emissive/透明/side。
function flattenMaterial(m: THREE.Material): THREE.Material {
  if ((m as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
    const sm = m as THREE.MeshStandardMaterial;
    const lam = new THREE.MeshLambertMaterial({
      map: sm.map,
      color: sm.color,
      emissive: sm.emissive,
      emissiveIntensity: sm.emissiveIntensity,
      transparent: sm.transparent,
      opacity: sm.opacity,
      side: sm.side,
    });
    m.dispose();
    return lam;
  }
  return m;
}

// ---------- 纹理降采样：>512 的贴图缩到最长边 512（VR 性能） ----------
const TEX_SLOTS = [
  'map', 'emissiveMap', 'alphaMap', 'bumpMap', 'normalMap', 'specularMap', 'aoMap', 'displacementMap',
] as const;
const downscaledTex = new Map<THREE.Texture, THREE.Texture>(); // 共享纹理只重建一次

function rebuildTexture(tex: THREE.Texture): THREE.Texture | null {
  const img = tex.image as HTMLImageElement | HTMLCanvasElement | ImageBitmap | undefined;
  if (!img) return null;
  const w = (img as HTMLImageElement).naturalWidth || (img as HTMLCanvasElement).width || (img as ImageBitmap).width || 0;
  const h = (img as HTMLImageElement).naturalHeight || (img as HTMLCanvasElement).height || (img as ImageBitmap).height || 0;
  if (!w || !h) return null;
  if (Math.max(w, h) <= 512) return null;
  const s = 512 / Math.max(w, h);
  const cw = Math.max(1, Math.round(w * s));
  const ch = Math.max(1, Math.round(h * s));
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(img as CanvasImageSource, 0, 0, cw, ch);
  const nt = new THREE.CanvasTexture(canvas);
  nt.wrapS = tex.wrapS;
  nt.wrapT = tex.wrapT;
  nt.minFilter = THREE.LinearMipmapLinearFilter;
  nt.magFilter = THREE.LinearFilter;
  nt.generateMipmaps = true;
  nt.colorSpace = tex.colorSpace;
  nt.flipY = tex.flipY;
  nt.name = tex.name;
  nt.needsUpdate = true;
  return nt;
}

function ensureDownscaled(tex: THREE.Texture): THREE.Texture {
  const hit = downscaledTex.get(tex);
  if (hit) return hit;
  const nt = rebuildTexture(tex);
  if (nt) {
    downscaledTex.set(tex, nt);
    tex.dispose();
    return nt;
  }
  return tex;
}

// ---------- 归一化：最长边 ≈ 0.5；内容水平居中、底面贴原点（掉落/摆放都是"放地上"的小物件） ----------
function normalizeModel(scene: THREE.Group): void {
  const bb = new THREE.Box3().setFromObject(scene);
  if (bb.isEmpty()) return;
  const size = bb.getSize(new THREE.Vector3());
  const longest = Math.max(size.x, size.y, size.z);
  if (longest > 0 && Math.abs(longest - 0.5) > 1e-4) scene.scale.setScalar(0.5 / longest);
  const bb2 = new THREE.Box3().setFromObject(scene);
  const c = bb2.getCenter(new THREE.Vector3());
  // 替换 GLB 自带根变换为内容对齐偏移（getModel 的外层 Group 保证调用方看到的 position 归零）
  scene.position.set(-c.x, -bb2.min.y, -c.z);
}

// ---------- 加载单个模型并处理 ----------
async function loadOne(itemId: string, url: string): Promise<THREE.Group> {
  const failedTex = new Set<string>();
  const manager = new THREE.LoadingManager();
  manager.onError = (u) => { failedTex.add(u); };
  const loader = new GLTFLoader(manager);
  const gltf = await loader.loadAsync(url);
  const scene = gltf.scene;

  // 该文件是否声明了 baseColorTexture（贴图缺失时据此决定是否兜底上色）
  const json: any = gltf.parser?.json;
  const fileWantedTex = !!json?.materials?.some((m: any) => m?.pbrMetallicRoughness?.baseColorTexture);
  const texFailed = failedTex.size > 0;
  const fallback = FALLBACK_COLORS[itemId];

  scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (let i = 0; i < mats.length; i++) {
      let m = mats[i];
      if ((m as THREE.MeshStandardMaterial).isMeshStandardMaterial) m = flattenMaterial(m);
      // 降采样对所有材质生效（含 MeshBasicMaterial 等）
      const mm = m as unknown as Record<string, unknown>;
      for (const slot of TEX_SLOTS) {
        const t = mm[slot];
        if (t instanceof THREE.Texture) mm[slot] = ensureDownscaled(t);
      }
      // 贴图加载失败：用游戏内物品主色兜底，避免渲染成白色
      if (texFailed && fileWantedTex && fallback !== undefined && m instanceof THREE.MeshLambertMaterial && !m.map) {
        m.color.set(fallback);
      }
      mats[i] = m;
    }
    if (Array.isArray(mesh.material)) mesh.material = mats; else mesh.material = mats[0];
  });

  normalizeModel(scene);
  return scene;
}

// ---------- 对外 API ----------
/** 预加载全部 GLB（并行）；单个失败 console.warn 不抛错、不阻塞 */
export async function preloadAll(): Promise<void> {
  await Promise.all(Object.keys(MODEL_FILES).map((id) => preload(id)));
}

async function preload(itemId: string): Promise<void> {
  if (preloadQueue.has(itemId)) return;
  preloadQueue.add(itemId);
  try {
    const scene = await loadOne(itemId, MODEL_FILES[itemId]);
    cache.set(itemId, scene);
  } catch (e) {
    console.warn('[glbmodels] 模型加载失败:', itemId, MODEL_FILES[itemId], e);
    preloadQueue.delete(itemId); // 失败不缓存，允许重试
  }
}

// 对克隆组的所有材质替换颜色（用于"复用 GLB + 改色"的物品，如 peach 用苹果模型改粉橙）
// 注意：scene.clone() 默认共享材质，直接改 color 会污染缓存的共享材质，所以先 clone 材质再改
function applyTint(g: THREE.Group, color: number): void {
  g.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material.slice() : [mesh.material];
    for (let i = 0; i < mats.length; i++) {
      const m = mats[i] as (THREE.Material & { color?: THREE.Color });
      if (m?.color) {
        mats[i] = m.clone();
        const cm = mats[i] as THREE.MeshLambertMaterial;
        cm.color.set(color);
        cm.map = null;        // 去掉 GLB 原贴图：color × map 会把改色完全盖住（如苹果贴图盖住桃桃果粉红）
        cm.needsUpdate = true;
      }
    }
    if (Array.isArray(mesh.material)) mesh.material = mats; else mesh.material = mats[0];
  });
}

/** 同步返回该物品模型的克隆（外层新 Group，position/scale/rotation 归零，可自由改）；未加载返回 null */
export function getModel(itemId: string): THREE.Group | null {
  const scene = cache.get(itemId);
  if (!scene) return null;
  const g = new THREE.Group();
  g.add(scene.clone());
  const tint = TINT_COLORS[itemId];
  if (tint !== undefined) applyTint(g, tint);
  return g;
}
