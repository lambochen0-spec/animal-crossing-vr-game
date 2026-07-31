// 精灵球道具模型：替代原版动森的"叶子"——掉落/手持的通用物品都长这样
import * as THREE from 'three';
import * as glbmodels from './glbmodels';

function box(w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

export function makePokeBall(s = 1): THREE.Group {
  const g = new THREE.Group();
  const red = new THREE.MeshLambertMaterial({ color: 0xe84040 });
  const white = new THREE.MeshLambertMaterial({ color: 0xf5f5f5 });
  const black = new THREE.MeshLambertMaterial({ color: 0x2a2a2e });
  // 下半白 / 黑腰带 / 上半红（体素风）
  g.add(box(0.3, 0.16, 0.3, white, 0, 0.08, 0));
  g.add(box(0.34, 0.16, 0.34, white, 0, 0.14, 0));
  g.add(box(0.38, 0.07, 0.38, black, 0, 0.235, 0));
  g.add(box(0.34, 0.16, 0.34, red, 0, 0.34, 0));
  g.add(box(0.3, 0.14, 0.3, red, 0, 0.43, 0));
  // 正面按钮
  g.add(box(0.12, 0.12, 0.05, white, 0, 0.235, 0.19));
  g.add(box(0.06, 0.06, 0.05, black, 0, 0.235, 0.21));
  g.scale.setScalar(s);
  return g;
}

// 树果掉落形态：外部 GLB 优先，否则保持程序化水果（立体果 + 果梗 + 小叶）
export function makeFruitDrop(itemId: string, s = 1): THREE.Group {
  const ext = glbmodels.getModel(itemId);
  if (ext) {
    // GLB 已归一化到最长边 0.5，原方块水果 0.34 宽，取 0.55 系数视觉大小合适
    ext.scale.setScalar(s * 0.55);
    return ext;
  }
  const color = itemId === 'apple' ? 0xe2453b : itemId === 'cherry' ? 0xc2185b : itemId === 'orange' ? 0xf28c28 : 0xf7b8a0;
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color });
  g.add(box(0.34, 0.36, 0.34, mat, 0, 0.18, 0));
  g.add(box(0.22, 0.16, 0.22, mat, 0, 0.4, 0));
  g.add(box(0.08, 0.14, 0.08, new THREE.MeshLambertMaterial({ color: 0x5e4023 }), 0, 0.52, 0));
  g.add(box(0.18, 0.06, 0.12, new THREE.MeshLambertMaterial({ color: 0x3e8e3a }), 0.12, 0.52, 0));
  g.scale.setScalar(s);
  return g;
}

// 通用物品掉落/手持：外部 GLB 优先（鱼等），没有则 fallback 精灵球
export function makeItemDrop(itemId: string, s = 1): THREE.Group {
  const ext = glbmodels.getModel(itemId);
  if (ext) {
    ext.scale.setScalar(s);
    return ext;
  }
  return makePokeBall(s);
}
