import { Champ, ChampTeam, Group, GroupMode, KoRound, Match, Row, Tie } from './models';

// ---------- utilidades ----------
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export const clone = <T>(o: T): T => JSON.parse(JSON.stringify(o));
export const isPow2 = (n: number) => n >= 2 && (n & (n - 1)) === 0;
export const isPlayed = (m: Match) => m.hg != null && m.ag != null;
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const tmCache = new WeakMap<ChampTeam[], Map<string, ChampTeam>>();
const UNKNOWN: ChampTeam = { id: '?', name: '?', short: '?', c1: '#555', c2: '#999', rating: 70, base: 70 };

export function tm(c: Champ, id: string): ChampTeam {
  let m = tmCache.get(c.teams);
  if (!m) {
    m = new Map(c.teams.map((t) => [t.id, t]));
    tmCache.set(c.teams, m);
  }
  return m.get(id) ?? UNKNOWN;
}

// ---------- simulação de jogo ----------
function poisson(l: number): number {
  const L = Math.exp(-l);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= Math.random();
  } while (p > L);
  return k - 1;
}

/** Placar via Poisson; diferença de 10 pontos de força ≈ 2x mais gols esperados. */
export function simScore(c: Champ, rh: number, ra: number, neutral = false): [number, number] {
  const s = c.settings;
  const k = 1 - (clamp(s.chaos, 0, 100) / 100) * 0.85;
  const d = ((rh - ra) / 10) * k;
  const home = s.homeAdv && !neutral;
  const lh = 1.2 * Math.exp((home ? 0.16 : 0) + 0.34 * d);
  const la = 1.2 * Math.exp((home ? -0.12 : 0) - 0.34 * d);
  return [poisson(lh), poisson(la)];
}

export function simMatch(c: Champ, m: Match) {
  const [x, y] = simScore(c, tm(c, m.h).rating, tm(c, m.a).rating, !!m.neutral);
  m.hg = x;
  m.ag = y;
}

export function simList(c: Champ, ms: Match[]) {
  for (const m of ms) if (!isPlayed(m)) simMatch(c, m);
}

export function simPens(): [number, number] {
  const p = 0.76;
  let a = 0;
  let b = 0;
  for (let i = 0; i < 5; i++) {
    if (Math.random() < p) a++;
    if (a > b + (5 - i) || b > a + (4 - i)) return [a, b];
    if (Math.random() < p) b++;
    if (Math.abs(a - b) > 4 - i) return [a, b];
  }
  while (a === b) {
    const x = Math.random() < p;
    const y = Math.random() < p;
    if (x !== y) {
      a += +x;
      b += +y;
    } else if (x) {
      a++;
      b++;
    }
  }
  return [a, b];
}

// ---------- tabela ----------
export function roundRobin(ids: string[], turnos: number): Match[][] {
  const t: (string | null)[] = shuffle(ids);
  if (t.length % 2) t.push(null);
  const n = t.length;
  const first: Match[][] = [];
  for (let r = 0; r < n - 1; r++) {
    const ms: Match[] = [];
    for (let i = 0; i < n / 2; i++) {
      const x = t[i];
      const y = t[n - 1 - i];
      if (x == null || y == null) continue;
      const flip = i === 0 ? r % 2 === 1 : (i + r) % 2 === 1;
      ms.push(flip ? { h: y, a: x, hg: null, ag: null } : { h: x, a: y, hg: null, ag: null });
    }
    first.push(ms);
    t.splice(1, 0, t.pop()!);
  }
  const rounds = first.slice();
  if (turnos === 2) {
    for (const ms of first) rounds.push(ms.map((m) => ({ h: m.a, a: m.h, hg: null, ag: null })));
  }
  return rounds;
}

export function standings(c: Champ, ids: string[], matches: Match[]): Row[] {
  const rows = new Map<string, Row>(
    ids.map((id) => [id, { id, p: 0, j: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0, sg: 0, last: [] }]),
  );
  for (const m of matches) {
    if (!isPlayed(m)) continue;
    const h = rows.get(m.h);
    const a = rows.get(m.a);
    if (!h || !a) continue;
    const hg = m.hg!;
    const ag = m.ag!;
    h.j++;
    a.j++;
    h.gp += hg;
    h.gc += ag;
    a.gp += ag;
    a.gc += hg;
    if (hg > ag) {
      h.v++;
      h.p += 3;
      a.d++;
      h.last.push('V');
      a.last.push('D');
    } else if (hg < ag) {
      a.v++;
      a.p += 3;
      h.d++;
      h.last.push('D');
      a.last.push('V');
    } else {
      h.e++;
      a.e++;
      h.p++;
      a.p++;
      h.last.push('E');
      a.last.push('E');
    }
  }
  const arr = [...rows.values()];
  for (const r of arr) {
    r.sg = r.gp - r.gc;
    r.last = r.last.slice(-5);
  }
  return arr.sort(
    (x, y) =>
      y.p - x.p ||
      y.v - x.v ||
      y.sg - x.sg ||
      y.gp - x.gp ||
      tm(c, x.id).name.localeCompare(tm(c, y.id).name),
  );
}

