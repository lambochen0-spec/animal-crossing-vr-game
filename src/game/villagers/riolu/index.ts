// 利欧路（Riolu）：以路卡利欧为目标的修行家
import type { VillagerProfile } from '../types';
import { floorChecker, wallStars } from '../svg';

export const profile: VillagerProfile = {
  id: 'riolu',
  def: {
    name: '利欧路', height: 0.7, species: '波纹宝可梦', color: 0x3a68c8, belly: 0x26262e, earType: 'lucario',
    catchphrase: '利欧', likes: ["peach"],
    lines: ["我能感受到你的波导，你今天心情不错利欧！", "每天练功不能停，总有一天我会进化成路卡利欧利欧！", "跑步、跳绳、俯卧撑，晨练清单完成利欧！", "强者不是靠力气，是靠不屈的心利欧！"],
  },
  home: { x: 0, z: 0 },
  spawn: { x: 0, z: 0 },
  house: { wall: '#dce4f7', roofA: '#3a5a9a', roofB: '#2f487e', door: '#26262e', accent: '#7a9ad0' },
  interior: {
    floorSvg: floorChecker('#e4eaf7', '#b0bede'),
    wallSvg: wallStars('#e0e6f5', '#6a86c0'),
    furniture: [
      { kind: 'bed', x: -5.6, z: -3.4, color: '#3a5a9a', color2: '#26262e' },
      { kind: 'rug', x: 0, z: 0.8, color: '#3a5a9a', w: 4.4, d: 3 },
      { kind: 'decor', x: 6.8, z: -3.4, emoji: '🥋', color: '#ffffff' },
      { kind: 'decor', x: 6.9, z: 0.8, emoji: '💪', color: '#ffffff' },
      { kind: 'table', x: 2.6, z: -3.6, color: '#3a5a9a', color2: '#ffffff' },
      { kind: 'chair', x: 2.6, z: -2.2, color: '#3a5a9a', rotY: Math.PI },
      { kind: 'sofa', x: 6, z: 2.2, color: '#26262e', color2: '#ffffff', rotY: -Math.PI / 2 },
      { kind: 'dresser', x: -7, z: 1.8, color: '#3a5a9a', rotY: Math.PI / 2 },
      { kind: 'lamp', x: -3.4, z: -4.6, color: '#fff4d8' },
    ],
  },
};
