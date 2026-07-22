// 耿鬼（Gengar）：紫色幽灵小屋，爱恶作剧但其实很讲义气
import type { VillagerProfile } from '../types';
import { floorChecker, wallStripes } from '../svg';

export const profile: VillagerProfile = {
  id: 'gengar',
  def: {
    name: '耿鬼', height: 1.5, species: '影子宝可梦', color: 0x7a5a9e, belly: 0x9a7abe, earType: 'gengar', catchphrase: '桀桀',
    lines: [
      '桀桀桀！刚才是不是被我吓到了？你的表情太有趣了！',
      '夜晚的博物馆最棒了，影子里面可凉快了桀桀！',
      '别看我这样，我可是很怕寂寞的……多来找我玩啊桀桀！',
      '我在墙后面藏了东西，能找到的话就送给你桀桀！',
    ],
  },
  home: { x: 0, z: 0 },
  spawn: { x: 6, z: 6 },
  house: { wall: '#e8dff2', roofA: '#5a4a7e', roofB: '#4a3a6e', door: '#3a2a5e', accent: '#8a6abe' },
  interior: {
    floorSvg: floorChecker('#d8cee8', '#c0b2d8'),
    wallSvg: wallStripes('#e2d8f0', '#cec0e2'),
    furniture: [
      { kind: 'bed', x: -5.6, z: -3.4, color: '#5a4a7e', color2: '#d8cee8' },
      { kind: 'rug', x: 0, z: 0.8, color: '#7a5a9e', w: 4.4, d: 3 },
      { kind: 'decor', x: 5.8, z: -3.2, emoji: '👻', color: '#8a6abe' },
      { kind: 'table', x: 2.6, z: -3.6, color: '#5a4a7e', color2: '#c0b2d8' },
      { kind: 'chair', x: 2.6, z: -2.2, color: '#7a5a9e', rotY: Math.PI },
      { kind: 'sofa', x: 6, z: 2.2, color: '#9a7abe', color2: '#e8dff2', rotY: -Math.PI / 2 },
      { kind: 'dresser', x: -7, z: 1.8, color: '#4a3a6e', rotY: Math.PI / 2 },
      { kind: 'lamp', x: -3.4, z: -4.6, color: '#c0a8f0' },
      { kind: 'plant', x: 6.9, z: -3.6, color: '#5a6a8a' },
    ],
  },
};
