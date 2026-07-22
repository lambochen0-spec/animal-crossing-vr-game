// 小锯鳄（Totodile）：见什么都想咬一口的淘气鳄鱼
import type { VillagerProfile } from '../types';
import { floorChecker, wallWaves } from '../svg';

export const profile: VillagerProfile = {
  id: 'totodile',
  def: {
    name: '小锯鳄', height: 0.6, species: '大颚宝可梦', color: 0x3a78c8, belly: 0xf7e8b0, earType: 'charmander',
    catchphrase: '鳄鳄', likes: ["peach"],
    lines: ["看到什么都想咬一口，这是我的表达方式鳄鳄！", "我的下颚力气很大，但是咬人很轻的啦，放心鳄鳄！", "水龙头没关紧的话，我会用嘴巴接住每一滴水鳄鳄！", "等我长大变成大力鳄，就能保护大家了鳄鳄！"],
  },
  home: { x: 0, z: 0 },
  spawn: { x: 0, z: 0 },
  house: { wall: '#d8ecff', roofA: '#c8452f', roofB: '#a83826', door: '#3a78c8', accent: '#f0d090' },
  interior: {
    floorSvg: floorChecker('#e8f0f8', '#b8cce0'),
    wallSvg: wallWaves('#e4f0fa', '#6a9ac8'),
    furniture: [
      { kind: 'bed', x: -5.6, z: -3.4, color: '#c8452f', color2: '#f7e8b0' },
      { kind: 'rug', x: 0, z: 0.8, color: '#c8452f', w: 4.4, d: 3 },
      { kind: 'decor', x: 6.8, z: -3.4, emoji: '🦷', color: '#ffffff' },
      { kind: 'decor', x: 6.9, z: 0.8, emoji: '💧', color: '#ffffff' },
      { kind: 'table', x: 2.6, z: -3.6, color: '#c8452f', color2: '#ffffff' },
      { kind: 'chair', x: 2.6, z: -2.2, color: '#c8452f', rotY: Math.PI },
      { kind: 'sofa', x: 6, z: 2.2, color: '#f7e8b0', color2: '#ffffff', rotY: -Math.PI / 2 },
      { kind: 'dresser', x: -7, z: 1.8, color: '#c8452f', rotY: Math.PI / 2 },
      { kind: 'lamp', x: -3.4, z: -4.6, color: '#fff4d8' },
    ],
  },
};
