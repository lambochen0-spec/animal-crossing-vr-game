// 火球鼠（Cyndaquil）：背上喷火的胆小鼠
import type { VillagerProfile } from '../types';
import { floorPlanks, wallFlames } from '../svg';

export const profile: VillagerProfile = {
  id: 'cyndaquil',
  def: {
    name: '火球鼠', height: 0.5, species: '火鼠宝可梦', color: 0x2f4858, belly: 0xf7ecc8, earType: 'dedenne',
    catchphrase: '火球', likes: ["apple"],
    lines: ["紧张的时候背上的火会突然喷出来，别吓我火球！", "我缩成一团的时候像不像一颗球火球？", "背上的火焰就是我的心情温度计火球！", "冷天最受欢迎了，大家都爱凑到我身边取暖火球！"],
  },
  home: { x: 0, z: 0 },
  spawn: { x: 0, z: 0 },
  house: { wall: '#f7ecd0', roofA: '#c85a3a', roofB: '#a8482f', door: '#2f4858', accent: '#e8b48a' },
  interior: {
    floorSvg: floorPlanks('#e8d0a8', '#c8b088'),
    wallSvg: wallFlames('#fae8d0', '#e8a06a'),
    furniture: [
      { kind: 'bed', x: -5.6, z: -3.4, color: '#c85a3a', color2: '#f7ecc8' },
      { kind: 'rug', x: 0, z: 0.8, color: '#c85a3a', w: 4.4, d: 3 },
      { kind: 'decor', x: 6.8, z: -3.4, emoji: '🔥', color: '#ffffff' },
      { kind: 'decor', x: 6.9, z: 0.8, emoji: '🕯️', color: '#ffffff' },
      { kind: 'table', x: 2.6, z: -3.6, color: '#c85a3a', color2: '#ffffff' },
      { kind: 'chair', x: 2.6, z: -2.2, color: '#c85a3a', rotY: Math.PI },
      { kind: 'sofa', x: 6, z: 2.2, color: '#f7ecc8', color2: '#ffffff', rotY: -Math.PI / 2 },
      { kind: 'dresser', x: -7, z: 1.8, color: '#c85a3a', rotY: Math.PI / 2 },
      { kind: 'lamp', x: -3.4, z: -4.6, color: '#fff4d8' },
    ],
  },
};
