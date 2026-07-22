// 杰尼龟（Squirtle）：清爽的海浪小屋
import type { VillagerProfile } from '../types';
import { floorPlanks, wallWaves } from '../svg';

export const profile: VillagerProfile = {
  id: 'squirtle',
  def: {
    name: '杰尼龟', height: 0.5, species: '小龟宝可梦', color: 0x6ab8e8, belly: 0xfff3c9, earType: 'squirtle', catchphrase: '杰尼',
    lines: [
      '杰尼杰尼！我的壳可是又硬又光滑，要摸摸看吗？',
      '河水冰冰凉凉的最舒服了，一起来游泳吧杰尼！',
      '遇到危险就把头缩进壳里，这是我的独门绝技杰尼！',
      '钓鱼抓虫这种事，看一遍就会了杰尼。',
    ],
  },
  home: { x: 44, z: -46 },
  spawn: { x: 38, z: -40 },
  house: { wall: '#dfeef5', roofA: '#5a9ac9', roofB: '#4f8ab5', door: '#3a6a9a', accent: '#7ab8e8' },
  interior: {
    floorSvg: floorPlanks('#e8d9a8', '#cbb887'),
    wallSvg: wallWaves('#d5ecf7', '#5a9ac9'),
    furniture: [
      { kind: 'bed', x: -5.6, z: -3.4, color: '#5a9ac9', color2: '#f7ecd0' },
      { kind: 'rug', x: 0, z: 0.8, color: '#7ab8e8', w: 4.4, d: 3 },
      { kind: 'decor', x: 6.9, z: -3.4, emoji: '🌊', color: '#5a9ac9' },
      { kind: 'decor', x: 6.8, z: 0.8, emoji: '🕶️', color: '#3a3a44' },   // 杰尼龟军团的墨镜
      { kind: 'table', x: 2.6, z: -3.6, color: '#7ab8e8', color2: '#ffffff' },
      { kind: 'chair', x: 2.6, z: -2.2, color: '#5a9ac9', rotY: Math.PI },
      { kind: 'sofa', x: 6, z: 2.2, color: '#7ab8e8', color2: '#f7ecd0', rotY: -Math.PI / 2 },
      { kind: 'dresser', x: -7, z: 1.8, color: '#5a9ac9', rotY: Math.PI / 2 },
      { kind: 'lamp', x: -3.4, z: -4.6, color: '#cfe8ff' },
    ],
  },
};
