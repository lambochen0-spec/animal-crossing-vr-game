// 来电汪（Yamper）：柯基面包小屋，追着球跑的快乐小狗
import type { VillagerProfile } from '../types';
import { floorChecker, wallPaws } from '../svg';

export const profile: VillagerProfile = {
  id: 'yamper',
  def: {
    name: '来电汪', height: 0.3, species: '小狗宝可梦', color: 0xc98a4a, belly: 0xf7f0e0, earType: 'yamper', catchphrase: '汪汪',
    lines: [
      '汪汪！要玩捡球游戏吗？你丢出去我马上捡回来！',
      '我的尾巴摇得越快，发电就越多哦汪汪！',
      '今天追着自己的尾巴跑了十圈，晕乎乎的超开心汪汪！',
      '你身上有好闻的味道……是刚摘的水果吗汪汪？',
    ],
  },
  home: { x: 0, z: 0 },
  spawn: { x: 6, z: 6 },
  house: { wall: '#f7ecd9', roofA: '#c98a4a', roofB: '#b87a3a', door: '#9a6228', accent: '#f2c94c' },
  interior: {
    floorSvg: floorChecker('#f7ecd9', '#ead8b8'),
    wallSvg: wallPaws('#f7f0e2', '#e2cba0'),
    furniture: [
      { kind: 'bed', x: -5.6, z: -3.4, color: '#c98a4a', color2: '#f7f0e0' },
      { kind: 'rug', x: 0, z: 0.8, color: '#f2c94c', w: 4.4, d: 3 },
      { kind: 'decor', x: 5.8, z: -3.2, emoji: '🦴', color: '#c98a4a' },
      { kind: 'table', x: 2.6, z: -3.6, color: '#c98a4a', color2: '#f7f0e0' },
      { kind: 'chair', x: 2.6, z: -2.2, color: '#f2c94c', rotY: Math.PI },
      { kind: 'sofa', x: 6, z: 2.2, color: '#d9a86a', color2: '#ffffff', rotY: -Math.PI / 2 },
      { kind: 'dresser', x: -7, z: 1.8, color: '#b87a3a', rotY: Math.PI / 2 },
      { kind: 'lamp', x: -3.4, z: -4.6, color: '#fff2c0' },
      { kind: 'plant', x: 6.9, z: -3.6, color: '#7ab86a' },
    ],
  },
};
