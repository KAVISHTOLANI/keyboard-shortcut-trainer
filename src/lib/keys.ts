/* Shortcut capture, decks, spacing and stats for Keytempo. */

export type Platform = 'mac' | 'win';
export const MODS = ['Ctrl', 'Alt', 'Shift', 'Meta'] as const;
export type Mod = (typeof MODS)[number];

/** Canonical combo string, e.g. "Meta+Shift+T" or "Ctrl+Alt+ArrowUp". Modifiers in fixed order, then one key. */
export type Combo = string;

export interface KeyLike { key: string; code: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean }

const CODE_KEYS: Record<string, string> = {
  Slash: '/', Backslash: '\\', Backquote: '`', BracketLeft: '[', BracketRight: ']', Equal: '=', Minus: '-', Comma: ',', Period: '.', Semicolon: ';', Quote: "'", Space: 'Space',
  Enter: 'Enter', NumpadEnter: 'Enter', Backspace: 'Backspace', Delete: 'Delete', Tab: 'Tab', Escape: 'Escape', Home: 'Home', End: 'End', PageUp: 'PageUp', PageDown: 'PageDown',
  ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown', ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight', NumpadAdd: '=', NumpadSubtract: '-',
};

/** The physical key, so Option/Shift on a Mac don't change letters into symbols. */
export function baseKey(code: string, key: string): string | null {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  if (/^F([1-9]|1[0-2])$/.test(code)) return code;
  if (CODE_KEYS[code]) return CODE_KEYS[code];
  if (['Control', 'Meta', 'Alt', 'Shift', 'CapsLock', 'Fn', 'OS'].includes(key)) return null;
  return key.length === 1 ? key.toUpperCase() : key || null;
}

/** Turns a keydown into a combo, or null while only modifiers are held. */
export function comboFromEvent(e: KeyLike): Combo | null {
  const k = baseKey(e.code, e.key);
  if (!k) return null;
  const mods: Mod[] = [];
  if (e.ctrlKey) mods.push('Ctrl');
  if (e.altKey) mods.push('Alt');
  if (e.shiftKey) mods.push('Shift');
  if (e.metaKey) mods.push('Meta');
  return [...mods, k].join('+');
}

/** Normalises typed or stored combos ("shift+cmd+t" → "Shift+Meta+T"). Returns null if invalid. */
export function parseCombo(text: string): Combo | null {
  const parts = text.split('+').map((p) => p.trim()).filter(Boolean);
  if (!parts.length) return null;
  const alias: Record<string, Mod> = { ctrl: 'Ctrl', control: 'Ctrl', alt: 'Alt', option: 'Alt', opt: 'Alt', shift: 'Shift', cmd: 'Meta', command: 'Meta', meta: 'Meta', win: 'Meta', super: 'Meta' };
  const mods = new Set<Mod>();
  let key: string | null = null;
  for (const p of parts) {
    const m = alias[p.toLowerCase()];
    if (m) { mods.add(m); continue; }
    if (key) return null;
    key = p.length === 1 ? p.toUpperCase() : p[0].toUpperCase() + p.slice(1);
  }
  if (!key) return null;
  return [...MODS.filter((m) => mods.has(m)), key].join('+');
}

const MAC_SYM: Record<string, string> = { Ctrl: '⌃', Alt: '⌥', Shift: '⇧', Meta: '⌘', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Enter: '↩', Backspace: '⌫', Delete: '⌦', Escape: 'esc', Tab: '⇥', Space: 'Space' };
const WIN_NAME: Record<string, string> = { Meta: 'Win', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Escape: 'Esc' };
/** Key caps for display; Mac shows symbols in Apple's order (⌃⌥⇧⌘). */
export function keyCaps(combo: Combo, platform: Platform): string[] {
  const parts = combo.split('+');
  return platform === 'mac' ? parts.map((p) => MAC_SYM[p] ?? p) : parts.map((p) => WIN_NAME[p] ?? p);
}
/** Readable label for screen readers, e.g. "Command Shift T". */
export function spokenCombo(combo: Combo, platform: Platform): string {
  const names: Record<string, string> = platform === 'mac' ? { Meta: 'Command', Alt: 'Option', Ctrl: 'Control' } : { Meta: 'Windows', Ctrl: 'Control' };
  return combo.split('+').map((p) => names[p] ?? p.replace(/^Arrow/, '') ).join(' ');
}

