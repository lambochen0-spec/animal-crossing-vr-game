// 胖丁（Jigglypuff）：粉色歌唱家之家
import type { VillagerProfile } from '../types';
import { floorChecker, wallHearts } from '../svg';

export const profile: VillagerProfile = {
  id: 'jigglypuff',
  def: {
    name: '胖丁', height: 0.5, species: '气球宝可梦', color: 0xf7b8c9, belly: 0xffe8ee, earType: 'jigglypuff', catchphrase: '啵哩',
    lines: [
      '啵哩啵哩~♪ 我刚学会一首新歌，唱给你听好吗？……咦，你怎么睡着了？',
      '我最喜欢圆圆的、软软的东西了啵哩！',
      '听说明天会有流星雨，我要对着星星唱歌啵哩~♪',
      '友好商店今天好像进了新货啵哩。',
    ],
  },
  home: { x: -72, z: -46 },
  spawn: { x: -66, z: -40 },
  house: { wall: '#fbe0e8', roofA: '#e87a9a', roofB: '#d96a8a', door: '#c2577b', accent: '#f7b8c9' },
  interior: {
    floorSvg: floorChecker('#ffe3ec', '#f7b8c9'),
    wallSvg: wallHearts('#ffeef4', '#f28aad'),
    furniture: [
      { kind: 'bed', x: -5.6, z: -3.4, color: '#f28aad', color2: '#ffe3ec' },
      { kind: 'rug', x: 0, z: 0.6, color: '#f7b8c9', w: 4.6, d: 3.2 },
      { kind: 'table', x: 2.6, z: -3.6, color: '#ffffff', color2: '#f28aad' },
      { kind: 'chair', x: 2.6, z: -2.2, color: '#f7b8c9', rotY: Math.PI },
      { kind: 'dresser', x: -7, z: 1.8, color: '#f28aad', rotY: Math.PI / 2 },
      { kind: 'lamp', x: -3.4, z: -4.6, color: '#ffd34d' },
      { kind: 'decor', x: 5.8, z: -3.4, emoji: '🎤', color: '#ffffff' },   // 麦克风：歌星的心头好
      { kind: 'decor', x: 6.9, z: 1.2, emoji: '🎵', color: '#f7b8c9' },
      { kind: 'sofa', x: 5.4, z: 2.6, color: '#f7b8c9', color2: '#ffffff', rotY: -Math.PI / 2 },
    ],
  },
};
