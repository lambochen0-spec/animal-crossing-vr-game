// 皮丘（Pichu）：电力还不稳定的迷你电气鼠
import type { VillagerProfile } from '../types';
import { floorChecker, wallDots } from '../svg';

export const profile: VillagerProfile = {
  id: 'pichu',
  def: {
    name: '皮丘', height: 0.3, species: '小鼠宝可梦', color: 0xf7e08c, belly: 0xfff7d0, earType: 'pikachu', earColor: 0x26262e,
    catchphrase: '皮丘', likes: ["apple"],
    lines: ["皮丘皮丘！我的电气袋还小，电多了会把自己电麻……", "别看我小，总有一天我会变成厉害的皮卡丘皮丘！", "脸蛋痒痒的，那是电力在储存皮丘！", "一起玩捉迷藏吧！我躲起来可快可快了皮丘！"],
  },
  home: { x: 0, z: 0 },
  spawn: { x: 0, z: 0 },
  house: { wall: '#fff3c4', roofA: '#e8c84a', roofB: '#d4b43e', door: '#8a6a2f', accent: '#f2de8a' },
  interior: {
    floorSvg: floorChecker('#fff8e0', '#f2e4b0'),
    wallSvg: wallDots('#fff6d8', '#e8d48a'),
    furniture: [
      { kind: 'bed', x: -5.6, z: -3.4, color: '#e8c84a', color2: '#fff7d0' },
      { kind: 'rug', x: 0, z: 0.8, color: '#e8c84a', w: 4.4, d: 3 },
      { kind: 'decor', x: 6.8, z: -3.4, emoji: '⚡', color: '#ffffff' },
      { kind: 'decor', x: 6.9, z: 0.8, emoji: '🧸', color: '#ffffff' },
      { kind: 'table', x: 2.6, z: -3.6, color: '#e8c84a', color2: '#ffffff' },
      { kind: 'chair', x: 2.6, z: -2.2, color: '#e8c84a', rotY: Math.PI },
      { kind: 'sofa', x: 6, z: 2.2, color: '#fff7d0', color2: '#ffffff', rotY: -Math.PI / 2 },
      { kind: 'dresser', x: -7, z: 1.8, color: '#e8c84a', rotY: Math.PI / 2 },
      { kind: 'lamp', x: -3.4, z: -4.6, color: '#fff4d8' },
    ],
  },
};
