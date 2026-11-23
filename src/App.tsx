import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { DemoTag, EmptyState, Field, Landing, NotFound, Notice, PageHead, Shell, uid, useFlash, usePersistentState, useRoute } from './shared/ui';
import { addDays, formatDay, todayISO } from './shared/dates';
import {
  DECKS, FAST_MS, choicesFor, comboFor, comboFromEvent, formatMs, isReserved, keyCaps, mastery, nextBox, parseCombo, pickNext, spokenCombo, summarize,
  type Combo, type Deck, type Platform, type Result, type Session, type Shortcut,
} from './lib/keys';

const KEY = 'keytempo:store';
const NAV = [
  { to: '/', label: 'Overview' },
  { to: '/practice', label: 'Practice' },
  { to: '/decks', label: 'Decks' },
  { to: '/progress', label: 'Progress' },
];

interface Store {
  platform: Platform;
  deck: string;
  length: number;
  boxes: Record<string, number>;
  history: Session[];
  custom: Shortcut[];
}

const detectPlatform = (): Platform => (typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? 'mac' : 'win');

function demoStore(): Store {
  const t = todayISO();
  const hist: [number, string, number, number, number][] = [[-13, 'text', 10, 50, 3900], [-11, 'text', 10, 60, 3300], [-8, 'browser', 10, 40, 4600], [-6, 'text', 20, 75, 2500], [-3, 'browser', 10, 60, 3100], [-1, 'text', 20, 85, 1900]];
  return {
    platform: detectPlatform(),
    deck: 'text',
    length: 10,
    boxes: { 'text:copy': 5, 'text:paste': 5, 'text:cut': 4, 'text:undo': 4, 'text:all': 4, 'text:save': 3, 'text:find': 3, 'text:redo': 2, 'browser:reload': 3, 'browser:newtab': 4, 'browser:reopen': 2 },
    history: hist.map(([d, deck, total, accuracy, medianMs]) => ({ id: uid('s'), date: addDays(t, d), deck, platform: detectPlatform(), total, accuracy, medianMs, demo: true })),
    custom: [{ id: 'c1', action: 'Toggle dark mode (example)', mac: 'Shift+Meta+L', win: 'Shift+Meta+L' }],
  };
}

export default function App() {
  const [route] = useRoute();
  const [store, setStore] = usePersistentState<Store>(KEY, demoStore);
  const decks = useMemo<Deck[]>(() => [...DECKS, { id: 'custom', name: 'My shortcuts', blurb: 'Shortcuts you add yourself.', items: store.custom }], [store.custom]);
  const ctx = { store, setStore, decks };
  let page: ReactNode;
  if (route === '/') page = <Home />;
  else if (route === '/practice') page = <Practice {...ctx} />;
  else if (route === '/decks') page = <Decks {...ctx} />;
  else if (route === '/progress') page = <Progress {...ctx} />;
  else page = <NotFound />;
  return (
    <Shell name="Keytempo" wordmark={['Key', 'tempo']} nav={NAV} route={route} cta={{ to: '/practice', label: 'Start practising' }} footerNote="Practice stays in this browser. Shortcuts are app defaults and may differ with your settings or keyboard layout.">
      {page}
    </Shell>
  );
}

type Ctx = { store: Store; setStore: (s: Store | ((s: Store) => Store)) => void; decks: Deck[] };

function Caps({ combo, platform, big = false }: { combo: Combo; platform: Platform; big?: boolean }) {
  return (
    <span className={`caps ${big ? 'big' : ''}`} aria-label={spokenCombo(combo, platform)} role="img">
      {keyCaps(combo, platform).map((k, i) => <kbd key={i}>{k}</kbd>)}
    </span>
  );
}