export function zoneOf(c: Champ, pos: number, n: number): string {
  const s = c.settings;
  if (pos === 1 && c.format === 'liga') return 'champ';
  if (pos <= s.z1.count) return 'z1';
  if (pos <= s.z1.count + s.z2.count) return 'z2';
  if (pos > n - s.releg) return 'rel';
  return '';
}

// ---------- mata-mata ----------
const ROUND_NAMES: Record<number, string> = {
  2: 'Final',
  4: 'Semifinal',
  8: 'Quartas de final',
  16: 'Oitavas de final',
  32: '16-avos de final',
  64: '32-avos de final',
  128: '64-avos de final',
};
export const roundName = (teams: number) => ROUND_NAMES[teams] ?? `${teams} times`;

function seedOrder(n: number): number[] {
  let o = [1, 2];
  while (o.length < n) {
    const m = o.length * 2 + 1;
    o = o.flatMap((x) => [x, m - x]);
  }
  return o;
}

export function pairsFromSeeds(ids: string[]): [string, string][] {
  const o = seedOrder(ids.length);
  const p: [string, string][] = [];
  for (let i = 0; i < o.length; i += 2) p.push([ids[o[i] - 1], ids[o[i + 1] - 1]]);
  return p;
}

export function buildRound(c: Champ, pairs: [string, string][]): KoRound {
  const isFinal = pairs.length === 1;
  const legs = isFinal && c.settings.finalSingle ? 1 : c.settings.legs;
  return {
    name: roundName(pairs.length * 2),
    ties: pairs.map(([a, b]) => ({
      a,
      b,
      pens: null,
      winner: null,
      legs:
        legs === 1
          ? [{ h: a, a: b, hg: null, ag: null, neutral: isFinal }]
          : [
              { h: b, a, hg: null, ag: null },
              { h: a, a: b, hg: null, ag: null },
            ],
    })),
  };
}

function evalTie(t: Tie) {
  if (!t.legs.every(isPlayed)) {
    t.winner = null;
    t.pens = null;
    delete t.agg;
    return;
  }
  let ga = 0;
  let gb = 0;
  for (const l of t.legs) {
    if (l.h === t.a) {
      ga += l.hg!;
      gb += l.ag!;
    } else {
      gb += l.hg!;
      ga += l.ag!;
    }
  }
  t.agg = [ga, gb];
  if (ga !== gb) {
    t.pens = null;
    t.winner = ga > gb ? t.a : t.b;
  } else {
    if (!t.pens) t.pens = simPens();
    t.winner = t.pens[0] > t.pens[1] ? t.a : t.b;
  }
}

const pairsDiffer = (round: KoRound, pairs: [string, string][]) =>
  round.ties.length !== pairs.length ||
  round.ties.some((t, i) => t.a !== pairs[i][0] || t.b !== pairs[i][1]);

function syncKO(c: Champ) {
  const R = c.ko!.rounds;
  for (let r = 0; r < R.length; r++) {
    const round = R[r];
    round.ties.forEach(evalTie);
    if (!round.ties.every((t) => t.winner) || round.ties.length === 1) {
      R.length = r + 1;
      return;
    }
    const w = round.ties.map((t) => t.winner!);
    const pairs: [string, string][] = [];
    for (let i = 0; i < w.length; i += 2) pairs.push([w[i], w[i + 1]]);
    const next = R[r + 1];
    if (!next || pairsDiffer(next, pairs)) {
      R.length = r + 1;
      R.push(buildRound(c, pairs));
    }
  }
}

// ---------- grupos ----------
export function makeGroups(c: Champ, ids: string[], mode: GroupMode): Group[] {
  const G = c.settings.groups;
  const size = ids.length / G;
  const buckets: string[][] = Array.from({ length: G }, () => []);
  if (mode === 'ordem') {
    ids.forEach((id, i) => buckets[Math.floor(i / size)].push(id));
  } else {
    const sorted = ids.slice().sort((a, b) => tm(c, b).rating - tm(c, a).rating);
    for (let p = 0; p < size; p++) {
      shuffle(sorted.slice(p * G, (p + 1) * G)).forEach((id, i) => buckets[i].push(id));
    }
  }
  return buckets.map((teams, i) => ({
    name: `Grupo ${String.fromCharCode(65 + i)}`,
    teams,
    rounds: roundRobin(teams, c.settings.groupTurnos),
  }));
}

