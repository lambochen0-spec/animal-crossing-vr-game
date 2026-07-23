import { useEffect, useRef, useState } from 'react';
import { store, commands, initialHud } from '@/game/store';
import type { HudState } from '@/game/store';
import { ITEMS, TOOLS, SHOP_GOODS } from '@/game/data';
import { touchInput, displayState } from '@/game/game';

// 工具图标：emoji 或内联 SVG
function iconFor(icon: string) {
  if (icon === 'svg:shovel') {
    return (
      <svg viewBox="0 0 24 24" className="inline-block h-6 w-6" fill="none" stroke="#8a6239" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 2h6" />
        <path d="M12 2v10" />
        <path d="M12 12c-3 0-5 2-5 5 0 2.5 2 5 5 5s5-2.5 5-5c0-3-2-5-5-5z" fill="#9aa5b1" stroke="#6a7684" />
      </svg>
    );
  }
  if (icon === 'svg:net') {
    // 虫网：椭圆网圈 + 网面 + 手柄
    return (
      <svg viewBox="0 0 24 24" className="inline-block h-6 w-6" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="14.5" cy="6.5" rx="5" ry="4.5" stroke="#5a9a4a" fill="#d8f0d8" />
        <path d="M11 9.5 L3.5 20" stroke="#8a6239" strokeWidth="2.5" />
        <path d="M10.5 5.5 q4 2 8 0 M11.5 8.5 q3 1.5 6 0" stroke="#5a9a4a" strokeWidth="1" />
      </svg>
    );
  }
  if (icon === 'svg:rod') {
    // 鱼竿：弯竿 + 鱼线 + 浮漂
    return (
      <svg viewBox="0 0 24 24" className="inline-block h-6 w-6" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 21 Q6 10 18 4" stroke="#a87f4e" strokeWidth="2.5" />
        <path d="M18 4 q1.5 0 2 1.5" stroke="#a87f4e" />
        <path d="M20 5.5 L20 12" stroke="#9aa5b1" strokeWidth="1" />
        <circle cx="20" cy="14" r="2" fill="#e84a3a" stroke="#c93a2e" />
      </svg>
    );
  }
  if (icon === 'svg:axe') {
    // 斧头：斧刃 + 木柄
    return (
      <svg viewBox="0 0 24 24" className="inline-block h-6 w-6" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 3 L20 21" stroke="#8a6239" strokeWidth="2.5" />
        <path d="M13 3 q-4 1 -5 5 q3 3 7 2 Z" fill="#9aa5b1" stroke="#6a7684" />
      </svg>
    );
  }
  return <span>{icon}</span>;
}

// 手机端检测（触屏或窄屏）：手机上任务框/对话框/按钮用更紧凑的布局，电脑端不变
export function useIsMobile() {
  const [m, setM] = useState(() =>
    (window.matchMedia?.('(pointer: coarse)').matches ?? false) || window.innerWidth < 768);
  useEffect(() => {
    const onR = () => setM((window.matchMedia?.('(pointer: coarse)').matches ?? false) || window.innerWidth < 768);
    window.addEventListener('resize', onR);
    return () => window.removeEventListener('resize', onR);
  }, []);
  return m;
}

