// 菊草叶（Chikorita）：头顶香叶的治愈系
import type { VillagerProfile } from '../types';
import { floorChecker, wallLeaves } from '../svg';

export const profile: VillagerProfile = {
  id: 'chikorita',
  def: {
    name: '菊草叶', height: 0.9, species: '叶子宝可梦', color: 0xa8d860, belly: 0xf7f7d0, earType: 'bulbasaur',
    catchphrase: '叶叶', likes: ["cherry"],
    lines: ["头上的叶子香香的吧？闻一下心情就会变好叶叶！", "最喜欢晒太阳了，光合作用让我活力满满叶叶！", "我会用叶子轻轻碰你，那是喜欢的意思叶叶！", "下雨天叶子会变得更绿更漂亮叶叶！"],
  },
  home: { x: 0, z: 0 },
  spawn: { x: 0, z: 0 },
  house: { wall: '#f0f7d8', roofA: '#6a9a3a', roofB: '#5a8430', door: '#4a6a2f', accent: '#b8d88a' },
  interior: {
    floorSvg: floorChecker('#f4fae0', '#cfe0a0'),
    wallSvg: wallLeaves('#eef7da', '#8ab86a'),
    furniture: [
      { kind: 'bed', x: -5.6, z: -3.4, color: '#6a9a3a', color2: '#f7f7d0' },
      { kind: 'rug', x: 0, z: 0.8, color: '#6a9a3a', w: 4.4, d: 3 },
      { kind: 'decor', x: 6.8, z: -3.4, emoji: '🌿', color: '#ffffff' },
      { kind: 'decor', x: 6.9, z: 0.8, emoji: '🌼', color: '#ffffff' },
      { kind: 'table', x: 2.6, z: -3.6, color: '#6a9a3a', color2: '#ffffff' },
      { kind: 'chair', x: 2.6, z: -2.2, color: '#6a9a3a', rotY: Math.PI },
      { kind: 'sofa', x: 6, z: 2.2, color: '#f7f7d0', color2: '#ffffff', rotY: -Math.PI / 2 },
      { kind: 'dresser', x: -7, z: 1.8, color: '#6a9a3a', rotY: Math.PI / 2 },
      { kind: 'lamp', x: -3.4, z: -4.6, color: '#fff4d8' },
    ],
  },
};
