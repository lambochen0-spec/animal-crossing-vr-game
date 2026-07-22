import { useEffect, useRef, useState } from 'react';
import { Game, touchInput, displayState } from './game/game';
import { GameUI } from './components/GameUI';
import { store } from './game/store';

export default function App() {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  // 外层应用不支持横屏时：竖屏状态下把游戏整体旋转90°，强制横屏显示
  const [forceRotate, setForceRotate] = useState(false);
  const [islandName, setIslandName] = useState(store.state.islandName);
  useEffect(() => store.subscribe(s => setIslandName(s.islandName)), []);

  useEffect(() => {
    const check = () => {
      // VR 头显浏览器（Quest 等）：禁用旋转逻辑，否则画布会被错误旋转导致花屏
      if (/OculusBrowser|Quest/i.test(navigator.userAgent)) { setForceRotate(false); return; }
      const coarse = window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window;
      const portrait = window.innerHeight > window.innerWidth;
      setForceRotate(coarse && portrait);
    };
    check();
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
    };
  }, []);

  useEffect(() => {
    displayState.rotate90 = forceRotate;
    // 容器尺寸变化后通知游戏重算渲染尺寸
    const t = setTimeout(() => window.dispatchEvent(new Event('resize')), 80);
    return () => clearTimeout(t);
  }, [forceRotate]);

  useEffect(() => {
    if (!ref.current) return;
    const game = new Game(ref.current);
    (window as unknown as { __game: Game }).__game = game;
    (window as unknown as { __store: typeof store }).__store = store;
    (window as unknown as { __touch: typeof touchInput }).__touch = touchInput;
    setReady(true);
    return () => game.dispose();
  }, []);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-sky-200">
      <div
        className="absolute"
        style={forceRotate ? {
          width: '100vh',
          height: '100vw',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%) rotate(90deg)',
        } : { inset: 0 }}
      >
        <div ref={ref} className="absolute inset-0" />
        {ready && <GameUI />}
        {/* 标题角标 */}
        <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-white/70 px-4 py-1 text-sm font-bold text-emerald-700 shadow">
          🏝️ {islandName} · 慢生活
        </div>
      </div>
    </div>
  );
}
