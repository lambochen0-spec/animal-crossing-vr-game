// 球球海狮（Popplio）：梦想登台的海狮表演家
import type { VillagerProfile } from '../types';
import { floorChecker, wallWaves } from '../svg';

export const profile: VillagerProfile = {
  id: 'popplio',
  def: {
    name: '球球海狮', height: 0.4, species: '海狮宝可梦', color: 0x5aa8e8, belly: 0xf0f7ff, earType: 'penguin',
    catchphrase: '球球', likes: ["cherry"],
    lines: ["看我的泡泡！又大又圆还能弹起来球球！", "练习表演是为了有一天站上大舞台球球！", "鼻子上的球球是我的标志，可爱吧球球！", "每天练一百个后空翻，一个都不能少球球！"],
  },
  home: { x: 0, z: 0 },
  spawn: { x: 0, z: 0 },
  house: { wall: '#e0f0fd', roofA: '#4a86c8', roofB: '#3c70a6', door: '#c84a6a', accent: '#92c8f0' },
  interior: {
    floorSvg: floorChecker('#e8f4fe', '#bcdcf4'),
    wallSvg: wallWaves('#e4f1fc', '#74b2e2'),
    furniture: [
      { kind: 'bed', x: -5.6, z: -3.4, color: '#4a86c8', color2: '#f0f7ff' },
      { kind: 'rug', x: 0, z: 0.8, color: '#4a86c8', w: 4.4, d: 3 },
      { kind: 'decor', x: 6.8, z: -3.4, emoji: '🎪', color: '#ffffff' },
      { kind: 'decor', x: 6.9, z: 0.8, emoji: '🫧', color: '#ffffff' },
      { kind: 'table', x: 2.6, z: -3.6, color: '#4a86c8', color2: '#ffffff' },
      { kind: 'chair', x: 2.6, z: -2.2, color: '#4a86c8', rotY: Math.PI },
      { kind: 'sofa', x: 6, z: 2.2, color: '#f0f7ff', color2: '#ffffff', rotY: -Math.PI / 2 },
      { kind: 'dresser', x: -7, z: 1.8, color: '#4a86c8', rotY: Math.PI / 2 },
      { kind: 'lamp', x: -3.4, z: -4.6, color: '#fff4d8' },
    ],
  },
};
