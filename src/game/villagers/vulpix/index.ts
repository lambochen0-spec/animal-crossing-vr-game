// 六尾（Vulpix）：六条尾巴的小狐狸
import type { VillagerProfile } from '../types';
import { floorPlanks, wallDots } from '../svg';

export const profile: VillagerProfile = {
  id: 'vulpix',
  def: {
    name: '六尾', height: 0.6, species: '狐狸宝可梦', color: 0xc86a3a, belly: 0xf7d8a8, earType: 'eevee',
    catchphrase: '六六', likes: ["cherry"],
    lines: ["我的六条尾巴，每一条的卷法都不一样哦六六！", "刚出生的时候尾巴只有一条，白得像雪一样六六！", "梳尾巴是我每天最重要的功课六六！", "冷的时候可以把脸埋进尾巴里，可暖和了六六！"],
  },
  home: { x: 0, z: 0 },
  spawn: { x: 0, z: 0 },
  house: { wall: '#fae8d8', roofA: '#b8542f', roofB: '#9a4426', door: '#6a3a2f', accent: '#e0a078' },
  interior: {
    floorSvg: floorPlanks('#e0c0a0', '#c0a080'),
    wallSvg: wallDots('#faeadd', '#d8906a'),
    furniture: [
      { kind: 'bed', x: -5.6, z: -3.4, color: '#b8542f', color2: '#f7d8a8' },
      { kind: 'rug', x: 0, z: 0.8, color: '#b8542f', w: 4.4, d: 3 },
      { kind: 'decor', x: 6.8, z: -3.4, emoji: '🦊', color: '#ffffff' },
      { kind: 'decor', x: 6.9, z: 0.8, emoji: '🍂', color: '#ffffff' },
      { kind: 'table', x: 2.6, z: -3.6, color: '#b8542f', color2: '#ffffff' },
      { kind: 'chair', x: 2.6, z: -2.2, color: '#b8542f', rotY: Math.PI },
      { kind: 'sofa', x: 6, z: 2.2, color: '#f7d8a8', color2: '#ffffff', rotY: -Math.PI / 2 },
      { kind: 'dresser', x: -7, z: 1.8, color: '#b8542f', rotY: Math.PI / 2 },
      { kind: 'lamp', x: -3.4, z: -4.6, color: '#fff4d8' },
    ],
  },
};
