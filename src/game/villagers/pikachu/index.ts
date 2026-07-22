// 皮卡丘（Pikachu）：广场向导，常驻服务处（无自宅）
import type { VillagerProfile } from '../types';

export const profile: VillagerProfile = {
  id: 'pikachu',
  def: {
    name: '皮卡丘', height: 0.4, species: '小鼠宝可梦', color: 0xf7d02c, belly: 0xf7d02c,
    earType: 'pikachu', shirt: 0xf7d02c, earColor: 0xf7d02c, catchphrase: '皮卡', lines: [],
  },
  home: { x: 0, z: 20 },   // 服务处（广场）
  spawn: { x: 4, z: 14 },  // 广场上
};
