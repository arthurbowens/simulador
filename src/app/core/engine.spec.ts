import { TestBed } from '@angular/core/testing';
import { Store } from './store';
import { champion, isPlayed, monteCarlo, progress, roundRobin, simAll, simList, standings, sync } from './engine';
import { PRESETS } from '../data/presets';
import { TEAMS } from '../data/teams';

describe('dados', () => {
  it('todos os ids dos presets existem e não se repetem', () => {
    const ids = new Set(TEAMS.map((t) => t.id));
    expect(ids.size).toBe(TEAMS.length);
    for (const p of PRESETS) {
      for (const [y, list] of Object.entries(p.years)) {
        const missing = list.filter((id) => !ids.has(id));
        expect(missing, `${p.id} ${y}`).toEqual([]);
        expect(new Set(list).size, `${p.id} ${y} duplicado`).toBe(list.length);
      }
    }
  });

  it('Séries A (2006+), B e C têm 20 times por ano', () => {
    for (const p of PRESETS) {
      for (const [y, list] of Object.entries(p.years)) {
        if (p.id === 'br-a' && Number(y) < 2006) continue;
        if (p.id === 'br-c' && Number(y) === 2027) {
          expect(list.length).toBe(24); // Série C passa a ter 24 clubes em 2027
          continue;
        }
        expect(list.length, `${p.id} ${y}`).toBe(20);
      }
    }
  });
});

