// 木木枭（Rowlet）：绿叶圆滚小屋，白天打瞌睡的森林绅士
import type { VillagerProfile } from '../types';
import { floorPlanks, wallLeaves } from '../svg';

export const profile: VillagerProfile = {
  id: 'rowlet',
  def: {
    name: '木木枭', height: 0.3, species: '草羽宝可梦', color: 0x8a9e6a, belly: 0xf7f0e0, earType: 'rowlet', catchphrase: '咕咕',
    lines: [
      '咕咕……啊，抱歉，我站着睡着了。你刚才说什么？',
      '把树叶领结系整齐，是绅士的基本礼仪咕咕！',
      '阳光晒着真舒服……要一起来打个盹吗咕咕？',
      '我种的树苗长高了一点，要不要去看看咕咕？',
    ],
  },
  home: { x: 0, z: 0 },
  spawn: { x: 6, z: 6 },
  house: { wall: '#eef2e0', roofA: '#6a8e4a', roofB: '#5a7e3a', door: '#4a6a30', accent: '#a8c97a' },
  interior: {
    floorSvg: floorPlanks('#c9b08a', '#a88f6a'),
    wallSvg: wallLeaves('#eef2e0', '#a8c98a'),
    furniture: [
      { kind: 'bed', x: -5.6, z: -3.4, color: '#6a8e4a', color2: '#eef2e0' },
      { kind: 'rug', x: 0, z: 0.8, color: '#a8c97a', w: 4.4, d: 3 },
      { kind: 'decor', x: 5.8, z: -3.2, emoji: '🌿', color: '#6a8e4a' },
      { kind: 'table', x: 2.6, z: -3.6, color: '#6a8e4a', color2: '#eef2e0' },
      { kind: 'chair', x: 2.6, z: -2.2, color: '#a8c97a', rotY: Math.PI },
      { kind: 'sofa', x: 6, z: 2.2, color: '#b8d88a', color2: '#f7f0e0', rotY: -Math.PI / 2 },
      { kind: 'dresser', x: -7, z: 1.8, color: '#5a7e3a', rotY: Math.PI / 2 },
      { kind: 'lamp', x: -3.4, z: -4.6, color: '#fff2c0' },
      { kind: 'plant', x: 6.9, z: -3.6, color: '#5a9a4a' },
    ],
  },
};
