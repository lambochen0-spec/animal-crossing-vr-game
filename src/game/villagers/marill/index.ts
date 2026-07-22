// 玛力露（Marill）：浮在水上的圆耳水鼠
import type { VillagerProfile } from '../types';
import { floorChecker, wallWaves } from '../svg';

export const profile: VillagerProfile = {
  id: 'marill',
  def: {
    name: '玛力露', height: 0.4, species: '水鼠宝可梦', color: 0x4a90d9, belly: 0xe8f4ff, earType: 'dedenne',
    catchphrase: '露露', likes: ["orange"],
    lines: ["尾巴的球球浮力可大了，我躺在水上都不会沉露露！", "今天河水暖暖的，最适合游泳了露露！", "耳朵圆圆的是不是很可爱？不许揪露露！", "雨天的水洼，每一个我都想跳进去露露！"],
  },
  home: { x: 0, z: 0 },
  spawn: { x: 0, z: 0 },
  house: { wall: '#dceeff', roofA: '#4a80c0', roofB: '#3e6ea8', door: '#2f5a8a', accent: '#8ab8e8' },
  interior: {
    floorSvg: floorChecker('#e8f4ff', '#b8d8f2'),
    wallSvg: wallWaves('#e0f0ff', '#7ab0e0'),
    furniture: [
      { kind: 'bed', x: -5.6, z: -3.4, color: '#4a80c0', color2: '#ffffff' },
      { kind: 'rug', x: 0, z: 0.8, color: '#4a80c0', w: 4.4, d: 3 },
      { kind: 'decor', x: 6.8, z: -3.4, emoji: '🫧', color: '#ffffff' },
      { kind: 'decor', x: 6.9, z: 0.8, emoji: '⛱️', color: '#ffffff' },
      { kind: 'table', x: 2.6, z: -3.6, color: '#4a80c0', color2: '#ffffff' },
      { kind: 'chair', x: 2.6, z: -2.2, color: '#4a80c0', rotY: Math.PI },
      { kind: 'sofa', x: 6, z: 2.2, color: '#ffffff', color2: '#ffffff', rotY: -Math.PI / 2 },
      { kind: 'dresser', x: -7, z: 1.8, color: '#4a80c0', rotY: Math.PI / 2 },
      { kind: 'lamp', x: -3.4, z: -4.6, color: '#fff4d8' },
    ],
  },
};