export const groupsDone = (c: Champ) =>
  !!c.groups && c.groups.every((g) => g.rounds.flat().every(isPlayed));

function groupQualifiers(c: Champ): [string, string][] {
  const tables = c.groups!.map((g) => standings(c, g.teams, g.rounds.flat()));
  const G = tables.length;
  const k = c.settings.qualify;
  if (k === 2 && G % 2 === 0) {
    const first: [string, string][] = [];
    const second: [string, string][] = [];
    for (let i = 0; i < G; i += 2) {
      first.push([tables[i][0].id, tables[i + 1][1].id]);
      second.push([tables[i + 1][0].id, tables[i][1].id]);
    }
    return first.concat(second);
  }
  const q: string[] = [];
  for (let pos = 0; pos < k; pos++) {
    const rows = tables.map((t) => t[pos]);
    rows.sort((x, y) => y.p - x.p || y.sg - x.sg || y.gp - x.gp);
    q.push(...rows.map((r) => r.id));
  }
  return pairsFromSeeds(q);
}

// ---------- ciclo de vida do campeonato ----------
export function initStructure(c: Champ, groupMode: GroupMode = 'potes') {
  const ids = c.teams.map((t) => t.id);
  delete c.league;
  delete c.groups;
  delete c.ko;
  if (c.format === 'liga' || c.format === 'ligamata') {
    c.league = { rounds: roundRobin(ids, c.settings.turnos) };
  }
  if (c.format === 'ligamata') c.ko = { rounds: [] };
  if (c.format === 'mata') c.ko = { rounds: [buildRound(c, pairsFromSeeds(ids))] };
  if (c.format === 'grupos') {
    c.groups = makeGroups(c, ids, groupMode);
    c.ko = { rounds: [] };
  }
}

/** Recalcula confrontos, classificados e próximas fases após qualquer alteração. */
export const leagueDone = (c: Champ) => !!c.league && c.league.rounds.flat().every(isPlayed);

export function sync(c: Champ) {
  if (c.format === 'ligamata' && c.ko) {
    if (leagueDone(c)) {
      const top = standings(c, c.teams.map((t) => t.id), c.league!.rounds.flat())
        .slice(0, c.settings.qualify)
        .map((r) => r.id);
      const pairs = pairsFromSeeds(top);
      if (!c.ko.rounds[0] || pairsDiffer(c.ko.rounds[0], pairs)) c.ko.rounds = [buildRound(c, pairs)];
    } else c.ko.rounds = [];
  }
  if (c.format === 'grupos' && c.ko) {
    if (groupsDone(c)) {
      const pairs = groupQualifiers(c);
      if (!c.ko.rounds[0] || pairsDiffer(c.ko.rounds[0], pairs)) c.ko.rounds = [buildRound(c, pairs)];
    } else c.ko.rounds = [];
  }
  if (c.ko) syncKO(c);
}

export function champion(c: Champ): string | null {
  if (c.format === 'liga') {
    const all = c.league!.rounds.flat();
    if (all.length && all.every(isPlayed)) return standings(c, c.teams.map((t) => t.id), all)[0].id;
    return null;
  }
  const R = c.ko!.rounds;
  const last = R[R.length - 1];
  return last && last.ties.length === 1 ? last.ties[0].winner : null;
}

export function simKoPhase(c: Champ) {
  sync(c);
  const R = c.ko!.rounds;
  const last = R[R.length - 1];
  if (last) {
    simList(c, last.ties.flatMap((t) => t.legs));
    sync(c);
  }
}

export function simAll(c: Champ) {
  if (c.league) simList(c, c.league.rounds.flat());
  if (c.groups) for (const g of c.groups) simList(c, g.rounds.flat());
  if (c.ko) {
    sync(c);
    let guard = 0;
    while (!champion(c) && c.ko.rounds.length && guard++ < 20) simKoPhase(c);
  }
}

export function resetChamp(c: Champ) {
  const clr = (ms: Match[]) =>
    ms.forEach((m) => {
      m.hg = null;
      m.ag = null;
    });
  if (c.league) clr(c.league.rounds.flat());
  if (c.groups) {
    c.groups.forEach((g) => clr(g.rounds.flat()));
    c.ko = { rounds: [] };
  }
  if (c.format === 'ligamata') c.ko = { rounds: [] };
  if (c.format === 'mata') {
    c.ko = { rounds: [buildRound(c, c.ko!.rounds[0].ties.map((t) => [t.a, t.b]))] };
  }
}

