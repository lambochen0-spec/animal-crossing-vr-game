// 仙子伊布（Sylveon）：蝴蝶结缎带小屋，温柔优雅的治愈系
import type { VillagerProfile } from '../types';
import { floorChecker, wallHearts } from '../svg';

export const profile: VillagerProfile = {
  id: 'sylveon',
  def: {
    name: '仙子伊布', height: 1.0, species: '连结宝可梦', color: 0xf7f0f7, belly: 0x8ec3e8, earType: 'sylveon', catchphrase: '仙子',
    lines: [
      '仙子~ 你今天看起来心情不错呢，缎带都跟着轻飘飘的了！',
      '我把花园里的花重新搭配了颜色，下次来我家看看吧仙子！',
      '难过的时候就来找我，用缎带轻轻抱一下，烦恼就飞走啦！',
      '听说露营广场那边偶尔会有客人来，好想去打个招呼仙子~',
    ],
  },
  home: { x: 0, z: 0 },
  spawn: { x: 6, z: 6 },
  house: { wall: '#fdf0f5', roofA: '#e88ab8', roofB: '#d97aa8', door: '#b85a88', accent: '#8ec3e8' },
  interior: {
    floorSvg: floorChecker('#fdf2f7', '#f2d8e5'),
    wallSvg: wallHearts('#fdeef5', '#f0b8d0'),
    furniture: [
      { kind: 'bed', x: -5.6, z: -3.4, color: '#e88ab8', color2: '#fdf0f5' },
      { kind: 'rug', x: 0, z: 0.8, color: '#8ec3e8', w: 4.4, d: 3 },
      { kind: 'decor', x: 5.8, z: -3.2, emoji: '🎀', color: '#e88ab8' },
      { kind: 'table', x: 2.6, z: -3.6, color: '#e88ab8', color2: '#ffffff' },
      { kind: 'chair', x: 2.6, z: -2.2, color: '#8ec3e8', rotY: Math.PI },
      { kind: 'sofa', x: 6, z: 2.2, color: '#f2a8c8', color2: '#ffffff', rotY: -Math.PI / 2 },
      { kind: 'dresser', x: -7, z: 1.8, color: '#d97aa8', rotY: Math.PI / 2 },
      { kind: 'lamp', x: -3.4, z: -4.6, color: '#ffd9ec' },
      { kind: 'plant', x: 6.9, z: -3.6, color: '#e88ab8' },
    ],
  },
};
