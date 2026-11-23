import { describe, expect, it } from 'vitest';
import { DECKS, choicesFor, comboFromEvent, isReserved, keyCaps, mastery, median, nextBox, parseCombo, pickNext, spokenCombo, summarize, type Result } from './keys';

const ev = (code: string, key: string, m: Partial<{ ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean }> = {}) => ({ code, key, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...m });

describe('capturing combos', () => {
  it('uses the physical key so Option and Shift do not change letters', () => {
    expect(comboFromEvent(ev('KeyT', '†', { metaKey: true, altKey: true }))).toBe('Alt+Meta+T');
    expect(comboFromEvent(ev('KeyT', 'T', { metaKey: true, shiftKey: true }))).toBe('Shift+Meta+T');
    expect(comboFromEvent(ev('Slash', '?', { ctrlKey: true, shiftKey: true }))).toBe('Ctrl+Shift+/');
    expect(comboFromEvent(ev('Digit1', '!', { ctrlKey: true }))).toBe('Ctrl+1');
    expect(comboFromEvent(ev('F12', 'F12'))).toBe('F12');
  });
  it('waits while only modifiers are held', () => {
    expect(comboFromEvent(ev('ShiftLeft', 'Shift', { shiftKey: true }))).toBeNull();
    expect(comboFromEvent(ev('MetaLeft', 'Meta', { metaKey: true }))).toBeNull();
  });
  it('parses typed combos into canonical order', () => {
    expect(parseCombo('shift+cmd+t')).toBe('Shift+Meta+T');
    expect(parseCombo('Option + ArrowLeft')).toBe('Alt+ArrowLeft');
    expect(parseCombo('Ctrl+A+B')).toBeNull();
    expect(parseCombo('Ctrl+')).toBeNull();
  });
  it('formats caps per platform', () => {
    expect(keyCaps('Shift+Meta+T', 'mac')).toEqual(['⇧', '⌘', 'T']);
    expect(keyCaps('Ctrl+Shift+T', 'win')).toEqual(['Ctrl', 'Shift', 'T']);
    expect(spokenCombo('Alt+Meta+ArrowRight', 'mac')).toBe('Option Command Right');
  });
  it('knows which shortcuts a page cannot capture', () => {
    expect(isReserved('Meta+W', 'mac')).toBe(true);
    expect(isReserved('Ctrl+Shift+T', 'win')).toBe(true);
    expect(isReserved('Meta+C', 'mac')).toBe(false);
  });
  it('has valid, unique combos in every deck', () => {
    for (const d of DECKS) {
      expect(new Set(d.items.map((i) => i.id)).size).toBe(d.items.length);
      for (const i of d.items) { expect(i.mac).toBeTruthy(); expect(i.win).toBeTruthy(); }
    }
  });
});

describe('spacing', () => {
  const r = (p: Partial<Result>): Result => ({ id: 'x', correct: true, firstTry: true, ms: 1000, wrong: [], ...p });
  it('moves boxes by speed and accuracy', () => {
    expect(nextBox(2, r({}))).toBe(3);
    expect(nextBox(5, r({}))).toBe(5);
    expect(nextBox(3, r({ ms: 6000 }))).toBe(3);
    expect(nextBox(3, r({ firstTry: false }))).toBe(2);
    expect(nextBox(4, r({ correct: false, firstTry: false }))).toBe(1);
  });
  it('favours weak shortcuts and avoids immediate repeats', () => {
    const counts = { a: 0, b: 0 };
    let seed = 1;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 2000; i++) counts[pickNext(['a', 'b', 'c'], { a: 1, b: 5, c: 3 }, 'c', rand) as 'a' | 'b']++;
    expect(counts.a / counts.b).toBeGreaterThan(10);
    expect(pickNext(['a'], {}, 'a')).toBe('a');
  });
  it('builds four distinct options including the answer', () => {
    const opts = choicesFor('Meta+W', ['Meta+W', 'Meta+T', 'Meta+N', 'Meta+Q', 'Meta+T'], () => 0.3);
    expect(opts).toHaveLength(4);
    expect(new Set(opts).size).toBe(4);
    expect(opts).toContain('Meta+W');
  });
});

describe('stats', () => {
  it('summarises a round', () => {
    const s = summarize([
      { id: 'a', correct: true, firstTry: true, ms: 1200, wrong: [] },
      { id: 'b', correct: true, firstTry: false, ms: 5200, wrong: ['Ctrl+X'] },
      { id: 'c', correct: false, firstTry: false, ms: 9000, wrong: ['A', 'B', 'C'] },
      { id: 'd', correct: true, firstTry: true, ms: 3400, wrong: [] },
    ]);
    expect(s).toMatchObject({ total: 4, accuracy: 50, medianMs: 3400, fastCount: 1, missed: ['b', 'c'] });
    expect(s.slowest.map((x) => x.id)).toEqual(['b', 'd', 'a']);
    expect(median([])).toBeNull();
    expect(median([1, 2, 3, 4])).toBe(3);
  });
  it('computes deck mastery from boxes', () => {
    const items = DECKS[0].items.slice(0, 4);
    expect(mastery(items, { 'text:copy': 5, 'text:paste': 4, 'text:cut': 3 }, 'text')).toBe(50);
  });
});