export function progress(c: Champ): number {
  let played = 0;
  let total = 0;
  const count = (ms: Match[]) =>
    ms.forEach((m) => {
      total++;
      if (isPlayed(m)) played++;
    });
  if (c.league) count(c.league.rounds.flat());
  if (c.groups) c.groups.forEach((g) => count(g.rounds.flat()));
  if (c.ko) {
    let size =
      c.format === 'grupos'
        ? c.settings.groups * c.settings.qualify
        : c.format === 'ligamata'
          ? c.settings.qualify
          : c.teams.length;
    let r = 0;
    while (size >= 2) {
      const ties = size / 2;
      const legs = ties === 1 && c.settings.finalSingle ? 1 : c.settings.legs;
      const round = c.ko.rounds[r];
      if (round) count(round.ties.flatMap((t) => t.legs));
      else total += ties * legs;
      size /= 2;
      r++;
    }
  }
  return total ? played / total : 0;
}

/** Localiza um jogo por chave: L.r.i (liga), G.g.r.i (grupo), K.r.t.l (mata-mata). */
export function getMatch(c: Champ, key: string): Match | undefined {
  const [kind, ...rest] = key.split('.');
  const n = rest.map(Number);
  if (kind === 'L') return c.league?.rounds[n[0]]?.[n[1]];
  if (kind === 'G') return c.groups?.[n[0]]?.rounds[n[1]]?.[n[2]];
  if (kind === 'K') return c.ko?.rounds[n[0]]?.ties[n[1]]?.legs[n[2]];
  return undefined;
}

// ---------- probabilidades (Monte Carlo) ----------
export interface ProbRow {
  id: string;
  title: number;
  z1: number;
  z2: number;
  rel: number;
  pts: number;
  pos: number;
}

export function monteCarlo(c: Champ, N: number): ProbRow[] {
  const ids = c.teams.map((t) => t.id);
  const n = ids.length;
  const ix = new Map(ids.map((id, i) => [id, i]));
  const rating = ids.map((id) => tm(c, id).rating);
  const bp = new Array(n).fill(0);
  const bw = new Array(n).fill(0);
  const bgd = new Array(n).fill(0);
  const bgf = new Array(n).fill(0);
  const apply = (p: number[], w: number[], gd: number[], gf: number[], h: number, a: number, x: number, y: number) => {
    gf[h] += x;
    gf[a] += y;
    gd[h] += x - y;
    gd[a] += y - x;
    if (x > y) {
      p[h] += 3;
      w[h]++;
    } else if (y > x) {
      p[a] += 3;
      w[a]++;
    } else {
      p[h]++;
      p[a]++;
    }
  };
  const rem: [number, number][] = [];
  for (const m of c.league!.rounds.flat()) {
    const h = ix.get(m.h)!;
    const a = ix.get(m.a)!;
    if (isPlayed(m)) apply(bp, bw, bgd, bgf, h, a, m.hg!, m.ag!);
    else rem.push([h, a]);
  }
  const s = c.settings;
  const res: ProbRow[] = ids.map((id) => ({ id, title: 0, z1: 0, z2: 0, rel: 0, pts: 0, pos: 0 }));
  const order = ids.map((_, i) => i);
  for (let k = 0; k < N; k++) {
    const p = bp.slice();
    const w = bw.slice();
    const gd = bgd.slice();
    const gf = bgf.slice();
    for (const [h, a] of rem) {
      const [x, y] = simScore(c, rating[h], rating[a]);
      apply(p, w, gd, gf, h, a, x, y);
    }
    const tb = order.map(() => Math.random());
    order.sort((i, j) => p[j] - p[i] || w[j] - w[i] || gd[j] - gd[i] || gf[j] - gf[i] || tb[j] - tb[i]);
    order.forEach((ti, pos) => {
      const r = res[ti];
      r.pos += pos + 1;
      r.pts += p[ti];
      if (pos === 0) r.title++;
      if (pos < s.z1.count) r.z1++;
      else if (pos < s.z1.count + s.z2.count) r.z2++;
      if (pos >= n - s.releg) r.rel++;
    });
  }
  for (const r of res) {
    r.title /= N;
    r.z1 /= N;
    r.z2 /= N;
    r.rel /= N;
    r.pts /= N;
    r.pos /= N;
  }
  return res.sort((a, b) => a.pos - b.pos);
}