describe('simulação', () => {
  let store: Store;
  beforeEach(() => (store = TestBed.inject(Store)));

  const fromPreset = (id: string, year: number) => {
    const d = store.newDraft();
    store.applyPreset(d, id, year);
    return store.buildChamp(d);
  };

  it('Brasileirão 2010: 38 rodadas, 380 jogos, cada time joga 38', () => {
    const c = fromPreset('br-a', 2010);
    const R = c.league!.rounds;
    expect(R.length).toBe(38);
    expect(R.flat().length).toBe(380);
    R.forEach((ms) => expect(new Set(ms.flatMap((m) => [m.h, m.a])).size).toBe(20));
    simAll(c);
    expect(progress(c)).toBe(1);
    const rows = standings(c, c.teams.map((t) => t.id), R.flat());
    rows.forEach((r) => expect(r.j).toBe(38));
    expect(champion(c)).toBe(rows[0].id);
    // força histórica: Fluminense (campeão real) é o mais forte
    expect(c.teams.find((t) => t.id === 'flu')!.rating).toBe(85);
  });

  it('Monte Carlo: probabilidades de título somam 1', () => {
    const c = fromPreset('br-a', 2010);
    const res = monteCarlo(c, 300);
    const sum = res.reduce((s, r) => s + r.title, 0);
    expect(sum).toBeCloseTo(1, 6);
  });

  it('Série C 2019: 2 grupos de 10 em ida e volta, 8 no mata-mata', () => {
    const c = fromPreset('br-c', 2019);
    expect(c.format).toBe('grupos');
    expect(c.groups!.length).toBe(2);
    expect(c.groups![0].rounds.flat().length).toBe(90);
    simAll(c);
    expect(c.ko!.rounds.map((r) => r.name)).toEqual(['Quartas de final', 'Semifinal', 'Final']);
    expect(c.ko!.rounds[2].ties[0].legs.length).toBe(2);
    expect(champion(c)).toBeTruthy();
    expect(progress(c)).toBe(1);
  });

  it('Série C 2025: turno único + quadrangulares (1/4/5/8 e 2/3/6/7) + final em ida e volta', () => {
    const c = fromPreset('br-c', 2025);
    expect(c.format).toBe('ligamata');
    expect(c.settings.second).toBe('quad');
    expect(c.league!.rounds.length).toBe(19);
    simList(c, c.league!.rounds.flat());
    sync(c);
    const q = standings(c, c.teams.map((t) => t.id), c.league!.rounds.flat()).map((r) => r.id);
    expect(c.quad!.map((g) => g.teams)).toEqual([
      [q[0], q[3], q[4], q[7]],
      [q[1], q[2], q[5], q[6]],
    ]);
    // ida e volta dentro do grupo: 6 rodadas, 12 jogos
    expect(c.quad!.every((g) => g.rounds.length === 6 && g.rounds.flat().length === 12)).toBe(true);
    expect(c.ko!.rounds).toEqual([]);
    for (const g of c.quad!) simList(c, g.rounds.flat());
    sync(c);
    const final = c.ko!.rounds[0];
    expect(final.name).toBe('Final');
    expect(final.ties[0].legs.length).toBe(2);
    const leaders = c.quad!.map((g) => standings(c, g.teams, g.rounds.flat())[0].id);
    expect([final.ties[0].a, final.ties[0].b].sort()).toEqual(leaders.slice().sort());
    // jogo de volta em casa de quem tem a melhor campanha (1ª + 2ª fase)
    const all = [...c.league!.rounds.flat(), ...c.quad!.flatMap((g) => g.rounds.flat())];
    expect(final.ties[0].legs[1].h).toBe(standings(c, leaders, all)[0].id);
    simAll(c);
    expect(champion(c)).toBeTruthy();
    expect(progress(c)).toBe(1);
  });

  it('Série C 2021: quadrangulares com 1º e 3º do A + 2º e 4º do B', () => {
    const c = fromPreset('br-c', 2021);
    expect(c.format).toBe('grupos');
    for (const g of c.groups!) simList(c, g.rounds.flat());
    sync(c);
    const [A, B] = c.groups!.map((g) => standings(c, g.teams, g.rounds.flat()).map((r) => r.id));
    expect(c.quad!.map((g) => g.teams)).toEqual([
      [A[0], A[2], B[1], B[3]],
      [A[1], A[3], B[0], B[2]],
    ]);
    simAll(c);
    expect(champion(c)).toBeTruthy();
  });

  it('Série C 2027: 24 clubes confirmados, 23 rodadas', () => {
    const c = fromPreset('br-c', 2027);
    expect(c.teams.length).toBe(24);
    expect(c.league!.rounds.length).toBe(23);
    simAll(c);
    expect(champion(c)).toBeTruthy();
    expect(progress(c)).toBe(1);
  });

  it('mando alterna como numa tabela real (máx. 2 seguidos; casa/fora equilibrado)', () => {
    for (const [preset, year] of [
      ['br-a', 2010],
      ['br-c', 2025],
      ['br-c', 2027],
    ] as const) {
      const c = fromPreset(preset, year);
      const R = c.league!.rounds;
      for (const t of c.teams) {
        const seq = R.map((ms) => {
          const m = ms.find((x) => x.h === t.id || x.a === t.id);
          return m ? (m.h === t.id ? 'H' : 'A') : '';
        }).join('');
        const longest = Math.max(...(seq.match(/H+|A+/g) ?? ['']).map((x) => x.length));
        expect(longest, `${preset} ${year} ${t.id} ${seq}`).toBeLessThanOrEqual(2);
        const home = [...seq].filter((x) => x === 'H').length;
        expect(Math.abs(home * 2 - seq.length), `${t.id} ${seq}`).toBeLessThanOrEqual(1);
      }
      // returno espelha o turno com mando invertido
      if (c.settings.turnos === 2) {
        const half = R.length / 2;
        R.slice(0, half).forEach((ms, r) =>
          ms.forEach((m, i) => expect([R[r + half][i].h, R[r + half][i].a]).toEqual([m.a, m.h])),
        );
      }
    }
  });

  it('mando equilibrado em qualquer tabela sorteada (4, 10, 20 e 24 times)', () => {
    const ids = (n: number) => Array.from({ length: n }, (_, i) => 't' + i);
    for (let rep = 0; rep < 40; rep++) {
      for (const [n, turnos] of [
        [4, 2],
        [10, 2],
        [20, 1],
        [20, 2],
        [24, 1],
        [24, 2],
      ]) {
        const R = roundRobin(ids(n), turnos);
        expect(R.length).toBe((n - 1) * turnos);
        for (const id of ids(n)) {
          const seq = R.map((ms) => (ms.find((m) => m.h === id) ? 'H' : 'A')).join('');
          const longest = Math.max(...seq.match(/H+|A+/g)!.map((x) => x.length));
          expect(longest, `${n}/${turnos} ${seq}`).toBeLessThanOrEqual(2);
          const home = [...seq].filter((x) => x === 'H').length;
          expect(Math.abs(home * 2 - seq.length)).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('desempate: confronto direto entre dois clubes iguais em pontos, vitórias, saldo e gols', () => {
    const d = store.newDraft();
    d.selected = ['fla', 'pal', 'cru', 'bot'];
    const c = store.buildChamp(d);
    const ms = [
      { h: 'pal', a: 'fla', hg: 1, ag: 0 }, // confronto direto: Palmeiras venceu
      { h: 'fla', a: 'cru', hg: 2, ag: 0 },
      { h: 'fla', a: 'bot', hg: 1, ag: 1 },
      { h: 'pal', a: 'cru', hg: 2, ag: 2 },
    ];
    const rows = standings(c, ['fla', 'pal', 'cru', 'bot'], ms);
    const f = rows.find((r) => r.id === 'fla')!;
    const p = rows.find((r) => r.id === 'pal')!;
    // os dois empatam em tudo: 4 pts, 1 vitória, saldo +1, 3 gols pró
    expect([f.p, f.v, f.sg, f.gp]).toEqual([4, 1, 1, 3]);
    expect([p.p, p.v, p.sg, p.gp]).toEqual([4, 1, 1, 3]);
    // sem o confronto direto, a ordem alfabética poria o Flamengo na frente
    expect(rows.map((r) => r.id).slice(0, 2)).toEqual(['pal', 'fla']);
  });

  it('clubes têm escudo (exceto os sem imagem na Wikipédia)', () => {
    // sem escudo na Wikipédia: usam o círculo de cores
    expect(TEAMS.filter((t) => !t.logo).map((t) => t.id).sort()).toEqual(['bil', 'cse', 'mrj', 'sou', 'vdc']);
  });

  it('mata-mata ida e volta: empate no agregado vai para pênaltis', () => {
    const d = store.newDraft();
    d.format = 'mata';
    d.settings.legs = 2;
    d.settings.finalSingle = false;
    d.selected = ['fla', 'pal', 'cru', 'bot'];
    const c = store.buildChamp(d);
    const t = c.ko!.rounds[0].ties[0];
    t.legs[0].hg = 1;
    t.legs[0].ag = 0;
    t.legs[1].hg = 1;
    t.legs[1].ag = 0;
    sync(c);
    expect(t.agg).toEqual([1, 1]);
    expect(t.pens).not.toBeNull();
    expect(t.pens![0]).not.toBe(t.pens![1]);
    expect(t.winner).toBe(t.pens![0] > t.pens![1] ? t.a : t.b);
    simAll(c);
    expect(c.ko!.rounds.length).toBe(2);
    expect(c.ko!.rounds[1].ties[0].legs.every(isPlayed)).toBe(true);
    expect(champion(c)).toBeTruthy();
  });

  it('alterar um jogo anterior refaz as fases seguintes', () => {
    const d = store.newDraft();
    d.format = 'mata';
    d.settings.legs = 1;
    d.selected = ['fla', 'pal', 'cru', 'bot'];
    const c = store.buildChamp(d);
    simAll(c);
    const semi = c.ko!.rounds[0].ties[0];
    const leg = semi.legs[0];
    // força a vitória do outro time
    const loser = semi.winner === semi.a ? semi.b : semi.a;
    leg.hg = leg.h === loser ? 5 : 0;
    leg.ag = leg.a === loser ? 5 : 0;
    sync(c);
    expect(semi.winner).toBe(loser);
    const final = c.ko!.rounds[1].ties[0];
    expect([final.a, final.b]).toContain(loser);
  });
});
