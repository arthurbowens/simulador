import { Component, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Champ, ChampTeam } from '../../core/models';
import { Store } from '../../core/store';
import {
  ProbRow,
  clamp,
  initStructure,
  isPlayed,
  makeGroups,
  monteCarlo,
  pairsFromSeeds,
  buildRound,
  roundName,
  shuffle,
  simKoPhase,
  simList,
  simPens,
  standings,
  tm,
} from '../../core/engine';
import { Badge, MatchRow, Standings } from '../../shared/shared';

// ======================= Pontos corridos =======================
@Component({
  selector: 'app-league-view',
  imports: [Standings, MatchRow],
  template: `
    @let c = champ();
    @let R = c.league!.rounds;
    @let r = round();
    <div class="grid-liga">
      <div class="card table-card">
        <app-standings [champ]="c" [rows]="rows()" mode="liga" />
        <div class="legend">
          @if (c.settings.z1.count) {
            <span><i class="lz z1"></i>{{ c.settings.z1.name }}</span>
          }
          @if (c.settings.z2.count) {
            <span><i class="lz z2"></i>{{ c.settings.z2.name }}</span>
          }
          @if (c.settings.releg) {
            <span><i class="lz rel"></i>Rebaixamento</span>
          }
          @if (c.format === 'ligamata' && R.flat().length && !leagueOver()) {
            <span class="muted">Ao fim da 1ª fase os {{ c.settings.qualify }} primeiros vão ao mata-mata.</span>
          }
          <span class="muted">Desempate: pontos, vitórias, saldo, gols pró</span>
        </div>
      </div>
      <div class="card">
        <div class="round-nav">
          <button class="icon" (click)="go(r - 1)" [disabled]="r === 0">‹</button>
          <select [value]="r" (change)="goSel($event)">
            @for (ms of R; track $index) {
              <option [value]="$index" [selected]="$index === r">
                {{ $index + 1 }}ª rodada{{ roundDone($index) ? ' ✓' : '' }}
              </option>
            }
          </select>
          <button class="icon" (click)="go(r + 1)" [disabled]="r === R.length - 1">›</button>
        </div>
        <div class="matches">
          @for (m of R[r]; track $index) {
            <app-match [champ]="c" [match]="m" />
          }
        </div>
        <div class="row wrap actions">
          <button class="btn" (click)="simRound()">🎲 Simular rodada</button>
          <button class="btn btn-ghost" (click)="simUntil()">Simular até esta rodada</button>
          <button class="btn btn-ghost" (click)="clearRound()">Limpar rodada</button>
        </div>
        <p class="hint">Digite os placares ou deixe o simulador decidir. Enter pula para o próximo campo.</p>
      </div>
    </div>
  `,
})
export class LeagueView {
  private readonly store = inject(Store);
  readonly champ = input.required<Champ>();

  leagueOver() {
    return this.champ().league!.rounds.flat().every(isPlayed);
  }

  rows() {
    const c = this.champ();
    return standings(c, c.teams.map((t) => t.id), c.league!.rounds.flat());
  }

  round(): number {
    const c = this.champ();
    const u = this.store.uiOf(c.id);
    const R = c.league!.rounds;
    if (u.round == null) {
      const i = R.findIndex((ms) => ms.some((m) => !isPlayed(m)));
      u.round = i < 0 ? R.length - 1 : i;
    }
    return (u.round = clamp(u.round, 0, R.length - 1));
  }

  roundDone(i: number) {
    return this.champ().league!.rounds[i].every(isPlayed);
  }

  go(i: number) {
    this.store.uiOf(this.champ().id).round = i;
  }
  goSel(ev: Event) {
    this.go(Number((ev.target as HTMLSelectElement).value));
  }

  simRound() {
    const c = this.champ();
    const r = this.round();
    simList(c, c.league!.rounds[r]);
    if (r < c.league!.rounds.length - 1) this.go(r + 1);
    this.store.commit(c);
  }
  simUntil() {
    const c = this.champ();
    const r = this.round();
    simList(c, c.league!.rounds.slice(0, r + 1).flat());
    this.store.commit(c);
  }
  clearRound() {
    const c = this.champ();
    for (const m of c.league!.rounds[this.round()]) m.hg = m.ag = null;
    this.store.commit(c);
  }
}