export function GameUI() {
  const [hud, setHud] = useState<HudState>(initialHud);
  useEffect(() => store.subscribe(setHud), []);
  const isMobile = useIsMobile();

  return (
    <div className="pointer-events-none absolute inset-0 select-none font-sans ui-layer">
      {/* 篝火晚会歌词横幅 */}
      {hud.karaoke && (
        <div className="absolute top-[18%] left-1/2 -translate-x-1/2 z-50 pointer-events-none">
          <p className="text-3xl font-black text-amber-100 text-center animate-bounce"
            style={{ textShadow: '0 0 18px rgba(255,140,40,0.9), 2px 2px 0 rgba(80,30,0,0.8)' }}>
            {hud.karaoke}
          </p>
        </div>
      )}
      {/* 标题画面 */}
      {hud.titleStage && <TitleScreen hud={hud} />}
      {/* 睡觉黑屏淡入淡出（提供保存回标题入口，顺便把本地存档文件同步写完） */}
      <div
        className="absolute inset-0 z-[60] bg-black transition-opacity duration-1000"
        style={{ opacity: hud.sleepFade ? 1 : 0, pointerEvents: hud.sleepFade ? 'auto' : 'none' }}
      >
        {hud.sleepFade && (
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2">
            <button
              className="rounded-2xl border-2 border-white/40 bg-white/15 px-5 py-2.5 text-sm font-bold text-white shadow hover:bg-white/25 transition-colors"
              onClick={() => commands.push({ type: 'saveQuit' })}
            >💾 保存并回到首页</button>
          </div>
        )}
      </div>
      {/* HUD内容整体在触屏层(z-10)之上，保证工具栏/地图/商店可点 */}
      <div className="pointer-events-none absolute inset-0 z-20">
      {/* 顶部：金币 / 积分 / 真实时间 */}
      <div className="absolute left-4 top-4 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-2xl bg-amber-50/95 px-4 py-2 shadow-lg border-2 border-amber-200">
            <span className="text-xl">🔔</span>
            <span className="text-lg font-bold text-amber-800 tabular-nums">{hud.bells.toLocaleString()}</span>
            <span className="text-xs text-amber-600">金币</span>
          </div>
          <div className="flex items-center gap-2 rounded-2xl bg-green-50/95 px-4 py-2 shadow-lg border-2 border-green-200">
            <span className="text-xl">💚</span>
            <span className="text-lg font-bold text-green-800 tabular-nums">{hud.miles.toLocaleString()}</span>
            <span className="text-xs text-green-600">积分</span>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-2xl bg-sky-50/95 px-4 py-1.5 shadow border-2 border-sky-200 w-fit">
          <span>{hud.isNight ? '🌙' : hud.weather === 'rain' ? '🌧️' : '☀️'}</span>
          <span className="font-bold text-sky-800 tabular-nums">{hud.dateText} {hud.timeText}</span>
        </div>
      </div>

      {/* 任务追踪（动森积分目标 + 每日任务）：手机上缩小一号，避免挡住画面 */}
      {(hud.quest || hud.daily.length > 0) && (
        <div className={isMobile
          ? 'absolute right-2 top-[6.5rem] w-44 rounded-xl bg-white/90 p-2 shadow-lg border-2 border-green-200'
          : 'absolute right-4 top-16 w-64 rounded-2xl bg-white/90 p-3 shadow-lg border-2 border-green-200'}>
          {hud.quest && (
            <>
              <p className={`font-bold text-green-700 ${isMobile ? 'text-[10px]' : 'text-xs'}`}>🎯 当前目标</p>
              <p className={`font-bold text-gray-800 ${isMobile ? 'mt-0.5 text-xs' : 'mt-1'}`}>{hud.quest.title}</p>
              {!isMobile && <p className="text-xs text-gray-500">{hud.quest.hint}</p>}
              <div className={`rounded-full bg-gray-200 overflow-hidden ${isMobile ? 'mt-1 h-2' : 'mt-2 h-2.5'}`}>
                <div
                  className="h-full rounded-full bg-green-500 transition-all"
                  style={{ width: `${Math.min(100, (hud.quest.progress / hud.quest.need) * 100)}%` }}
                />
              </div>
              <p className={`text-right font-bold text-green-700 ${isMobile ? 'mt-0.5 text-[10px]' : 'mt-1 text-xs'}`}>
                {hud.quest.ready ? '✅ 去找喵喵吧！' : `${hud.quest.progress} / ${hud.quest.need}`}
              </p>
            </>
          )}
          {hud.daily.length > 0 && (
            <div className={hud.quest ? `border-t border-green-100 ${isMobile ? 'mt-1.5 pt-1' : 'mt-2 pt-1.5'}` : ''}>
              <p className={`font-bold text-amber-600 ${isMobile ? 'text-[10px]' : 'text-xs'}`}>📝 每日任务</p>
              {hud.daily.map((t, i) => (
                <p key={i} className={`${isMobile ? 'text-[10px]' : 'text-xs'} ${t.done ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                  {t.icon} {t.text} <span className="float-right font-bold">{t.done ? '✓' : `${t.progress}/${t.need}`}</span>
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 帮助按钮 */}
      <button
        className={`pointer-events-auto absolute rounded-full bg-white/90 shadow-lg border-2 border-gray-200 font-bold text-gray-600 hover:bg-white ${isMobile ? 'right-2 top-2 w-8 h-8 text-sm' : 'right-4 top-4 w-10 h-10 text-lg'}`}
        onClick={() => commands.push({ type: 'toggleHelp' })}
      >?</button>

      {/* 手机按钮（原版 NookPhone 造型：圆角机身 + 屏幕叶子标志 + Home 键） */}
      <button
        className={`pointer-events-auto absolute flex flex-col items-center border-2 border-gray-500 bg-gray-700 shadow-lg hover:bg-gray-600 ${isMobile ? 'right-2 top-11 h-12 w-9 rounded-lg p-0.5' : 'right-4 top-48 h-16 w-12 rounded-[0.9rem] p-1'}`}
        title="手机（P）：地图 / 背包 / 图鉴"
        onClick={() => store.patch({ phoneOpen: true })}
      >
        <span className="flex w-full flex-1 items-center justify-center rounded-[0.55rem] bg-teal-50">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="#3aa75d">
            <path d="M12 2 C7 7 4 11 4 15 a8 8 0 0 0 16 0 C20 11 17 7 12 2 Z M12 22 L12 14" stroke="#3aa75d" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </span>
        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-gray-400" />
      </button>


      {/* 交互提示 */}
      {hud.prompt && !hud.dialog && !hud.shopOpen && (
        <div className="absolute bottom-36 left-1/2 -translate-x-1/2 rounded-full bg-gray-900/80 px-5 py-2 text-white font-bold shadow-lg animate-pulse">
          {hud.prompt}
        </div>
      )}

// [debug] 实时显示 store 状态，让你知道是不是 vrActive 卡 true
      <div className="pointer-events-none absolute top-1 left-2 text-[10px] text-black/80 bg-white/70 px-1.5 py-0.5 rounded font-mono">
        vrA={String(hud.vrActive)} vrSup={String(hud.vrSupported)} tit={hud.titleStage ?? 'null'}
      </div>

      {/* VR 入口：检测到 VR 设备时显示 */}
      {hud.vrSupported && !hud.vrActive && hud.titleStage === null && (
        <button
          onClick={() => (window as unknown as { __game?: { enterVRNow(): void } }).__game?.enterVRNow()}
          className="pointer-events-auto absolute top-16 right-3 rounded-2xl bg-indigo-600/90 text-white font-bold px-4 py-2.5 shadow-lg hover:bg-indigo-500"
        >
          🥽 进入 VR
        </button>
      )}
      {/* VR 进行中：平面屏显示状态与退出 */}
      {hud.vrActive && (
        <div className="pointer-events-auto absolute inset-x-0 top-6 mx-auto w-fit rounded-2xl bg-indigo-900/90 text-white px-5 py-3 shadow-xl text-center">
          <p className="font-bold">🥽 VR 模式进行中</p>
          <p className="text-xs text-indigo-200 mt-0.5">原地踏步前进 · 挥动手柄用工具 · 抬左手腕看状态</p>
          <button onClick={() => commands.push({ type: 'exitVR' })} className="mt-2 rounded-xl bg-white/20 px-4 py-1.5 text-sm font-bold hover:bg-white/30">退出 VR</button>
        </div>
      )}

      {/* 钓鱼状态 */}
      {hud.fishing === 'bite' && (
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 text-6xl animate-bounce">❗</div>
      )}
      {/* 蓄力条 */}
      {hud.fishing === 'charging' && (
        <div className="absolute bottom-52 left-1/2 -translate-x-1/2 w-64">
          <p className="text-center text-white font-bold text-sm mb-1 drop-shadow">🎣 蓄力中……松开抛竿</p>
          <div className="h-4 rounded-full bg-black/40 border-2 border-white/60 overflow-hidden">
            <div
              className="h-full rounded-full transition-none"
              style={{
                width: `${hud.fishPower * 100}%`,
                background: hud.fishPower > 0.8 ? '#f59e0b' : '#4ade80',
              }}
            />
          </div>
        </div>
      )}
      {/* 拉杆小游戏 */}
      {hud.fishing === 'hooked' && hud.reel && (
        <div className="absolute bottom-52 left-1/2 -translate-x-1/2 w-64">
          <p className="text-center text-white font-bold text-sm mb-1 drop-shadow animate-pulse">🐟 上钩了！连按 E 收线！</p>
          <div className="flex justify-center gap-2">
            {Array.from({ length: hud.reel.need }).map((_, i) => (
              <div
                key={i}
                className={`h-6 w-6 rounded-full border-2 border-white/70 ${i < hud.reel!.got ? 'bg-green-400' : 'bg-black/40'}`}
              />
            ))}
          </div>
        </div>
      )}

      {/* 提示 toast */}
      {hud.toast && (
        <div className="absolute bottom-40 left-1/2 -translate-x-1/2 flex items-center gap-3 rounded-2xl bg-gray-900/85 px-5 py-3 text-white shadow-xl">
          <span className="text-2xl">{hud.toast.icon}</span>
          <span>
            <span className="block font-bold">{hud.toast.title}</span>
            {hud.toast.desc && <span className="block text-xs text-gray-300">{hud.toast.desc}</span>}
          </span>
        </div>
      )}

      {/* 对话（位于工具栏上一层，不遮挡工具栏）；手机上更紧凑 */}
      {hud.dialog && (
        <div className={`pointer-events-auto absolute left-1/2 -translate-x-1/2 cursor-pointer ${isMobile ? 'bottom-[4.6rem] w-[94vw]' : 'bottom-[5.2rem] w-[min(100vw,680px)]'}`} onClick={() => !hud.dialog!.actions && commands.push({ type: 'closeDialog' })}>
          <div className={`relative rounded-3xl border-4 border-amber-300 bg-amber-50 shadow-2xl ${isMobile ? 'p-3 border-[3px]' : 'p-5'}`}>
            <div className={`absolute left-6 rounded-full bg-amber-400 text-white font-bold shadow ${isMobile ? '-top-3 px-3 py-0.5 text-xs' : '-top-4 px-4 py-1'}`}>{hud.dialog.name}</div>
            <p className={`text-gray-800 leading-relaxed ${isMobile ? 'text-sm' : 'text-lg'}`}>{hud.dialog.text}</p>
            {hud.dialog.actions ? (
              <div className="mt-4 flex gap-3">
                {hud.dialog.actions.map((a, i) => (
                  <button
                    key={i}
                    className="flex-1 rounded-2xl bg-emerald-500 py-2.5 text-white font-bold shadow hover:bg-emerald-600"
                    onClick={e => { e.stopPropagation(); commands.push({ type: 'dialogAction', command: a.command }); }}
                  >{a.label}</button>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-right text-sm text-gray-400">点击继续 ▸</p>
            )}
          </div>
        </div>
      )}

      {/* 商店 */}
      {hud.shopOpen && <ShopPanel hud={hud} />}

      {/* 帮助 */}
      {hud.helpOpen && <HelpPanel />}

      {/* 底部：工具栏（z-20 高于触屏层，手机上才能点到） */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2 max-w-[96vw]">
        <div className="pointer-events-auto flex gap-2">
          {TOOLS.map((t, i) => {
            const locked = hud.lockedTools.includes(t.id);
            const active = hud.tool === t.id;
            return (
              <button
                key={t.id}
                disabled={locked}
                title={locked ? '找喵喵领取工具解锁' : t.hint}
                onClick={() => commands.push({ type: 'setTool', tool: t.id })}
                className={`flex h-14 w-14 flex-col items-center justify-center rounded-2xl border-2 shadow-lg transition-transform ${active ? 'border-emerald-500 bg-white scale-110' : 'border-white/60 bg-white/80'} ${locked ? 'opacity-40' : 'hover:bg-white'}`}
              >
                <span className="text-2xl leading-none">{iconFor(t.icon)}</span>
                <span className="mt-0.5 text-[9px] text-gray-500">{i + 1}·{t.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 手机 */}
      {hud.phoneOpen && <PhonePanel hud={hud} />}

      {/* 触屏控制 */}
      <TouchControls />
      </div>
    </div>
  );
}

// 小地图渲染
function MiniMap({ hud, big = false }: { hud: HudState; big?: boolean }) {
  const px = ((hud.mapPlayer.x + 96) / 192) * 100;
  const pz = ((hud.mapPlayer.z + 96) / 192) * 100;
  return (
    <div className="relative w-full h-full">
      <img src={hud.mapImage!} alt="map" className="w-full h-full" style={{ imageRendering: 'pixelated' }} />
      {/* 玩家位置 */}
      <div
        className="absolute rounded-full bg-red-500 border-2 border-white shadow"
        style={{
          width: big ? 12 : 8, height: big ? 12 : 8,
          left: `calc(${px}% - ${big ? 6 : 4}px)`,
          top: `calc(${pz}% - ${big ? 6 : 4}px)`,
        }}
      />
    </div>
  );
}

function ShopPanel({ hud }: { hud: HudState }) {
  const priceOf = (id: string) => {
    const base = ITEMS[id]?.price ?? 0;
    return hud.hotDeal && ITEMS[id]?.category === hud.hotDeal.cat ? Math.round(base * 1.5) : base;
  };
  const sellable = Object.entries(hud.inventory).filter(([id]) => (ITEMS[id]?.price ?? 0) > 0);
  const totalValue = sellable.reduce((s, [id, n]) => s + priceOf(id) * n, 0);
  return (
    <div className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-black/40 p-4">
      <div className="w-[min(94vw,640px)] max-h-[86vh] overflow-auto rounded-3xl border-4 border-amber-300 bg-amber-50 p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-amber-800">⚡ 友好商店</h2>
            <p className="mt-1 text-sm text-gray-600">{hud.shopLine}</p>
          </div>
          <button className="rounded-full bg-amber-200 px-3 py-1 font-bold text-amber-800 hover:bg-amber-300" onClick={() => commands.push({ type: 'closeShop' })}>✕</button>
        </div>
        {hud.hotDeal && (
          <p className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600">
            🔥 今日高价收购：{hud.hotDeal.icon} {hud.hotDeal.label}
          </p>
        )}

        <h3 className="mt-5 font-bold text-gray-700">🛒 今日商品</h3>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {hud.shopGoods.map(g => (
            <button
              key={g.id}
              onClick={() => commands.push({ type: 'buy', item: g.id, price: g.price })}
              className="flex items-center gap-3 rounded-2xl border-2 border-emerald-200 bg-white p-3 hover:bg-emerald-50 transition-colors"
            >
              <span className="text-3xl">{ITEMS[g.id]?.icon ?? g.icon}</span>
              <div className="text-left">
                <p className="font-bold text-gray-800">{ITEMS[g.id]?.name ?? g.name}</p>
                <p className="text-sm text-amber-700 font-bold">{g.price} 金币</p>
              </div>
            </button>
          ))}
        </div>

        <h3 className="mt-5 font-bold text-gray-700">🌱 种子</h3>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {SHOP_GOODS.map(g => (
            <button
              key={g.itemId}
              onClick={() => commands.push({ type: 'buy', item: g.itemId, price: g.price })}
              className="flex items-center gap-3 rounded-2xl border-2 border-emerald-200 bg-white p-3 hover:bg-emerald-50 transition-colors"
            >
              <span className="text-3xl">{ITEMS[g.itemId].icon}</span>
              <div className="text-left">
                <p className="font-bold text-gray-800">{ITEMS[g.itemId].name}</p>
                <p className="text-sm text-amber-700 font-bold">{g.price} 金币</p>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-5 flex items-center justify-between">
          <h3 className="font-bold text-gray-700">💰 出售（背包）</h3>
          <button
            onClick={() => commands.push({ type: 'sellAll' })}
            className="rounded-full bg-amber-400 px-4 py-1.5 text-sm font-bold text-white shadow hover:bg-amber-500"
          >全部卖出 +{totalValue}</button>
        </div>
        {sellable.length === 0 ? (
          <p className="mt-3 text-sm text-gray-400">背包空空如也……去摘果子、钓鱼、抓虫吧！</p>
        ) : (
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {sellable.map(([id, n]) => (
              <button
                key={id}
                onClick={() => commands.push({ type: 'sell', item: id })}
                className="flex items-center gap-2 rounded-2xl border-2 border-gray-200 bg-white p-2.5 hover:bg-amber-100 transition-colors"
              >
                <span className="text-2xl">{ITEMS[id]?.icon}</span>
                <div className="text-left">
                  <p className="text-sm font-bold text-gray-800">
                    {ITEMS[id]?.name} ×{n}
                    {hud.hotDeal && ITEMS[id]?.category === hud.hotDeal.cat && <span className="ml-1 text-red-500">🔥</span>}
                  </p>
                  <p className="text-xs text-amber-700">{priceOf(id) * n} 金币</p>
                </div>
              </button>
            ))}
          </div>
        )}
        <p className="mt-4 text-xs text-gray-400">提示：卖出会卖光该物品的全部数量</p>
      </div>
    </div>
  );
}

// 标题画面（模仿原版标题页：柔和渐变天空 + 大标题，点击进入存档选择）
function TitleScreen({ hud }: { hud: HudState }) {
  return (
    <div
      className="pointer-events-auto absolute inset-0 z-[70] flex flex-col items-center justify-center cursor-pointer"
      style={{ background: 'linear-gradient(180deg, #8ec9e8 0%, #b8e0c8 55%, #7ec88a 100%)' }}
      onClick={() => hud.titleStage === 'logo' && commands.push({ type: 'titleMenu' })}
    >
      {/* 云朵装饰 */}
      <div className="absolute top-[12%] left-[15%] text-6xl opacity-70 select-none">☁️</div>
      <div className="absolute top-[22%] right-[18%] text-5xl opacity-60 select-none">☁️</div>
      <div className="absolute bottom-[20%] left-[25%] text-4xl opacity-50 select-none">🍃</div>
      <div className="absolute bottom-[30%] right-[24%] text-4xl opacity-50 select-none">🍃</div>

      {/* 标题牌（原版风格：圆角木牌 + 描边大字） */}
      <div className="rounded-[2.5rem] border-8 border-amber-700/80 bg-amber-50/95 px-14 py-10 shadow-2xl text-center" style={{ transform: 'rotate(-1.5deg)' }}>
        <div className="text-5xl mb-2 select-none">🍃⚡🍃</div>
        <h1
          className="text-6xl font-black tracking-wider text-emerald-700"
          style={{ textShadow: '3px 3px 0 #fff, 6px 6px 0 rgba(0,80,40,0.25)' }}
        >宝可梦之森</h1>
        <p className="mt-3 text-lg font-bold text-amber-700 tracking-widest">Pokémon Crossing</p>
      </div>

      {hud.titleStage === 'logo' ? (
        <p className="mt-12 text-2xl font-bold text-white animate-pulse" style={{ textShadow: '2px 2px 0 rgba(0,0,0,0.3)' }}>
          ▶ 点击开始 ◀
        </p>
      ) : hud.titleStage === 'names' ? (
        <NameForm />
      ) : (
        <div className="mt-10 flex flex-col gap-4 w-[min(80vw,320px)]" onClick={e => e.stopPropagation()}>
          {hud.hasSave && (
            <button
              className="rounded-3xl border-4 border-emerald-600 bg-emerald-500 py-4 text-xl font-black text-white shadow-xl hover:bg-emerald-400 transition-colors"
              onClick={() => commands.push({ type: 'continueGame' })}
            >📖 读取存档</button>
          )}
          <button
            className="rounded-3xl border-4 border-amber-600 bg-amber-400 py-4 text-xl font-black text-white shadow-xl hover:bg-amber-300 transition-colors"
            onClick={() => store.patch({ titleStage: 'names' })}
          >🌱 开启新游戏</button>
          {hud.hasSave && (
            <p className="text-center text-sm font-bold text-white/90" style={{ textShadow: '1px 1px 0 rgba(0,0,0,0.3)' }}>
              开启新游戏将覆盖现有存档
            </p>
          )}
          {/* 本地文件存档：支持的浏览器授权后自动读写，不支持的用手动导出/导入 */}
          <SaveFileButtons />
        </div>
      )}
    </div>
  );
}

// 新游戏起名表单：岛名（强制以「岛」结尾，含岛最多 5 字）+ 玩家名（最多 3 字）
function NameForm() {
  const [island, setIsland] = useState('');
  const [player, setPlayer] = useState('');
  const islandFinal = island.trim() ? (island.trim().endsWith('岛') ? island.trim() : island.trim() + '岛') : '';
  const canStart = islandFinal.length > 0 && player.trim().length > 0;
  const start = () => {
    if (!canStart) return;
    localStorage.setItem('pixel-crossing-names', JSON.stringify({ island: islandFinal, player: player.trim() }));
    store.patch({ islandName: islandFinal, playerName: player.trim() });
    commands.push({ type: 'newGame' });
  };
  const inputCls = 'w-full rounded-2xl border-4 border-emerald-300 bg-white px-4 py-3 text-lg font-bold text-gray-800 outline-none focus:border-emerald-400';
  return (
    <div className="mt-8 flex w-[min(84vw,340px)] flex-col gap-4" onClick={e => e.stopPropagation()}>
      <div className="rounded-3xl bg-white/90 p-5 shadow-xl">
        <p className="text-center text-lg font-black text-emerald-700">🏝️ 给你的小岛起个名字吧！</p>
        <div className="mt-4">
          <p className="mb-1 text-sm font-bold text-gray-600">岛名</p>
          <input className={inputCls} maxLength={5} placeholder="例如：彩虹、星星、汪汪" value={island} onChange={e => setIsland(e.target.value)} />
          {island.trim() && <p className="mt-1 text-right text-sm font-bold text-emerald-600">→ {islandFinal}</p>}
        </div>
        <div className="mt-3">
          <p className="mb-1 text-sm font-bold text-gray-600">你的名字</p>
          <input className={inputCls} maxLength={3} placeholder="例如：小森" value={player} onChange={e => setPlayer(e.target.value)} />
        </div>
      </div>
      <button
        className={`rounded-3xl border-4 py-4 text-xl font-black shadow-xl transition-colors ${canStart ? 'border-amber-600 bg-amber-400 text-white hover:bg-amber-300' : 'border-gray-400 bg-gray-300 text-gray-500'}`}
        onClick={start}
      >🌱 出发！</button>
      <button className="rounded-2xl border-2 border-white/60 bg-white/20 py-2 text-sm font-bold text-white" onClick={() => store.patch({ titleStage: 'menu' })}>返回</button>
    </div>
  );
}

// 本地文件存档按钮组（标题菜单）：关联自动存档文件 / 手动导出 / 手动导入
function SaveFileButtons() {
  const SAVE_KEY = 'pixel-crossing-save-v7';
  const [supported, setSupported] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    import('../game/savefile').then(m => setSupported(m.fsaSupported));
  }, []);
  const btn = 'rounded-2xl border-2 border-white/60 bg-white/20 px-3 py-2 text-xs font-bold text-white shadow hover:bg-white/30 transition-colors';
  const doExport = () => {
    const text = localStorage.getItem(SAVE_KEY);
    if (!text) { alert('还没有存档可以导出'); return; }
    const blob = new Blob([text], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '宝可梦之森存档.json';
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const doImport = (f: File) => {
    f.text().then(text => {
      try {
        JSON.parse(text);
        localStorage.setItem(SAVE_KEY, text);
        location.reload();
      } catch { alert('这个文件不是有效的存档'); }
    });
  };
  return (
    <div className="mt-1 flex flex-col items-center gap-2">
      {supported && (
        <button className={btn} onClick={() => commands.push({ type: 'dialogAction', command: 'linkSave' })}>
          📁 关联本地存档文件（自动备份）
        </button>
      )}
      <div className="flex gap-2">
        <button className={btn} onClick={doExport}>📤 导出存档</button>
        <button className={btn} onClick={() => fileRef.current?.click()}>📥 导入存档</button>
        <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) doImport(f); }} />
      </div>
      <p className="text-[10px] text-white/70 font-bold" style={{ textShadow: '1px 1px 0 rgba(0,0,0,0.3)' }}>
        {supported ? '关联后每次存档自动写入本地文件，清缓存也不怕' : '导出存档可备份到本地文件夹，换设备用导入恢复'}
      </p>
    </div>
  );
}

function HelpPanel() {
  const rows: [string, string][] = [
    ['W A S D / 方向键', '移动'],
    ['Shift', '奔跑'],
    ['E / Enter', '互动 · 交谈 · 拾取 · 使用工具'],
    ['1 - 4', '切换工具（空手/虫网/鱼竿/铲子）'],
    ['拖动鼠标', '旋转视角'],
    ['M', '查看小岛地图'],
    ['P', '打开手机（地图/背包/图鉴）'],
    ['H', '打开/关闭帮助'],
    ['Esc', '关闭窗口'],
  ];
  return (
    <div className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-black/40 p-4" onClick={() => commands.push({ type: 'toggleHelp' })}>
      <div className="w-[min(92vw,480px)] rounded-3xl border-4 border-sky-300 bg-sky-50 p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold text-sky-800">🏝️ 小岛生活指南</h2>
        <div className="mt-3 space-y-1.5">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between rounded-xl bg-white px-3 py-1.5 text-sm">
              <span className="font-bold text-gray-700">{k}</span>
              <span className="text-gray-500">{v}</span>
            </div>
          ))}
        </div>
        <ul className="mt-4 list-disc pl-5 text-sm text-gray-600 space-y-1">
          <li>⚡ 跟着右上角的「当前目标」找喵喵推进小岛生活</li>
          <li>🌳 空手摇树掉树果和树枝，还能拔草、摘花</li>
          <li>🥅 拿虫网靠近蝴蝶蜻蜓，按 E 捕捉</li>
          <li>🎣 拿鱼竿对河面按 E 抛竿，浮漂下沉瞬间再按 E</li>
          <li>⛏️ 铲子能挖星形土坑（化石！）、敲石头（矿石！）</li>
          <li>💚 完成目标、钓鱼抓虫、卖东西都能赚积分，攒 5000 积分找喵喵还贷款，帐篷变房子！</li>
          <li>🌱 商店买树苗花种，点击背包拿在手上，对草地按 E 种植</li>
          <li>🕐 岛上的时间和现实同步，清晨有朝霞，夜晚有萤火虫</li>
          <li>💬 和小动物聊天，偶尔能收到礼物哦</li>
        </ul>
        <button className="mt-4 w-full rounded-2xl bg-sky-400 py-2 font-bold text-white hover:bg-sky-500" onClick={() => commands.push({ type: 'toggleHelp' })}>知道啦！</button>
      </div>
    </div>
  );
}

// 触屏：虚拟摇杆 + 互动键
function TouchControls() {
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    const onTouch = () => setIsTouch(true);
    window.addEventListener('touchstart', onTouch, { once: true });
    if (window.matchMedia?.('(pointer: coarse)').matches) setIsTouch(true);
    return () => window.removeEventListener('touchstart', onTouch);
  }, []);

  if (!isTouch) return null;
  return (
    <>
      <TouchLayer />
      <button
        className="pointer-events-auto absolute bottom-24 right-6 z-20 h-20 w-20 rounded-full bg-amber-400/90 text-3xl font-bold text-white shadow-lg border-4 border-amber-200 active:bg-amber-500"
        onPointerDown={e => { e.stopPropagation(); commands.push({ type: 'interactDown' }); }}
        onPointerUp={() => commands.push({ type: 'interactUp' })}
      >E</button>
    </>
  );
}

// 全屏触摸层：左下角浮动摇杆（手指落点即摇杆中心），其余区域滑动转视角
// 弹窗（对话框/商店/手机等）打开时整层禁用，否则会盖住按钮吃掉点击（手机版 5000 里程对话按钮点不动的根因）
function TouchLayer() {
  const [hud, setHud] = useState<HudState>(initialHud);
  useEffect(() => store.subscribe(setHud), []);
  const modal = !!(hud.dialog || hud.shopOpen || hud.phoneOpen || hud.mapOpen || hud.helpOpen || hud.titleStage || hud.sleepFade);
  const joyId = useRef<number | null>(null);
  const lookId = useRef<number | null>(null);
  const joyOrigin = useRef({ x: 0, y: 0 });
  const joyRender = useRef({ x: 0, y: 0 }); // 渲染用坐标（容器坐标系）
  const lookLast = useRef({ x: 0, y: 0 });
  const [joy, setJoy] = useState<{ x: number; y: number; dx: number; dy: number } | null>(null);
  const R = 46; // 摇杆半径 px

  const resetJoy = () => {
    touchInput.dx = 0; touchInput.dy = 0; touchInput.run = false;
    setJoy(null);
  };
  const resetAll = () => {
    joyId.current = null;
    lookId.current = null;
    resetJoy();
  };

  // 手机端兜底：pointerup/cancel 挂 window（弹窗遮挡/系统手势打断也能复位），
  // 页面失焦或切后台时强制重置，防止摇杆 id 卡住导致「摇杆失效」
  useEffect(() => {
    const onUp = (e: PointerEvent) => {
      if (e.pointerId === joyId.current) { joyId.current = null; resetJoy(); }
      if (e.pointerId === lookId.current) lookId.current = null;
    };
    const onHide = () => { if (document.hidden) resetAll(); };
    window.addEventListener('pointerup', onUp, true);
    window.addEventListener('pointercancel', onUp, true);
    window.addEventListener('blur', resetAll);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('pointerup', onUp, true);
      window.removeEventListener('pointercancel', onUp, true);
      window.removeEventListener('blur', resetAll);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, []);

  const endPointer = (e: React.PointerEvent) => {
    if (e.pointerId === joyId.current) {
      joyId.current = null;
      resetJoy();
    }
    if (e.pointerId === lookId.current) lookId.current = null;
  };

  return (
    <div
      className="pointer-events-auto absolute inset-0 z-10"
      style={{ touchAction: 'none', pointerEvents: modal ? 'none' : 'auto' }}
      onPointerDown={e => {
        // 容器坐标（旋转90°模式下：cx=sy, cy=屏宽-sx）
        const rot = displayState.rotate90;
        const rx = rot ? e.clientY : e.clientX;
        const ry = rot ? window.innerWidth - e.clientX : e.clientY;
        // 容器尺寸（旋转模式下宽=屏高、高=屏宽）
        const cw = rot ? window.innerHeight : window.innerWidth;
        const ch = rot ? window.innerWidth : window.innerHeight;
        // 摇杆只在屏幕左下角区域出现（左40% × 下55%），其余区域一律转视角
        const inJoyZone = rx < cw * 0.4 && ry > ch * 0.45;
        if (inJoyZone && joyId.current === null) {
          joyId.current = e.pointerId;
          joyOrigin.current = { x: e.clientX, y: e.clientY };
          joyRender.current = { x: rx, y: ry };
          setJoy({ x: rx, y: ry, dx: 0, dy: 0 });
        } else if (lookId.current === null) {
          lookId.current = e.pointerId;
          lookLast.current = { x: e.clientX, y: e.clientY };
        }
        try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* 忽略 */ }
      }}
      onPointerMove={e => {
        if (e.pointerId === joyId.current) {
          let dx = (e.clientX - joyOrigin.current.x) / R;
          let dy = (e.clientY - joyOrigin.current.y) / R;
          const l = Math.hypot(dx, dy);
          if (l > 1) { dx /= l; dy /= l; }
          // 旋转90°模式：屏幕坐标 → 游戏坐标（cx=sy, cy=-sx）
          let gdx = dx, gdy = dy;
          if (displayState.rotate90) { gdx = dy; gdy = -dx; }
          touchInput.dx = gdx; touchInput.dy = gdy;
          touchInput.run = l > 0.9;
          setJoy({ x: joyRender.current.x, y: joyRender.current.y, dx: gdx, dy: gdy });
        } else if (e.pointerId === lookId.current) {
          let lx = e.clientX - lookLast.current.x;
          let ly = e.clientY - lookLast.current.y;
          if (displayState.rotate90) { const t = lx; lx = ly; ly = -t; }
          touchInput.lookDX += lx;
          touchInput.lookDY += ly;
          lookLast.current = { x: e.clientX, y: e.clientY };
        }
      }}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      onLostPointerCapture={endPointer}
      onContextMenu={e => e.preventDefault()}
    >
      {joy && (
        <div
          className="absolute h-24 w-24 rounded-full bg-white/20 border-2 border-white/60"
          style={{ left: joy.x - 48, top: joy.y - 48 }}
        >
          <div
            className="absolute h-10 w-10 rounded-full bg-white/75 shadow"
            style={{ left: 28 + joy.dx * 30, top: 28 + joy.dy * 30 }}
          />
        </div>
      )}
    </div>
  );
}

// ---------------- 手机（参考动森 NookPhone：地图/背包/图鉴） ----------------
import { BUG_DEFS, FISH_DEFS } from '@/game/data';

type PhoneApp = 'map' | 'bag' | 'dex' | null;

function PhonePanel({ hud }: { hud: HudState }) {
  const [app, setApp] = useState<PhoneApp>(null);
  const close = () => { setApp(null); store.patch({ phoneOpen: false }); };
  const invEntries = Object.entries(hud.inventory);
  const dexSet = new Set(hud.dex);
  const apps = [
    { id: 'map' as const, icon: '🗺️', name: '地图', bg: 'bg-emerald-400' },
    { id: 'bag' as const, icon: '🎒', name: '背包', bg: 'bg-amber-400' },
    { id: 'dex' as const, icon: '📖', name: '图鉴', bg: 'bg-sky-400' },
  ];
  const dexEntries = [...BUG_DEFS.map(b => b.itemId), ...FISH_DEFS.map(f => f.itemId)];

  return (
    <div className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-black/50 p-4" onClick={close}>
      {/* 手机机身 */}
      <div
        className="relative flex flex-col rounded-[2.5rem] border-4 border-gray-600 bg-gray-800 p-3 shadow-2xl"
        style={{ width: 'min(92vw, 420px)', height: 'min(88vh, 640px)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* 屏幕 */}
        <div className="flex flex-1 flex-col overflow-hidden rounded-[1.8rem] bg-gradient-to-b from-teal-50 to-emerald-100">
          {/* 状态栏 */}
          <div className="flex items-center justify-between bg-teal-500/90 px-5 py-2 text-white">
            <span className="font-bold tabular-nums">{hud.timeText}</span>
            <span className="text-sm font-bold">🏝️ {hud.islandName}</span>
            <span className="text-sm">🔔{hud.bells >= 1000 ? `${Math.round(hud.bells / 100) / 10}k` : hud.bells}</span>
          </div>

          {!app && (
            /* 应用列表（NookPhone 图标网格） */
            <div className="flex-1 p-6">
              <div className="grid grid-cols-3 gap-5 mt-4">
                {apps.map(a => (
                  <button key={a.id} className="flex flex-col items-center gap-1.5 active:scale-95 transition-transform" onClick={() => setApp(a.id)}>
                    <span className={`flex h-16 w-16 items-center justify-center rounded-3xl ${a.bg} text-3xl shadow-md border-b-4 border-black/20`}>{a.icon}</span>
                    <span className="text-xs font-bold text-gray-700">{a.name}</span>
                  </button>
                ))}
              </div>
              <p className="mt-8 text-center text-xs text-gray-400">点击图标打开应用 · 按 Esc 收起手机</p>
            </div>
          )}

          {app && (
            <div className="flex flex-1 flex-col min-h-0">
              {/* 应用标题栏 */}
              <div className="flex items-center gap-2 px-4 py-2">
                <button className="rounded-full bg-white/80 px-3 py-1 font-bold text-teal-700 shadow hover:bg-white" onClick={() => setApp(null)}>‹ 返回</button>
                <span className="font-bold text-teal-800">{apps.find(a => a.id === app)?.icon} {apps.find(a => a.id === app)?.name}</span>
              </div>
              <div className="flex-1 overflow-auto px-4 pb-4 min-h-0">
                {app === 'map' && (
                  <div className="flex flex-col items-center gap-2">
                    <div className="rounded-2xl overflow-hidden border-2 border-emerald-300 bg-emerald-900 w-full" style={{ aspectRatio: '1' }}>
                      <MiniMap hud={hud} big />
                    </div>
                    <div className="flex flex-wrap gap-2 text-[10px] text-gray-500 justify-center">
                      <span>🟥 商店</span><span>🟪 裁缝店</span><span>🟦 博物馆</span><span>🟨 你的家</span><span>⬜ 村民家</span><span>🔴 你</span>
                    </div>
                  </div>
                )}
                {app === 'bag' && (
                  invEntries.length === 0 ? (
                    <p className="mt-10 text-center text-sm text-gray-400">背包空空如也……去外面找点好东西吧！</p>
                  ) : (
                    <div className="grid grid-cols-4 gap-2">
                      {invEntries.map(([id, n]) => {
                        const def = ITEMS[id];
                        const plantable = id === 'sapling' || id === 'seedbag';
                        return (
                          <button
                            key={id}
                            title={plantable ? '拿在手上，对草地按E种植' : def?.name}
                            onClick={() => commands.push({ type: 'selectItem', item: hud.selectedItem === id ? null : id })}
                            className={`relative flex flex-col items-center rounded-2xl bg-white p-2 shadow border-2 ${hud.selectedItem === id ? 'border-emerald-500 scale-105' : 'border-transparent'}`}
                          >
                            <span className="text-2xl">{def?.icon ?? '❔'}</span>
                            <span className="text-[10px] text-gray-600">{def?.name ?? id}</span>
                            <span className="absolute -right-1 -top-1 rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white shadow">{n}</span>
                          </button>
                        );
                      })}
                    </div>
                  )
                )}
                {app === 'dex' && (
                  <div className="flex flex-col gap-1.5">
                    <p className="text-xs text-gray-500 mb-1">已收集 {dexSet.size} / {dexEntries.length}</p>
                    {dexEntries.map(id => {
                      const got = dexSet.has(id);
                      const def = ITEMS[id];
                      return (
                        <div key={id} className={`flex items-center gap-3 rounded-2xl px-3 py-2 shadow ${got ? 'bg-white' : 'bg-gray-200/70'}`}>
                          <span className={`text-2xl ${got ? '' : 'opacity-30 grayscale'}`}>{got ? def?.icon : '❓'}</span>
                          <div>
                            <p className={`text-sm font-bold ${got ? 'text-gray-800' : 'text-gray-400'}`}>{got ? def?.name : '？？？'}</p>
                            {got && <p className="text-[10px] text-gray-400">{def?.category === 'bug' ? '🦋 昆虫' : '🐟 鱼类'} · 售价 {def?.price} 金币</p>}
                          </div>
                          {got && <span className="ml-auto text-emerald-500 font-bold">✓</span>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        {/* Home 键 */}
        <button className="mx-auto mt-2 h-8 w-8 rounded-full border-2 border-gray-500 bg-gray-700 active:bg-gray-600" onClick={close} title="收起手机" />
      </div>
    </div>
  );
}
