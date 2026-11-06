import { TestBed } from '@angular/core/testing';
import { Store } from './store';
import { champion, isPlayed, monteCarlo, progress, simAll, simList, standings, sync } from './engine';
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

  it('Série C 2025: turno único de 20 times + mata-mata com os 8 primeiros', () => {
    const c = fromPreset('br-c', 2025);
    expect(c.format).toBe('ligamata');
    expect(c.league!.rounds.length).toBe(19);
    expect(c.ko!.rounds).toEqual([]);
    simList(c, c.league!.rounds.flat());
    sync(c);
    const top8 = standings(c, c.teams.map((t) => t.id), c.league!.rounds.flat())
      .slice(0, 8)
      .map((r) => r.id);
    const ko = c.ko!.rounds[0];
    expect(ko.name).toBe('Quartas de final');
    expect(ko.ties.flatMap((t) => [t.a, t.b]).sort()).toEqual(top8.slice().sort());
    expect([ko.ties[0].a, ko.ties[0].b]).toEqual([top8[0], top8[7]]);
    simAll(c);
    expect(champion(c)).toBeTruthy();
    expect(progress(c)).toBe(1);
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