/* ---------- Home ---------- */
function HeroPreview() {
  return (
    <div className="hero-kt">
      <div className="kt-progress" aria-hidden="true"><i style={{ width: '70%' }} /></div>
      <p className="kt-count small mono">7 / 10 · Web browser</p>
      <p className="kt-prompt">Reopen closed tab</p>
      <span className="caps big hero-caps" aria-label="Command Shift T" role="img"><kbd style={{ ['--k' as string]: 0 }}>⇧</kbd><kbd style={{ ['--k' as string]: 1 }}>⌘</kbd><kbd style={{ ['--k' as string]: 2 }}>T</kbd></span>
      <p className="kt-ok"><span className="badge badge-ok">First try</span> <span className="mono">1.4 s</span></p>
      <div className="kt-mini">
        <span><b>85%</b> accuracy</span><span><b>1.9 s</b> median</span><span><b>12</b> mastered</span>
      </div>
    </div>
  );
}

function Home() {
  return (
    <Landing
      eyebrow="Keyboard shortcut trainer"
      title={<>Stop reaching <em>for the mouse.</em></>}
      lead="Short timed drills for the shortcuts you use every day. Press the real keys, get instant feedback, and let spaced repetition bring back the ones you keep missing."
      primary={{ href: '#/practice', label: 'Start practising' }}
      secondary={{ href: '#/decks', label: 'Browse decks' }}
      previewLabel="Practice round"
      preview={<HeroPreview />}
      meta={['Mac and Windows', 'No account', 'Demo history included']}
      steps={[
        { title: 'Pick a deck', body: 'Text editing, web browser, VS Code — or your own shortcuts.' },
        { title: 'Press the keys', body: 'Each prompt names an action; press the combo. Three tries, then the answer is shown.' },
        { title: 'Watch the tempo', body: 'Accuracy and median time per round, with weak shortcuts coming back more often.' },
      ]}
      features={[
        { title: 'Real key capture', body: 'Reads the physical key, so ⌥ and ⇧ never turn letters into symbols.' },
        { title: 'Browser-safe', body: 'Shortcuts the browser won’t release (like closing a tab) are asked as multiple choice instead.' },
        { title: 'Spaced repetition', body: 'Five Leitner boxes: quick first-try answers move up, misses go back to box 1.' },
        { title: 'Your own deck', body: 'Record shortcuts from any app with a key recorder and drill them too.' },
      ]}
      closing={{ title: <>Ten prompts. <em>About a minute.</em></>, action: { href: '#/practice', label: 'Start a round' } }}
    />
  );
}

/* ---------- Practice ---------- */
interface Round { deck: Deck; ids: string[]; length: number; results: Result[]; current: string; started: number; wrong: Combo[]; status: 'ask' | 'right' | 'reveal'; choices: Combo[] | null }

