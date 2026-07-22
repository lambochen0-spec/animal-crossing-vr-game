// 路卡利欧（Lucario）：蓝黑武道小屋，自律的波导使者
import type { VillagerProfile } from '../types';
import { floorPlanks, wallStripes } from '../svg';

export const profile: VillagerProfile = {
  id: 'lucario',
  def: {
    name: '路卡利欧', height: 1.2, species: '波导宝可梦', color: 0x4a6ac9, belly: 0xf7e8c9, earType: 'lucario', catchphrase: '哈啊',
    lines: [
      '哈啊——！晨练结束。你的波导……很清澈，继续保持。',
      '这座岛的波导很平和，住在这里心情会变好。',
      '要不要一起晨跑？绕着广场跑三圈，精神一整天！',
      '波导告诉我，你今天会有好事发生。敬请期待吧。',
    ],
  },
  home: { x: 0, z: 0 },
  spawn: { x: 6, z: 6 },
  house: { wall: '#dfe8f7', roofA: '#2a3a6e', roofB: '#1e2e5a', door: '#16224a', accent: '#4a6ac9' },
  interior: {
    floorSvg: floorPlanks('#c9b08a', '#a88f6a'),
    wallSvg: wallStripes('#e8ecf7', '#ccd4ea'),
    furniture: [
      { kind: 'bed', x: -5.6, z: -3.4, color: '#2a3a6e', color2: '#dfe8f7' },
      { kind: 'rug', x: 0, z: 0.8, color: '#4a6ac9', w: 4.4, d: 3 },
      { kind: 'decor', x: 5.8, z: -3.2, emoji: '🥋', color: '#4a6ac9' },
      { kind: 'table', x: 2.6, z: -3.6, color: '#2a3a6e', color2: '#dfe8f7' },
      { kind: 'chair', x: 2.6, z: -2.2, color: '#4a6ac9', rotY: Math.PI },
      { kind: 'sofa', x: 6, z: 2.2, color: '#7a9ad9', color2: '#f7f0e0', rotY: -Math.PI / 2 },
      { kind: 'dresser', x: -7, z: 1.8, color: '#1e2e5a', rotY: Math.PI / 2 },
      { kind: 'lamp', x: -3.4, z: -4.6, color: '#fff2c0' },
      { kind: 'plant', x: 6.9, z: -3.6, color: '#4a7a5a' },
    ],
  },
};
