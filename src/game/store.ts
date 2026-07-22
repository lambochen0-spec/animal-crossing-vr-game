// 游戏引擎 <-> React UI 的状态桥
import type { ToolId } from './data';

export interface DialogAction { label: string; command: string; }

export interface HudState {
  bells: number;
  miles: number;
  inventory: Record<string, number>;
  selectedItem: string | null; // 手上拿着的（用于种植）
  tool: ToolId;
  lockedTools: ToolId[];       // 未解锁的工具
  prompt: string | null;       // 交互提示
  dialog: { name: string; text: string; actions?: DialogAction[] } | null;
  toast: { title: string; icon: string; desc: string } | null;
  shopOpen: boolean;
  shopLine: string;
  shopGoods: { id: string; name: string; icon: string; price: number }[]; // 今日货架商品（喵喵面板同步可买）
  hotDeal: { cat: string; icon: string; label: string } | null; // 今日高价收购品类（1.5 倍）
  daily: { icon: string; text: string; progress: number; need: number; done: boolean }[]; // 每日任务
  timeText: string;
  dateText: string;
  isNight: boolean;
  weather: string; // 'sun' | 'rain'
  fishing: 'idle' | 'charging' | 'waiting' | 'bite' | 'hooked';
  fishPower: number;                 // 蓄力 0~1
  reel: { got: number; need: number } | null; // 拉杆小游戏进度
  helpOpen: boolean;
  quest: { title: string; hint: string; progress: number; need: number; ready: boolean } | null;
  homeUpgraded: boolean;
  mapImage: string | null;
  mapPlayer: { x: number; z: number };
  mapOpen: boolean;
  phoneOpen: boolean;
  sleepFade: boolean;             // 睡觉黑屏淡入淡出
  titleStage: 'logo' | 'menu' | 'names' | null; // 标题画面：logo → 存档选择菜单 →（新游戏）起名 → 进入游戏
  islandName: string; // 岛名（开局自定义，替代「像素小岛」）
  playerName: string; // 玩家名（出现在宝可梦对话里）
  hasSave: boolean;               // 是否存在存档（决定「读取存档」按钮）
  karaoke: string | null;         // 篝火晚会歌词横幅（null=不显示）
  dex: string[];                  // 图鉴：抓到过的虫/鱼
  vrSupported: boolean;           // 检测到 VR 设备（显示进入 VR 入口）
  vrActive: boolean;              // VR 会话进行中
}

export const initialHud: HudState = {
  bells: 0,
  miles: 0,
  inventory: {},
  selectedItem: null,
  tool: 'hand',
  lockedTools: ['net', 'rod', 'shovel', 'axe'],
  prompt: null,
  dialog: null,
  toast: null,
  shopOpen: false,
  shopLine: '',
  shopGoods: [],
  hotDeal: null,
  daily: [],
  timeText: '09:00',
  dateText: '1月1日',
  isNight: false,
  weather: 'sun',
  fishing: 'idle',
  fishPower: 0,
  reel: null,
  helpOpen: false,
  quest: null,
  homeUpgraded: false,
  mapImage: null,
  mapPlayer: { x: 0, z: 0 },
  mapOpen: false,
  phoneOpen: false,
  sleepFade: false,
  titleStage: 'logo',
  islandName: (() => { try { return JSON.parse(localStorage.getItem('pixel-crossing-names') ?? '{}').island ?? '像素小岛'; } catch { return '像素小岛'; } })(),
  playerName: (() => { try { return JSON.parse(localStorage.getItem('pixel-crossing-names') ?? '{}').player ?? '岛主'; } catch { return '岛主'; } })(),
  hasSave: false,
  karaoke: null,
  dex: [],
  vrSupported: false,
  vrActive: false,
};

type Listener = (s: HudState) => void;

class GameStore {
  state: HudState = { ...initialHud };
  private listeners = new Set<Listener>();

  patch(p: Partial<HudState>) {
    this.state = { ...this.state, ...p };
    this.listeners.forEach(l => l(this.state));
  }

  subscribe(l: Listener) {
    this.listeners.add(l);
    l(this.state);
    return () => { this.listeners.delete(l); };
  }
}

export const store = new GameStore();

// UI -> 游戏 的指令队列
type Command =
  | { type: 'setTool'; tool: ToolId }
  | { type: 'selectItem'; item: string | null }
  | { type: 'interact' }
  | { type: 'interactDown' }
  | { type: 'interactUp' }
  | { type: 'closeDialog' }
  | { type: 'closeToast' }
  | { type: 'closeShop' }
  | { type: 'sell'; item: string }
  | { type: 'sellAll' }
  | { type: 'buy'; item: string; price: number }
  | { type: 'toggleHelp' }
  | { type: 'toggleMap' }
  | { type: 'dialogAction'; command: string }
  | { type: 'titleMenu' }      // 点击标题 → 显示存档选择
  | { type: 'continueGame' }   // 读取存档进入游戏
  | { type: 'newGame' }        // 开新游戏（清档重开）
  | { type: 'saveQuit' }       // 保存并回到标题（同步本地存档文件）
  | { type: 'enterVR' }        // 进入 VR 模式
  | { type: 'exitVR' };        // 退出 VR 模式

class CommandBus {
  private q: Command[] = [];
  push(c: Command) { this.q.push(c); }
  drain(): Command[] { const r = this.q; this.q = []; return r; }
}

export const commands = new CommandBus();
if (typeof window !== 'undefined') (window as unknown as Record<string, unknown>).__commands = commands; // 调试钩子
