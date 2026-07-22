// 呆火鳄（Fuecoco）：呆萌爱吃的火鳄歌手
import type { VillagerProfile } from '../types';
import { floorChecker, wallDots } from '../svg';

export const profile: VillagerProfile = {
  id: 'fuecoco',
  def: {
    name: '呆火鳄', height: 0.4, species: '火鳄宝可梦', color: 0xe85a4a, belly: 0xfff4e8, earType: 'charmander',
    catchphrase: '呆呆', likes: ["apple", "orange"],
    lines: ["嘿嘿……有好吃的吗呆呆？", "头顶的小火苗一晃一晃的，别盯着看，会害羞呆呆。", "唱歌是我的爱好，虽然经常忘词呆呆……", "晒太阳晒着晒着就睡着了，这是鳄鱼的本能呆呆！"],
  },
  home: { x: 0, z: 0 },
  spawn: { x: 0, z: 0 },
  house: { wall: '#fdeadd', roofA: '#c84838', roofB: '#a83a2e', door: '#6a4a3a', accent: '#f0a080' },
  interior: {
    floorSvg: floorChecker('#fdf0e4', '#f2ccb4'),
    wallSvg: wallDots('#fdece0', '#ee9a80'),
    furniture: [
      { kind: 'bed', x: -5.6, z: -3.4, color: '#c84838', color2: '#fff4e8' },
      { kind: 'rug', x: 0, z: 0.8, color: '#c84838', w: 4.4, d: 3 },
      { kind: 'decor', x: 6.8, z: -3.4, emoji: '🌶️', color: '#ffffff' },
      { kind: 'decor', x: 6.9, z: 0.8, emoji: '🎵', color: '#ffffff' },
      { kind: 'table', x: 2.6, z: -3.6, color: '#c84838', color2: '#ffffff' },
      { kind: 'chair', x: 2.6, z: -2.2, color: '#c84838', rotY: Math.PI },
      { kind: 'sofa', x: 6, z: 2.2, color: '#fff4e8', color2: '#ffffff', rotY: -Math.PI / 2 },
      { kind: 'dresser', x: -7, z: 1.8, color: '#c84838', rotY: Math.PI / 2 },
      { kind: 'lamp', x: -3.4, z: -4.6, color: '#fff4d8' },
    ],
  },
};
