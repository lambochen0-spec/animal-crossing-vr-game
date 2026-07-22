// 喵喵（Meowth）：友好商店社长，常驻商店（无自宅）
import type { VillagerProfile } from '../types';

export const profile: VillagerProfile = {
  id: 'meowth',
  def: {
    name: '喵喵', height: 0.4, species: '妖怪猫宝可梦', color: 0xf5e6c8, belly: 0xfff8e1,
    earType: 'meowth', shirt: 0xf5e6c8, catchphrase: '喵', lines: [],
  },
  home: { x: -30, z: 26 },   // 友好商店
  spawn: { x: -30, z: 30 },  // 店门口
};