// ======================= Probabilidades =======================
@Component({
  selector: 'app-prob-view',
  imports: [Badge, FormsModule],
  template: `
    @let c = champ();
    <div class="card">
      <div class="row wrap between">
        <div>
          <h3>Probabilidades (Monte Carlo)</h3>
          <p class="hint">
            Simula os jogos restantes milhares de vezes a partir da situação atual, sem alterar seu
            campeonato.
          </p>
        </div>
        <div class="row">
          <select [(ngModel)]="n">
            <option [ngValue]="1000">1.000 simulações</option>
            <option [ngValue]="5000">5.000 simulações</option>
            <option [ngValue]="20000">20.000 simulações</option>
          </select>
          <button class="btn btn-primary" (click)="run()">Calcular</button>
        </div>
      </div>
      @if (result(); as res) {
        @if (res.at !== c.updatedAt) {
          <p class="hint warn">Resultados mudaram desde o último cálculo — clique em Calcular de novo.</p>
        }
        <div class="scroll-x">
          <table class="tbl prob">
            <thead>
              <tr>
                <th class="l">Time</th>
                <th>Pos. média</th>
                <th>Pts médios</th>
                <th>Campeão</th>
                @if (c.settings.z1.count) {
                  <th>{{ c.settings.z1.name }}</th>
                }
                @if (c.settings.z2.count) {
                  <th>{{ c.settings.z2.name }}</th>
                }
                @if (c.settings.releg) {
                  <th>Rebaixamento</th>
                }
              </tr>
            </thead>
            <tbody>
              @for (r of res.rows; track r.id) {
                @let t = team(r.id);
                <tr>
                  <td class="l team"><app-badge [team]="t" /> {{ t.name }}</td>
                  <td>{{ r.pos.toFixed(1) }}</td>
                  <td>{{ r.pts.toFixed(1) }}</td>
                  <td><span class="bar gold" [style.--w]="r.title">{{ pct(r.title) }}</span></td>
                  @if (c.settings.z1.count) {
                    <td><span class="bar blue" [style.--w]="r.z1">{{ pct(r.z1) }}</span></td>
                  }
                  @if (c.settings.z2.count) {
                    <td><span class="bar orange" [style.--w]="r.z2">{{ pct(r.z2) }}</span></td>
                  }
                  @if (c.settings.releg) {
                    <td><span class="bar red" [style.--w]="r.rel">{{ pct(r.rel) }}</span></td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
})
export class ProbView {
  readonly champ = input.required<Champ>();
  protected n = 5000;
  protected readonly result = signal<{ at: number; rows: ProbRow[] } | null>(null);

  team(id: string) {
    return tm(this.champ(), id);
  }
  pct(x: number) {
    if (x === 0) return '–';
    if (x < 0.001) return '<0,1%';
    if (x > 0.999 && x < 1) return '>99,9%';
    return (x * 100).toFixed(1).replace('.', ',') + '%';
  }
  run() {
    const c = this.champ();
    this.result.set({ at: c.updatedAt, rows: monteCarlo(c, this.n) });
  }
}

// ======================= Fase de grupos =======================
@Component({
  selector: 'app-groups-view',
  imports: [Standings, MatchRow],
  template: `
    @let c = champ();
    <div class="row wrap actions">
      <button class="btn" (click)="simGroups()">🎲 Simular fase de grupos</button>
      @if (!anyPlayed()) {
        <button class="btn btn-ghost" (click)="redraw()">🔀 Sortear grupos novamente</button>
      }
      <span class="hint">Os {{ c.settings.qualify }} primeiros de cada grupo avançam.</span>
    </div>
    <div class="groups">
      @for (g of c.groups!; track $index; let gi = $index) {
        <div class="card group">
          <h3>{{ g.name }}</h3>
          <app-standings [champ]="c" [rows]="table(gi)" mode="group" [qualify]="c.settings.qualify" />
          <div class="g-matches">
            @for (ms of g.rounds; track $index; let r = $index) {
              <div class="g-round">Rodada {{ r + 1 }}</div>
              @for (m of ms; track $index) {
                <app-match [champ]="c" [match]="m" [compact]="true" />
              }
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class GroupsView {
  private readonly store = inject(Store);
  readonly champ = input.required<Champ>();

  table(gi: number) {
    const c = this.champ();
    const g = c.groups![gi];
    return standings(c, g.teams, g.rounds.flat());
  }
  anyPlayed() {
    return this.champ().groups!.some((g) => g.rounds.flat().some(isPlayed));
  }
  simGroups() {
    const c = this.champ();
    for (const g of c.groups!) simList(c, g.rounds.flat());
    this.store.commit(c);
  }
  redraw() {
    const c = this.champ();
    c.groups = makeGroups(c, shuffle(c.teams.map((t) => t.id)), 'potes');
    c.ko = { rounds: [] };
    this.store.commit(c);
  }
}

// ======================= Mata-mata =======================
@Component({
  selector: 'app-ko-view',
  imports: [Badge, MatchRow],
  template: `
    @let c = champ();
    @let R = c.ko!.rounds;
    @if (!R.length) {
      <div class="card empty">
        O mata-mata começa quando todos os jogos da {{ c.format === 'grupos' ? 'fase de grupos' : '1ª fase' }} tiverem placar.
      </div>
    } @else {
      <div class="row wrap actions">
        <button class="btn" (click)="simPhase()">🎲 Simular fase atual</button>
        @if (canDraw()) {
          <button class="btn btn-ghost" (click)="draw()">🔀 Sortear confrontos</button>
        }
      </div>
      <div class="bracket">
        @for (round of R; track $index; let r = $index) {
          <div class="ko-col">
            <h4>{{ round.name }}</h4>
            <div class="ko-ties">
            @for (t of round.ties; track $index; let ti = $index) {
              @let A = team(t.a);
              @let B = team(t.b);
              <div class="tie" [class.done]="!!t.winner">
                <div class="tie-head">
                  <span [class.win]="t.winner === t.a" [class.lose]="t.winner === t.b">
                    <app-badge [team]="A" /> {{ A.name }}
                  </span>
                  <span class="vs">vs</span>
                  <span [class.win]="t.winner === t.b" [class.lose]="t.winner === t.a">
                    <app-badge [team]="B" /> {{ B.name }}
                  </span>
                </div>
                @for (l of t.legs; track $index; let li = $index) {
                  <div class="leg-label">
                    {{ t.legs.length > 1 ? (li === 0 ? 'Ida' : 'Volta') : l.neutral ? 'Jogo único · campo neutro' : 'Jogo único' }}
                  </div>
                  <app-match [champ]="c" [match]="l" [compact]="true" />
                }
                @if (t.winner) {
                  <div class="tie-foot">
                    @if (t.legs.length > 1 && t.agg) {
                      <span>Agregado {{ t.agg[0] }}×{{ t.agg[1] }}</span>
                    }
                    @if (t.pens) {
                      <span>
                        Pênaltis {{ t.pens[0] }}×{{ t.pens[1] }}
                        <button class="icon xs" title="Refazer pênaltis" (click)="rePens(r, ti)">↻</button>
                      </span>
                    }
                    <b>{{ team(t.winner).name }} {{ round.ties.length === 1 ? 'campeão 🏆' : 'avança' }}</b>
                  </div>
                }
              </div>
            }
            </div>
          </div>
        }
        @for (name of pending(); track name) {
          <div class="ko-col future">
            <h4>{{ name }}</h4>
            <div class="ko-ties"><div class="tie placeholder">A definir</div></div>
          </div>
        }
      </div>
    }
  `,
})
export class KoView {
  private readonly store = inject(Store);
  readonly champ = input.required<Champ>();

  team(id: string) {
    return tm(this.champ(), id);
  }
  canDraw() {
    const c = this.champ();
    return c.format === 'mata' && !c.ko!.rounds[0].ties.some((t) => t.legs.some(isPlayed));
  }
  pending() {
    const R = this.champ().ko!.rounds;
    const last = R[R.length - 1];
    const out: string[] = [];
    for (let size = last.ties.length; size > 1; size /= 2) out.push(roundName(size));
    return out;
  }
  simPhase() {
    const c = this.champ();
    simKoPhase(c);
    this.store.commit(c);
  }
  draw() {
    const c = this.champ();
    c.ko = { rounds: [buildRound(c, pairsFromSeeds(shuffle(c.teams.map((t) => t.id))))] };
    this.store.commit(c);
  }
  rePens(r: number, ti: number) {
    const c = this.champ();
    c.ko!.rounds[r].ties[ti].pens = simPens();
    this.store.commit(c);
  }
}

// ======================= Times & força =======================
@Component({
  selector: 'app-teams-view',
  imports: [Badge],
  template: `
    <div class="card">
      <div class="row wrap between">
        <div>
          <h3>Força dos times</h3>
          <p class="hint">
            A força (40–99) define as chances em cada jogo. Ajuste à vontade — vale para os próximos
            jogos simulados.
          </p>
        </div>
        <div class="row wrap">
          <button class="btn btn-ghost btn-sm" (click)="equalize()">Igualar todos (75)</button>
          <button class="btn btn-ghost btn-sm" (click)="restore()">Restaurar originais</button>
        </div>
      </div>
      <div class="ratings">
        @for (t of sorted(); track t.id) {
          <div class="rating-row">
            <app-badge [team]="t" />
            <span class="grow">{{ t.name }}</span>
            <input type="range" min="40" max="99" [value]="t.rating" (change)="set(t, $event)" />
            <input class="num-in" type="number" min="40" max="99" [value]="t.rating" (change)="set(t, $event)" />
          </div>
        }
      </div>
    </div>
  `,
})
export class TeamsView {
  private readonly store = inject(Store);
  readonly champ = input.required<Champ>();

  sorted() {
    return this.champ()
      .teams.slice()
      .sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name));
  }
  set(t: ChampTeam, ev: Event) {
    t.rating = clamp(Number((ev.target as HTMLInputElement).value) || 70, 40, 99);
    this.store.commit(this.champ());
  }
  equalize() {
    this.champ().teams.forEach((t) => (t.rating = 75));
    this.store.commit(this.champ());
  }
  restore() {
    this.champ().teams.forEach((t) => (t.rating = t.base));
    this.store.commit(this.champ());
  }
}

// ======================= Configurações =======================
@Component({
  selector: 'app-config-view',
  imports: [FormsModule],
  template: `
    @let c = champ();
    @let s = c.settings;
    <div class="card">
      <h3>Informações</h3>
      <div class="fields">
        <label class="span2">Nome <input [ngModel]="c.name" (change)="field('name', $event)" /></label>
        <label>Ano <input type="number" [ngModel]="c.year" (change)="field('year', $event)" /></label>
        <label>Divisão <input [ngModel]="c.division" (change)="field('division', $event)" /></label>
        <label class="span2">Região <input [ngModel]="c.country" (change)="field('country', $event)" /></label>
      </div>

      <h3>Simulação</h3>
      <div class="fields">
        <label class="span2">
          Aleatoriedade (fator zebra): {{ s.chaos }}%
          <input type="range" min="0" max="100" [ngModel]="s.chaos" (ngModelChange)="setS('chaos', $event)" />
        </label>
        <label class="check span2">
          <input type="checkbox" [ngModel]="s.homeAdv" (ngModelChange)="setS('homeAdv', $event)" />
          Vantagem para o mandante
        </label>
      </div>

      @if (c.format === 'ligamata') {
        <h3>Tabela</h3>
        <div class="fields">
          <label>Rebaixados <input type="number" min="0" [ngModel]="s.releg" (change)="releg($event)" /></label>
        </div>
      }
      @if (c.format === 'liga') {
        <h3>Zonas da tabela</h3>
        <div class="fields">
          <label>Zona 1 (nome) <input [ngModel]="s.z1.name" (change)="zone('z1', 'name', $event)" /></label>
          <label>Zona 1 (vagas) <input type="number" min="0" [ngModel]="s.z1.count" (change)="zone('z1', 'count', $event)" /></label>
          <label>Zona 2 (nome) <input [ngModel]="s.z2.name" (change)="zone('z2', 'name', $event)" /></label>
          <label>Zona 2 (vagas) <input type="number" min="0" [ngModel]="s.z2.count" (change)="zone('z2', 'count', $event)" /></label>
          <label>Rebaixados <input type="number" min="0" [ngModel]="s.releg" (change)="releg($event)" /></label>
        </div>
      }

      <h3>Estrutura</h3>
      <p class="hint">
        Formato: <b>{{ formatText() }}</b>. Para mudar formato ou participantes, crie um novo
        campeonato (ou duplique este). Gerar uma nova tabela apaga todos os resultados.
      </p>
      <div class="row wrap">
        <button class="btn btn-ghost" (click)="regen()">Gerar nova tabela de jogos</button>
        <button class="btn btn-ghost" (click)="store.exportData(c)">Exportar JSON</button>
        <button class="btn btn-danger" (click)="del()">Excluir campeonato</button>
      </div>
    </div>
  `,
})
export class ConfigView {
  protected readonly store = inject(Store);
  readonly champ = input.required<Champ>();
  readonly deleted = output<void>();

  private val(ev: Event) {
    return (ev.target as HTMLInputElement).value;
  }
  field(k: 'name' | 'year' | 'division' | 'country', ev: Event) {
    const c = this.champ();
    const v = this.val(ev);
    if (k === 'year') c.year = Number(v) || c.year;
    else c[k] = v.trim() || (k === 'name' ? c.name : '');
    this.store.commit(c);
  }
  setS(k: 'chaos' | 'homeAdv', v: number | boolean) {
    const c = this.champ();
    if (k === 'chaos') c.settings.chaos = Number(v);
    else c.settings.homeAdv = !!v;
    this.store.commit(c);
  }
  zone(z: 'z1' | 'z2', k: 'name' | 'count', ev: Event) {
    const c = this.champ();
    const v = this.val(ev);
    if (k === 'name') c.settings[z].name = v;
    else c.settings[z].count = clamp(Number(v) || 0, 0, c.teams.length);
    this.store.commit(c);
  }
  releg(ev: Event) {
    const c = this.champ();
    c.settings.releg = clamp(Number(this.val(ev)) || 0, 0, c.teams.length);
    this.store.commit(c);
  }
  formatText() {
    const c = this.champ();
    const s = c.settings;
    if (c.format === 'liga') return `pontos corridos, ${s.turnos === 2 ? 'turno e returno' : 'turno único'}`;
    const ko = `mata-mata em ${s.legs === 2 ? 'ida e volta' : 'jogo único'}${s.finalSingle ? ', final única' : ''}`;
    if (c.format === 'mata') return ko;
    if (c.format === 'ligamata') {
      return `pontos corridos (${s.turnos === 2 ? 'turno e returno' : 'turno único'}), ${s.qualify} classificados + ${ko}`;
    }
    return `${s.groups} grupos (${s.qualify} classificados cada) + ${ko}`;
  }
  regen() {
    if (!confirm('Gerar uma nova tabela? Todos os resultados deste campeonato serão apagados.')) return;
    const c = this.champ();
    const ids = shuffle(c.teams.map((t) => t.id));
    if (c.format === 'mata') c.ko = { rounds: [buildRound(c, pairsFromSeeds(c.teams.map((t) => t.id)))] };
    else if (c.format === 'grupos') {
      c.groups = makeGroups(c, ids, 'potes');
      c.ko = { rounds: [] };
    } else initStructure(c);
    this.store.uiOf(c.id).round = 0;
    this.store.commit(c);
  }
  del() {
    const c = this.champ();
    if (confirm(`Excluir "${c.name}"? Essa ação não pode ser desfeita.`)) this.deleted.emit();
  }
}
