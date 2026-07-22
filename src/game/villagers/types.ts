// 村民（宝可梦）档案类型：每只宝可梦一个文件夹，内含数据/房屋外观/室内装修，便于整体替换
export interface VillagerDef {
  name: string;
  species: string;
  color: number;
  belly: number;
  earType: 'pikachu' | 'meowth' | 'jigglypuff' | 'eevee' | 'snorlax' | 'psyduck' | 'charmander' | 'squirtle' | 'bulbasaur' | 'penguin'
    | 'togepi' | 'gengar' | 'lucario' | 'sylveon' | 'mimikyu' | 'dedenne' | 'rowlet' | 'scorbunny' | 'yamper' | 'dragonite';
  shirt?: number;
  earColor?: number;
  height: number; // 宝可梦官方身高（米），用于按比例缩放
  catchphrase: string;
  lines: string[];
  likes?: string[];   // 喜好的物品 id：送中喜好礼物好感 +2（否则 +1）
}

// 房屋外观风格
export interface HouseStyle {
  wall: string;      // 墙面主色
  roofA: string;     // 屋顶主色
  roofB: string;     // 屋顶次色
  door: string;      // 门颜色
  accent: string;    // 窗框/篱笆/装饰色
  big?: boolean;     // 大户型（卡比兽）
}

// 室内家具条目（房间约 16×11，中心 0,0；x∈[-8,8]，z∈[-5.5,5.5]，门在 z=+5.5 墙）
export interface FurnitureItem {
  kind: 'bed' | 'table' | 'chair' | 'rug' | 'lamp' | 'plant' | 'shelf' | 'dresser' | 'sofa' | 'decor';
  x: number;
  z: number;
  color?: string;    // 主色
  color2?: string;   // 次色（被子/坐垫等）
  w?: number;        // 占地宽（默认按 kind）
  d?: number;        // 占地深
  rotY?: number;     // 朝向（弧度）
  emoji?: string;    // 顶部/面上装饰（decor 专用）
  item?: string;     // decor 展示的物品 id（用 SVG 贴图，优先级高于 emoji）
  shape?: string;    // 商品造型模板（配合 item）
  c1?: string; c2?: string; // 商品配色（配合 shape）
}

// 室内装修风格：SVG 绘制的地板与墙纸 + 家具清单
export interface InteriorStyle {
  floorSvg: string;  // SVG 字符串（200×200 一格地板）
  wallSvg: string;   // SVG 字符串（200×200 墙纸）
  furniture: FurnitureItem[];
}

// 一只宝可梦的完整档案
export interface VillagerProfile {
  id: string;                       // 文件夹名（英文）
  def: VillagerDef;                 // 角色数据
  home: { x: number; z: number };   // 房子坐标（无固定居所的 NPC 为工作点）
  spawn: { x: number; z: number };  // 白天出没点
  house?: HouseStyle;               // 房屋外观（无房的 NPC 可省略）
  interior?: InteriorStyle;         // 室内装修（同上）
}