export interface Shortcut { id: string; action: string; mac: Combo; win: Combo; tip?: string }
export interface Deck { id: string; name: string; blurb: string; items: Shortcut[] }

const s = (id: string, action: string, mac: string, win: string, tip?: string): Shortcut => ({ id, action, mac: parseCombo(mac)!, win: parseCombo(win)!, tip });
export const DECKS: Deck[] = [
  { id: 'text', name: 'Text editing', blurb: 'Works in almost every app.', items: [
    s('copy', 'Copy', 'Cmd+C', 'Ctrl+C'), s('paste', 'Paste', 'Cmd+V', 'Ctrl+V'), s('cut', 'Cut', 'Cmd+X', 'Ctrl+X'),
    s('undo', 'Undo', 'Cmd+Z', 'Ctrl+Z'), s('redo', 'Redo', 'Cmd+Shift+Z', 'Ctrl+Y', 'Ctrl+Shift+Z also works in many Windows apps.'),
    s('all', 'Select all', 'Cmd+A', 'Ctrl+A'), s('find', 'Find', 'Cmd+F', 'Ctrl+F'), s('save', 'Save', 'Cmd+S', 'Ctrl+S'),
    s('bold', 'Bold', 'Cmd+B', 'Ctrl+B'), s('italic', 'Italic', 'Cmd+I', 'Ctrl+I'),
    s('wordleft', 'Move one word left', 'Alt+ArrowLeft', 'Ctrl+ArrowLeft'), s('linestart', 'Go to start of line', 'Cmd+ArrowLeft', 'Home'),
    s('docend', 'Go to end of document', 'Cmd+ArrowDown', 'Ctrl+End'), s('delword', 'Delete previous word', 'Alt+Backspace', 'Ctrl+Backspace'),
  ] },
  { id: 'browser', name: 'Web browser', blurb: 'Chrome, Edge, Firefox and Safari.', items: [
    s('newtab', 'Open a new tab', 'Cmd+T', 'Ctrl+T'), s('closetab', 'Close the tab', 'Cmd+W', 'Ctrl+W'), s('reopen', 'Reopen closed tab', 'Cmd+Shift+T', 'Ctrl+Shift+T'),
    s('nexttab', 'Next tab', 'Cmd+Alt+ArrowRight', 'Ctrl+Tab'), s('address', 'Focus the address bar', 'Cmd+L', 'Ctrl+L'), s('reload', 'Reload', 'Cmd+R', 'Ctrl+R'),
    s('hardreload', 'Reload ignoring cache', 'Cmd+Shift+R', 'Ctrl+Shift+R'), s('zoomin', 'Zoom in', 'Cmd+=', 'Ctrl+='), s('zoomreset', 'Reset zoom', 'Cmd+0', 'Ctrl+0'),
    s('back', 'Go back', 'Cmd+[', 'Alt+ArrowLeft'), s('bookmark', 'Bookmark the page', 'Cmd+D', 'Ctrl+D'), s('devtools', 'Open developer tools', 'Cmd+Alt+I', 'Ctrl+Shift+I'),
    s('private', 'New private window', 'Cmd+Shift+N', 'Ctrl+Shift+N', 'Firefox uses Shift+P instead of Shift+N.'), s('tab1', 'Jump to the first tab', 'Cmd+1', 'Ctrl+1'),
  ] },
  { id: 'code', name: 'VS Code', blurb: 'Default keybindings.', items: [
    s('palette', 'Command palette', 'Cmd+Shift+P', 'Ctrl+Shift+P'), s('quickopen', 'Quick open a file', 'Cmd+P', 'Ctrl+P'), s('terminal', 'Toggle the terminal', 'Ctrl+`', 'Ctrl+`'),
    s('comment', 'Toggle line comment', 'Cmd+/', 'Ctrl+/'), s('gotoline', 'Go to line', 'Ctrl+G', 'Ctrl+G'), s('nextmatch', 'Add next match to selection', 'Cmd+D', 'Ctrl+D'),
    s('moveline', 'Move line up', 'Alt+ArrowUp', 'Alt+ArrowUp'), s('copyline', 'Copy line down', 'Shift+Alt+ArrowDown', 'Shift+Alt+ArrowDown'), s('sidebar', 'Toggle the sidebar', 'Cmd+B', 'Ctrl+B'),
    s('rename', 'Rename symbol', 'F2', 'F2'), s('definition', 'Go to definition', 'F12', 'F12'), s('format', 'Format document', 'Shift+Alt+F', 'Shift+Alt+F'),
    s('search', 'Search in all files', 'Cmd+Shift+F', 'Ctrl+Shift+F'), s('split', 'Split the editor', 'Cmd+\\', 'Ctrl+\\'),
  ] },
];