function Practice({ store, setStore, decks }: Ctx) {
  const [round, setRound] = useState<Round | null>(null);
  const [done, setDone] = useState<{ results: Result[]; deck: Deck } | null>(null);
  const [now, setNow] = useState(0);
  const [live, setLive] = useState('');
  const area = useRef<HTMLDivElement>(null);
  const advanceTimer = useRef<number | undefined>(undefined);
  const latest = useRef(store);
  latest.current = store;
  const deck = decks.find((d) => d.id === store.deck) ?? decks[0];
  const p = store.platform;
  const keyOf = (d: Deck, id: string) => `${d.id}:${id}`;

  useEffect(() => {
    if (!round || round.status !== 'ask') return;
    const t = window.setInterval(() => setNow(performance.now()), 100);
    return () => window.clearInterval(t);
  }, [round]);
  useEffect(() => () => window.clearTimeout(advanceTimer.current), []);
  useEffect(() => { if (round?.status === 'ask' && !round.choices) area.current?.focus(); }, [round?.current, round?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  function makeAsk(d: Deck, id: string): Pick<Round, 'current' | 'started' | 'wrong' | 'status' | 'choices'> {
    const item = d.items.find((i) => i.id === id)!;
    const target = comboFor(item, p);
    const pool = [...d.items, ...DECKS.flatMap((x) => x.items)].map((i) => comboFor(i, p));
    return { current: id, started: performance.now(), wrong: [], status: 'ask', choices: isReserved(target, p) ? choicesFor(target, pool) : null };
  }
  function start(ids?: string[], length?: number) {
    const pool = ids ?? deck.items.map((i) => i.id);
    if (!pool.length) return;
    const boxes = Object.fromEntries(pool.map((id) => [id, store.boxes[keyOf(deck, id)] ?? 1]));
    const first = pickNext(pool, boxes, null);
    setDone(null);
    setRound({ deck, ids: pool, length: length ?? store.length, results: [], ...makeAsk(deck, first) });
    setLive('');
  }
  function finish(r: Round, results: Result[]) {
    const s = summarize(results);
    setStore((st) => ({ ...st, history: [...st.history, { id: uid('s'), date: todayISO(), deck: r.deck.id, platform: p, total: s.total, accuracy: s.accuracy, medianMs: s.medianMs }] }));
    setRound(null);
    setDone({ results, deck: r.deck });
  }
  function record(r: Round, correct: boolean, wrong: Combo[]) {
    const ms = Math.round(performance.now() - r.started);
    const res: Result = { id: r.current, correct, firstTry: correct && wrong.length === 0, ms, wrong };
    const k = keyOf(r.deck, r.current);
    setStore((st) => ({ ...st, boxes: { ...st.boxes, [k]: nextBox(st.boxes[k] ?? 1, res) } }));
    const item = r.deck.items.find((i) => i.id === r.current)!;
    const next: Round = { ...r, wrong, results: [...r.results, res], status: correct ? 'right' : 'reveal' };
    setRound(next);
    setLive(correct ? `Correct, ${formatMs(ms)}.` : `The answer is ${spokenCombo(comboFor(item, p), p)}. Press Enter to continue.`);
    if (correct) advanceTimer.current = window.setTimeout(() => advance(next), 650);
  }
  function advance(r: Round) {
    window.clearTimeout(advanceTimer.current);
    if (r.results.length >= r.length) return finish(r, r.results);
    const boxes = Object.fromEntries(r.ids.map((id) => [id, latest.current.boxes[keyOf(r.deck, id)] ?? 1]));
    setRound((cur) => (cur ? { ...cur, results: r.results, ...makeAsk(r.deck, pickNext(r.ids, boxes, r.current)) } : cur));
  }
  function answer(r: Round, combo: Combo) {
    const item = r.deck.items.find((i) => i.id === r.current)!;
    if (combo === comboFor(item, p)) return record(r, true, r.wrong);
    const wrong = [...r.wrong, combo];
    const limit = r.choices ? 2 : 3;
    if (wrong.length >= limit) return record(r, false, wrong);
    setRound({ ...r, wrong });
    setLive(`Not quite: you pressed ${spokenCombo(combo, p)}. ${limit - wrong.length} ${limit - wrong.length === 1 ? 'try' : 'tries'} left.`);
  }
  function onKey(e: React.KeyboardEvent) {
    if (!round) return;
    if (e.key === 'Escape' && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); return round.results.length ? finish(round, round.results) : setRound(null); }
    if (round.status !== 'ask') {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); advance(round); }
      return;
    }
    if (round.choices) return;
    const combo = comboFromEvent(e);
    if (!combo) return;
    e.preventDefault();
    e.stopPropagation();
    answer(round, combo);
  }

  if (done) return <RoundSummary done={done} platform={p} onAgain={() => start()} onMissed={(ids) => start(ids, Math.min(10, ids.length * 2))} />;

  if (!round) {
    return (
      <div className="stack">
        <PageHead eyebrow="Practice" title={<>Ready when <em>you are.</em></>} description="Each round asks for actions one at a time. Press the shortcut with the practice area focused. Escape ends the round early." />
        <div className="card stack">
          <div className="filters plain">
            <Field label="Deck">{(pr) => <select {...pr} value={deck.id} onChange={(e) => setStore({ ...store, deck: e.target.value })}>{decks.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.items.length})</option>)}</select>}</Field>
            <Field label="Round length">{(pr) => <select {...pr} value={store.length} onChange={(e) => setStore({ ...store, length: Number(e.target.value) })}><option value={5}>5 prompts</option><option value={10}>10 prompts</option><option value={20}>20 prompts</option></select>}</Field>
            <div className="field"><span className="label">Keyboard</span>
              <div className="tabs" role="radiogroup" aria-label="Keyboard">
                <button type="button" role="radio" aria-checked={p === 'mac'} onClick={() => setStore({ ...store, platform: 'mac' })}>Mac</button>
                <button type="button" role="radio" aria-checked={p === 'win'} onClick={() => setStore({ ...store, platform: 'win' })}>Windows / Linux</button>
              </div>
            </div>
          </div>
          {deck.items.length ? (
            <div className="row-between">
              <p className="small muted">{deck.blurb} Mastered: {mastery(deck.items, store.boxes, deck.id)}%.</p>
              <button type="button" className="btn btn-primary btn-lg" onClick={() => start()}>Start round</button>
            </div>
          ) : <EmptyState title="This deck is empty" actions={<a className="btn" href="#/decks">Add shortcuts</a>}>Add your own shortcuts on the Decks page first.</EmptyState>}
        </div>
        <Notice kind="info">Some shortcuts — like closing or opening tabs — are kept by the browser and can’t be pressed here. Those are asked as multiple choice.</Notice>
      </div>
    );
  }

  const item = round.deck.items.find((i) => i.id === round.current)!;
  const target = comboFor(item, p);
  const elapsed = round.status === 'ask' ? Math.max(0, now - round.started) : round.results[round.results.length - 1]?.ms ?? 0;
  const n = round.results.length + (round.status === 'ask' ? 1 : 0);
  return (
    <div className="stack">
      <div className="row-between">
        <p className="eyebrow">{round.deck.name} · {p === 'mac' ? 'Mac' : 'Windows / Linux'}</p>
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => (round.results.length ? finish(round, round.results) : setRound(null))}>End round</button>
      </div>
      <div className="kt-progress" role="progressbar" aria-label="Round progress" aria-valuemin={0} aria-valuemax={round.length} aria-valuenow={round.results.length}><i style={{ width: `${(round.results.length / round.length) * 100}%` }} /></div>
      <div
        ref={area}
        className={`practice card status-${round.status} ${round.wrong.length && round.status === 'ask' ? 'shake' : ''}`}
        tabIndex={0}
        role="group"
        aria-label={`Prompt ${n} of ${round.length}: ${item.action}. ${round.choices ? 'Choose the shortcut.' : 'Press the shortcut.'}`}
        onKeyDown={onKey}
        data-testid="practice"
      >
        <p className="small mono muted">{n} / {round.length}</p>
        <p className="kt-prompt" data-testid="prompt">{item.action}</p>
        {round.status === 'ask' && !round.choices && <p className="hint-line">Press the keys now <span className="mono timer">{formatMs(elapsed)}</span></p>}
        {round.status === 'ask' && round.choices && (
          <div className="choices" role="group" aria-label="Choose the shortcut">
            {round.choices.map((c) => <button key={c} type="button" className="choice" disabled={round.wrong.includes(c)} onClick={() => answer(round, c)}><Caps combo={c} platform={p} /></button>)}
          </div>
        )}
        {round.wrong.length > 0 && round.status === 'ask' && <p className="wrong small">You pressed <Caps combo={round.wrong[round.wrong.length - 1]} platform={p} /> — try again.</p>}
        {round.status === 'right' && <p className="feedback ok"><Caps combo={target} platform={p} big /> <span className="badge badge-ok">{round.wrong.length ? 'Got it' : elapsed <= FAST_MS ? 'First try — fast' : 'First try'}</span> <span className="mono">{formatMs(elapsed)}</span></p>}
        {round.status === 'reveal' && (
          <div className="feedback miss stack">
            <p>The shortcut is <Caps combo={target} platform={p} big /></p>
            {item.tip && <p className="small muted">{item.tip}</p>}
            <div><button type="button" className="btn btn-primary" onClick={() => advance(round)}>Next <kbd className="inline">Enter</kbd></button></div>
          </div>
        )}
        {round.status === 'ask' && <div><button type="button" className="btn btn-sm btn-ghost" onClick={() => record(round, false, round.wrong)}>Show answer</button></div>}
      </div>
      <p className="sr-only" role="status" aria-live="assertive">{live}</p>
    </div>
  );
}

