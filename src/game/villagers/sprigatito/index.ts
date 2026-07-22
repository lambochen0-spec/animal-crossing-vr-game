// 新叶喵（Sprigatito）：爱撒娇的草香小猫
import type { VillagerProfile } from '../types';
import { floorChecker, wallLeaves } from '../svg';

export const profile: VillagerProfile = {
  id: 'sprigatito',
  def: {
    name: '新叶喵', height: 0.4, species: '草猫宝可梦', color: 0xa8e0b0, belly: 0xf0fbf0, earType: 'meowth',
    catchphrase: '喵叶', likes: ["cherry"],
    lines: ["身上的毛香香的吧？揉一揉会散发出叶子的香味喵叶！", "阳光好的地方就是我的午睡宝座喵叶！", "别看我爱撒娇，玩起毛线球可是很认真的喵叶！", "叶子掉色了可不行，每天都要梳毛保养喵叶！"],
  },
  home: { x: 0, z: 0 },
  spawn: { x: 0, z: 0 },
  house: { wall: '#e8f7e4', roofA: '#5aa86a', roofB: '#488a56', door: '#4a6a4a', accent: '#a0d8a8' },
  interior: {
    floorSvg: floorChecker('#eef9ea', '#c4e4c0'),
    wallSvg: wallLeaves('#eaf7e6', '#7ac888'),
    furniture: [
      { kind: 'bed', x: -5.6, z: -3.4, color: '#5aa86a', color2: '#f0fbf0' },
      { kind: 'rug', x: 0, z: 0.8, color: '#5aa86a', w: 4.4, d: 3 },
      { kind: 'decor', x: 6.8, z: -3.4, emoji: '🌱', color: '#ffffff' },
      { kind: 'decor', x: 6.9, z: 0.8, emoji: '🧶', color: '#ffffff' },
      { kind: 'table', x: 2.6, z: -3.6, color: '#5aa86a', color2: '#ffffff' },
      { kind: 'chair', x: 2.6, z: -2.2, color: '#5aa86a', rotY: Math.PI },
      { kind: 'sofa', x: 6, z: 2.2, color: '#f0fbf0', color2: '#ffffff', rotY: -Math.PI / 2 },
      { kind: 'dresser', x: -7, z: 1.8, color: '#5aa86a', rotY: Math.PI / 2 },
      { kind: 'lamp', x: -3.4, z: -4.6, color: '#fff4d8' },
    ],
  },
};