/** Shortcuts a web page can't intercept: the browser or OS acts first, so these are asked as multiple choice. */
const RESERVED: Record<Platform, Combo[]> = {
  mac: ['Meta+T', 'Meta+W', 'Meta+N', 'Meta+Q', 'Meta+H', 'Meta+M', 'Shift+Meta+T', 'Shift+Meta+N', 'Meta+Tab', 'Alt+Meta+ArrowRight', 'Alt+Meta+ArrowLeft'],
  win: ['Ctrl+T', 'Ctrl+W', 'Ctrl+N', 'Ctrl+Shift+T', 'Ctrl+Shift+N', 'Ctrl+Shift+W', 'Ctrl+Tab', 'Ctrl+Shift+Tab', 'Alt+F4', 'Meta+D', 'Meta+L'],
};
export const isReserved = (combo: Combo, platform: Platform) => RESERVED[platform].includes(combo);
export const comboFor = (item: Shortcut, platform: Platform) => (platform === 'mac' ? item.mac : item.win);

/* ---------- Spacing (Leitner boxes 1–5) ---------- */
export interface Result { id: string; correct: boolean; firstTry: boolean; ms: number; wrong: Combo[] }
export const FAST_MS = 3000;
/** Up one box for a quick first-try answer, stays for a slow or second-try one, back to box 1 for a miss. */
export function nextBox(box: number, r: Result): number {
  if (!r.correct) return 1;
  if (r.firstTry && r.ms <= FAST_MS) return Math.min(5, box + 1);
  if (r.firstTry) return box;
  return Math.max(1, box - 1);
}
/** Weighted pick favouring low boxes (box 1 is 16× as likely as box 5); never repeats `last` when there's a choice. */
export function pickNext(ids: string[], boxes: Record<string, number>, last: string | null, rand: () => number = Math.random): string {
  const pool = ids.length > 1 ? ids.filter((id) => id !== last) : ids;
  const w = pool.map((id) => 2 ** (5 - (boxes[id] ?? 1)));
  let r = rand() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) { r -= w[i]; if (r < 0) return pool[i]; }
  return pool[pool.length - 1];
}
/** Four answer options for a reserved shortcut: the right combo and three distinct others from the pool. */
export function choicesFor(answer: Combo, pool: Combo[], rand: () => number = Math.random): Combo[] {
  const others = [...new Set(pool.filter((c) => c !== answer))];
  for (let i = others.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [others[i], others[j]] = [others[j], others[i]]; }
  const opts = [answer, ...others.slice(0, 3)];
  for (let i = opts.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [opts[i], opts[j]] = [opts[j], opts[i]]; }
  return opts;
}

/* ---------- Stats ---------- */
export interface Summary { total: number; accuracy: number; medianMs: number | null; fastCount: number; slowest: Result[]; missed: string[] }
export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const a = [...xs].sort((p, q) => p - q), m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : Math.round((a[m - 1] + a[m]) / 2);
}
export function summarize(results: Result[]): Summary {
  const first = results.filter((r) => r.firstTry && r.correct);
  const correct = results.filter((r) => r.correct);
  return {
    total: results.length,
    accuracy: results.length ? Math.round((first.length / results.length) * 100) : 0,
    medianMs: median(correct.map((r) => r.ms)),
    fastCount: first.filter((r) => r.ms <= FAST_MS).length,
    slowest: [...correct].sort((a, b) => b.ms - a.ms).slice(0, 3),
    missed: [...new Set(results.filter((r) => !r.firstTry || !r.correct).map((r) => r.id))],
  };
}
export const formatMs = (ms: number | null) => (ms == null ? '—' : `${(ms / 1000).toFixed(1)} s`);

export interface Session { id: string; date: string; deck: string; platform: Platform; total: number; accuracy: number; medianMs: number | null; demo?: boolean }
/** Mastery: share of a deck's shortcuts in box 4 or 5. */
export function mastery(items: Shortcut[], boxes: Record<string, number>, deck: string): number {
  if (!items.length) return 0;
  return Math.round((items.filter((i) => (boxes[`${deck}:${i.id}`] ?? 1) >= 4).length / items.length) * 100);
}