function RoundSummary({ done, platform, onAgain, onMissed }: { done: { results: Result[]; deck: Deck }; platform: Platform; onAgain: () => void; onMissed: (ids: string[]) => void }) {
  const s = summarize(done.results);
  const name = (id: string) => done.deck.items.find((i) => i.id === id);
  return (
    <div className="stack">
      <PageHead eyebrow="Round complete" title={<>{s.accuracy >= 80 ? 'Nicely' : s.accuracy >= 50 ? 'Getting' : 'Keep'} <em>{s.accuracy >= 80 ? 'done.' : s.accuracy >= 50 ? 'there.' : 'going.'}</em></>} description={`${done.deck.name} · ${s.total} prompts`} actions={<><button type="button" className="btn btn-primary" onClick={onAgain}>New round</button>{s.missed.length > 0 && <button type="button" className="btn" onClick={() => onMissed(s.missed)}>Practise the {s.missed.length} missed</button>}</>} />
      <div className="stats">
        <div className="stat"><span className="stat-label">First-try accuracy</span><span className="stat-value" data-testid="accuracy">{s.accuracy}%</span></div>
        <div className="stat"><span className="stat-label">Median time</span><span className="stat-value">{formatMs(s.medianMs)}</span></div>
        <div className="stat"><span className="stat-label">Under {FAST_MS / 1000} s</span><span className="stat-value">{s.fastCount}</span></div>
      </div>
      <div className="table-wrap card flush">
        <table className="table">
          <caption className="sr-only">Results for each prompt</caption>
          <thead><tr><th scope="col">Action</th><th scope="col">Shortcut</th><th scope="col">Your wrong presses</th><th scope="col" className="num">Time</th><th scope="col">Result</th></tr></thead>
          <tbody>{done.results.map((r, i) => {
            const it = name(r.id)!;
            return (
              <tr key={i}>
                <th scope="row">{it.action}</th>
                <td><Caps combo={comboFor(it, platform)} platform={platform} /></td>
                <td>{r.wrong.length ? r.wrong.map((w, j) => <Caps key={j} combo={w} platform={platform} />) : <span className="muted">—</span>}</td>
                <td className="num">{formatMs(r.ms)}</td>
                <td><span className={`badge ${!r.correct ? 'badge-err' : r.firstTry ? 'badge-ok' : 'badge-warn'}`}>{!r.correct ? 'Missed' : r.firstTry ? 'First try' : 'Retry'}</span></td>
              </tr>
            );
          })}</tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- Decks ---------- */
function Boxes({ n }: { n: number }) {
  return <span className="boxes" role="img" aria-label={`Box ${n} of 5`}>{[1, 2, 3, 4, 5].map((i) => <i key={i} className={i <= n ? 'on' : ''} />)}</span>;
}

function Decks({ store, setStore, decks }: Ctx) {
  const [tab, setTab] = useState(store.deck);
  const [q, setQ] = useState('');
  const deck = decks.find((d) => d.id === tab) ?? decks[0];
  const p = store.platform;
  const rows = deck.items.filter((i) => !q.trim() || i.action.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div className="stack">
      <PageHead eyebrow="Decks" title={<>What’s <em>on the menu.</em></>} description={`Shown for ${p === 'mac' ? 'Mac' : 'Windows / Linux'} — switch on the Practice page.`} />
      <div className="tabs" role="tablist" aria-label="Decks">
        {decks.map((d) => <button key={d.id} type="button" role="tab" aria-selected={d.id === deck.id} aria-checked={d.id === deck.id} onClick={() => setTab(d.id)}>{d.name}</button>)}
      </div>
      <div className="card filters">
        <Field label="Filter actions" className="grow">{(pr) => <input {...pr} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. tab" />}</Field>
        <div className="field"><span className="label">Mastered</span><span className="display-num">{mastery(deck.items, store.boxes, deck.id)}%</span></div>
        <button type="button" className="btn btn-primary" disabled={!deck.items.length} onClick={() => { setStore({ ...store, deck: deck.id }); window.location.hash = '/practice'; }}>Practise this deck</button>
      </div>
      {deck.id === 'custom' && <CustomForm store={store} setStore={setStore} />}
      {rows.length ? (
        <div className="table-wrap card flush">
          <table className="table">
            <caption className="sr-only">{deck.name} shortcuts</caption>
            <thead><tr><th scope="col">Action</th><th scope="col">Shortcut</th><th scope="col">Box</th>{deck.id === 'custom' && <th scope="col"><span className="sr-only">Remove</span></th>}</tr></thead>
            <tbody>{rows.map((i) => {
              const c = comboFor(i, p);
              return (
                <tr key={i.id}>
                  <th scope="row">{i.action}{isReserved(c, p) && <span className="badge">Multiple choice</span>}{i.tip && <span className="small muted block">{i.tip}</span>}</th>
                  <td><Caps combo={c} platform={p} /></td>
                  <td><Boxes n={store.boxes[`${deck.id}:${i.id}`] ?? 1} /></td>
                  {deck.id === 'custom' && <td><button type="button" className="btn btn-sm btn-ghost" aria-label={`Remove ${i.action}`} onClick={() => setStore({ ...store, custom: store.custom.filter((x) => x.id !== i.id) })}>Remove</button></td>}
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      ) : <EmptyState title={deck.items.length ? 'No matching actions' : 'No shortcuts yet'}>{deck.items.length ? 'Try another word.' : 'Record one above to start your own deck.'}</EmptyState>}
    </div>
  );
}

function CustomForm({ store, setStore }: Pick<Ctx, 'store' | 'setStore'>) {
  const [action, setAction] = useState('');
  const [combo, setCombo] = useState<Combo | null>(null);
  const [typed, setTyped] = useState('');
  const [errors, setErrors] = useState<{ action?: string; combo?: string }>({});
  const [flash, setFlash] = useFlash();
  const p = store.platform;
  function submit(e: React.FormEvent) {
    e.preventDefault();
    const c = combo ?? (typed.trim() ? parseCombo(typed) : null);
    const errs: typeof errors = {};
    if (!action.trim()) errs.action = 'Name the action.';
    if (!c) errs.combo = typed.trim() ? 'Couldn’t read that — use a form like Ctrl+Shift+K.' : 'Record or type a shortcut.';
    else if (store.custom.some((x) => comboFor(x, p) === c)) errs.combo = 'That shortcut is already in your deck.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setStore({ ...store, custom: [...store.custom, { id: uid('c'), action: action.trim().slice(0, 80), mac: c!, win: c! }] });
    setFlash({ kind: 'success', text: `Added “${action.trim()}”${isReserved(c!, p) ? ' — the browser keeps this one, so it’ll be multiple choice' : ''}.` });
    setAction(''); setCombo(null); setTyped('');
  }
  return (
    <form className="card stack" onSubmit={submit} noValidate>
      <h2 className="h3">Add a shortcut</h2>
      {flash && <Notice kind={flash.kind} onDismiss={() => setFlash(null)}>{flash.text}</Notice>}
      <div className="form-grid two">
        <Field label="Action" error={errors.action}>{(pr) => <input {...pr} value={action} onChange={(e) => setAction(e.target.value)} placeholder="e.g. Toggle dark mode" />}</Field>
        <Field label="Shortcut" error={errors.combo} hint="Focus the box and press the keys, or type it below.">{(pr) => (
          <div {...pr} className={`recorder ${combo ? 'has' : ''}`} tabIndex={0} role="textbox" aria-readonly="true" aria-label={combo ? `Recorded ${spokenCombo(combo, p)}` : 'Shortcut recorder, focus and press keys'}
            onKeyDown={(e) => { if (e.key === 'Tab' && !e.ctrlKey && !e.metaKey && !e.altKey) return; const c = comboFromEvent(e); if (!c) return; e.preventDefault(); if (c === 'Backspace' && combo) return setCombo(null); setCombo(c); setTyped(''); }}>
            {combo ? <Caps combo={combo} platform={p} /> : <span className="muted">Press keys…</span>}
          </div>
        )}</Field>
      </div>
      <div className="filters plain">
        <Field label="Or type it" className="grow">{(pr) => <input {...pr} value={typed} onChange={(e) => { setTyped(e.target.value); setCombo(null); }} placeholder="Ctrl+Shift+K" />}</Field>
        <button type="submit" className="btn btn-primary">Add shortcut</button>
      </div>
      <p className="small muted">Custom shortcuts use the same keys on Mac and Windows. Backspace clears a recording.</p>
    </form>
  );
}

/* ---------- Progress ---------- */
function Progress({ store, setStore, decks }: Ctx) {
  const [tip, setTip] = useState<string | null>(null);
  const hist = store.history;
  const last = hist.slice(-12);
  const deckName = (id: string) => decks.find((d) => d.id === id)?.name ?? id;
  const hasDemo = hist.some((h) => h.demo);
  return (
    <div className="stack">
      <PageHead eyebrow="Progress" title={<>Your <em>tempo.</em></>} description="First-try accuracy for each round, and how much of each deck you’ve mastered (box 4 or 5)." actions={hasDemo ? <button type="button" className="btn btn-ghost" onClick={() => setStore({ ...store, history: hist.filter((h) => !h.demo), boxes: {}, custom: store.custom.filter((c) => c.id !== 'c1') })}>Clear demo data</button> : undefined} />
      {hasDemo && <p><DemoTag /> <span className="small muted">Sample rounds and progress so the charts aren’t empty.</span></p>}
      <div className="stats">
        {decks.filter((d) => d.items.length).map((d) => (
          <div className="stat" key={d.id}><span className="stat-label">{d.name}</span><span className="stat-value">{mastery(d.items, store.boxes, d.id)}%</span><span className="meter" aria-hidden="true"><i style={{ width: `${mastery(d.items, store.boxes, d.id)}%` }} /></span></div>
        ))}
      </div>
      {!hist.length ? <EmptyState title="No rounds yet" actions={<a className="btn btn-primary" href="#/practice">Start a round</a>}>Finish a round and it shows up here.</EmptyState> : (
        <>
          <section className="card stack" aria-labelledby="ch-t">
            <div className="row-between"><h2 id="ch-t" className="h3">Last {last.length} rounds</h2><span className="small muted" aria-live="polite">{tip ?? 'Hover or focus a bar for details'}</span></div>
            <div className="bars-wrap" onMouseLeave={() => setTip(null)}>
              <div className="bars-axis" aria-hidden="true"><span>100%</span><span>50%</span><span>0%</span></div>
              <div className="bars" role="img" aria-label={last.map((h) => `${formatDay(h.date)}: ${h.accuracy}%`).join('; ')}>
                {last.map((h, i) => {
                  const text = `${formatDay(h.date)} · ${deckName(h.deck)} · ${h.accuracy}% · median ${formatMs(h.medianMs)}`;
                  return (
                    <div key={h.id} className="bar-col" style={{ ['--i' as string]: i }} tabIndex={0} aria-label={text} onMouseEnter={() => setTip(text)} onFocus={() => setTip(text)} onBlur={() => setTip(null)}>
                      <div className="bar-stack" style={{ height: `${Math.max(2, h.accuracy)}%` }}><span style={{ flexGrow: 1, background: h.accuracy >= 80 ? 'var(--ok)' : 'var(--accent)' }} /></div>
                      <span className="bar-label mono">{h.accuracy}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
          <div className="table-wrap card flush">
            <table className="table">
              <caption className="sr-only">All rounds, newest first</caption>
              <thead><tr><th scope="col">Date</th><th scope="col">Deck</th><th scope="col" className="num">Prompts</th><th scope="col" className="num">Accuracy</th><th scope="col" className="num">Median</th></tr></thead>
              <tbody>{[...hist].reverse().map((h) => <tr key={h.id}><th scope="row" className="nowrap">{formatDay(h.date)}{h.demo && <> <DemoTag /></>}</th><td>{deckName(h.deck)}</td><td className="num">{h.total}</td><td className="num">{h.accuracy}%</td><td className="num">{formatMs(h.medianMs)}</td></tr>)}</tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
