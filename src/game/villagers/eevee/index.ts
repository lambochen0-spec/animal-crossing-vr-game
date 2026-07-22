// 伊布（Eevee）：温暖毛茸茸的森林小屋
import type { VillagerProfile } from '../types';
import { floorPlanks, wallPaws } from '../svg';

export const profile: VillagerProfile = {
  id: 'eevee',
  def: {
    name: '伊布', height: 0.3, species: '进化宝可梦', color: 0xc89a5e, belly: 0xf7e8c9, earType: 'eevee', catchphrase: '布伊',
    lines: [
      '布伊！我的毛茸茸围脖好看吗？每天都要梳十遍哦！',
      '听说这座岛上有各种各样的环境，我要在这里好好修炼布伊！',
      '晚上的萤火虫亮晶晶的，看得我尾巴都摇起来了布伊！',
      '挖到化石了吗？广场上好像有奇怪的痕迹呢布伊！',
    ],
  },
  home: { x: -44, z: -46 },
  spawn: { x: -38, z: -40 },
  house: { wall: '#f5ead9', roofA: '#b8804a', roofB: '#a67040', door: '#8a5a3b', accent: '#c89a5e' },
  interior: {
    floorSvg: floorPlanks('#c9a06a', '#a87f4e'),
    wallSvg: wallPaws('#f7ecd9', '#d9b98a'),
    furniture: [
      { kind: 'bed', x: -5.6, z: -3.4, color: '#a87f4e', color2: '#f7e8c9' },
      { kind: 'rug', x: 0, z: 0.8, color: '#8a6a45', w: 4.2, d: 3 },
      { kind: 'plant', x: -7, z: -3.6, color: '#5a9a4a' },
      { kind: 'plant', x: 6.9, z: -3.6, color: '#6aa858' },
      { kind: 'table', x: 2.8, z: -3.4, color: '#b8804a', color2: '#f7e8c9' },
      { kind: 'chair', x: 2.8, z: -2, color: '#c89a5e', rotY: Math.PI },
      { kind: 'sofa', x: 5.6, z: 2.4, color: '#c89a5e', color2: '#f7e8c9', rotY: -Math.PI / 2 },
      { kind: 'dresser', x: -7, z: 1.8, color: '#a87f4e', rotY: Math.PI / 2 },
      { kind: 'lamp', x: -3.4, z: -4.6, color: '#ffd9a0' },
      { kind: 'decor', x: 6.8, z: 0.8, emoji: '🧶', color: '#f7e8c9' },   // 毛线球：梳毛时间
    ],
  },
};
