// 本地文件存档（File System Access API）：授权一次后，存档=静默写文件，读档=自动读文件
// 支持：Chrome / Edge / Quest 浏览器等 Chromium 内核；Safari/手机浏览器降级为手动导出导入

const DB_NAME = 'pixel-crossing-fsa';
const HANDLE_KEY = 'saveHandle';

type FSAHandle = FileSystemFileHandle & {
  queryPermission?: (d: { mode: string }) => Promise<string>;
  requestPermission?: (d: { mode: string }) => Promise<string>;
};

export const fsaSupported = typeof (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker === 'function';

let handle: FSAHandle | null = null;
let pendingHandle: FSAHandle | null = null; // 已授权过文件、但本次会话还需点一次重新授权

export function isLinked() { return !!handle; }
export function linkedFileName() { return handle?.name ?? pendingHandle?.name ?? null; }

// ---- IndexedDB：持久化文件句柄（句柄可序列化，重新打开浏览器仍能找回）----
function idb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('kv');
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}
async function idbGet(key: string): Promise<FSAHandle | null> {
  try {
    const db = await idb();
    return await new Promise((res) => {
      const rq = db.transaction('kv').objectStore('kv').get(key);
      rq.onsuccess = () => res((rq.result as FSAHandle) ?? null);
      rq.onerror = () => res(null);
    });
  } catch { return null; }
}
async function idbSet(key: string, val: FSAHandle) {
  try {
    const db = await idb();
    await new Promise((res) => {
      const tx = db.transaction('kv', 'readwrite');
      tx.objectStore('kv').put(val, key);
      tx.oncomplete = () => res(null);
      tx.onerror = () => res(null);
    });
  } catch { /* ignore */ }
}

// ---- 首次关联：弹出保存位置选择器（浏览器强制要求用户手势）----
export async function linkNewFile(): Promise<boolean> {
  if (!fsaSupported) return false;
  try {
    const h = await (window as unknown as { showSaveFilePicker: (o: object) => Promise<FSAHandle> }).showSaveFilePicker({
      suggestedName: '宝可梦之森存档.json',
      types: [{ description: '游戏存档', accept: { 'application/json': ['.json'] } }],
    });
    handle = h;
    pendingHandle = null;
    await idbSet(HANDLE_KEY, h);
    return true;
  } catch { return false; } // 用户取消
}

// ---- 启动时尝试恢复关联：无需手势的静默通道 ----
export async function tryRestoreLink(): Promise<'linked' | 'needGesture' | 'none' | 'unsupported'> {
  if (!fsaSupported) return 'unsupported';
  const h = await idbGet(HANDLE_KEY);
  if (!h) return 'none';
  try {
    const p = await h.queryPermission?.({ mode: 'readwrite' });
    if (p === 'granted') { handle = h; return 'linked'; }
    pendingHandle = h;
    return 'needGesture'; // 需要玩家点一下按钮重新授权
  } catch { return 'none'; }
}

// ---- 重新授权（必须来自点击等用户手势）----
export async function requestPermissionFromGesture(): Promise<boolean> {
  const h = pendingHandle;
  if (!h) return false;
  try {
    const p = await h.requestPermission?.({ mode: 'readwrite' });
    if (p === 'granted') { handle = h; pendingHandle = null; return true; }
  } catch { /* ignore */ }
  return false;
}

// ---- 写存档（覆盖写，静默；节流 1.5s 避免高频 IO）----
let lastWrite = 0;
let pendingText: string | null = null;
let writeTimer: ReturnType<typeof setTimeout> | null = null;
export function writeSave(text: string) {
  if (!handle) return;
  pendingText = text;
  const now = Date.now();
  if (now - lastWrite > 1500) flushWrite();
  else if (!writeTimer) writeTimer = setTimeout(flushWrite, 1500 - (now - lastWrite));
}
// 立即把待写入的内容刷进文件（回标题/关页面前调用，返回 Promise 等写完）
export function flushSave() { return flushWrite(); }

async function flushWrite() {
  if (writeTimer) { clearTimeout(writeTimer); writeTimer = null; }
  const h = handle, text = pendingText;
  pendingText = null;
  if (!h || text === null) return;
  lastWrite = Date.now();
  try {
    const w = await h.createWritable();
    await w.write(text);
    await w.close();
  } catch { /* 写入失败不打扰游戏，localStorage 仍是兜底 */ }
}

// ---- 读存档 ----
export async function readSave(): Promise<string | null> {
  if (!handle) return null;
  try {
    const f = await handle.getFile();
    return await f.text();
  } catch { return null; }
}
