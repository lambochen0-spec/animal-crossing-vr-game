// 啃果虫（Applin）：住在苹果里的小房客
import type { VillagerProfile } from '../types';
import { floorChecker, wallLeaves } from '../svg';

export const profile: VillagerProfile = {
  id: 'applin',
  def: {
    name: '啃果虫', height: 0.2, species: '苹果居宝可梦', color: 0xe84a3a, belly: 0xf7d8a0, earType: 'bulbasaur',
    catchphrase: '啃啃', likes: ["apple"],
    lines: ["我住在苹果里，苹果就是我的家、我的盔甲、我的全部啃啃！", "不要把我当成普通的苹果啊，会吓一大跳的啃啃！", "苹果的味道决定了我的味道，我很甜哦啃啃！", "小小的身体藏在果核里， safest 的地方啃啃！"],
  },
  home: { x: 0, z: 0 },
  spawn: { x: 0, z: 0 },
  house: { wall: '#fae8e0', roofA: '#c8402f', roofB: '#a83526', door: '#6a4a2f', accent: '#e89070' },
  interior: {
    floorSvg: floorChecker('#fdefe4', '#f2d0b0'),
    wallSvg: wallLeaves('#faebe2', '#d87a5a'),
    furniture: [
      { kind: 'bed', x: -5.6, z: -3.4, color: '#c8402f', color2: '#f7d8a0' },
      { kind: 'rug', x: 0, z: 0.8, color: '#c8402f', w: 4.4, d: 3 },
      { kind: 'decor', x: 6.8, z: -3.4, emoji: '🍎', color: '#ffffff' },
      { kind: 'decor', x: 6.9, z: 0.8, emoji: '🐛', color: '#ffffff' },
      { kind: 'table', x: 2.6, z: -3.6, color: '#c8402f', color2: '#ffffff' },
      { kind: 'chair', x: 2.6, z: -2.2, color: '#c8402f', rotY: Math.PI },
      { kind: 'sofa', x: 6, z: 2.2, color: '#f7d8a0', color2: '#ffffff', rotY: -Math.PI / 2 },
      { kind: 'dresser', x: -7, z: 1.8, color: '#c8402f', rotY: Math.PI / 2 },
      { kind: 'lamp', x: -3.4, z: -4.6, color: '#fff4d8' },
    ],
  },
};
