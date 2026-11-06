import { Component, inject, input, signal } from '@angular/core';
import { Champ, Match, Row } from '../core/models';
import { clamp, isPlayed, simMatch, tm, zoneOf } from '../core/engine';
import { Store } from '../core/store';

interface BadgeTeam {
  c1: string;
  c2: string;
  short: string;
  logo?: string;
}

@Component({
  selector: 'app-badge',
  template: `
    @if (team().logo && !failed()) {
      <img
        class="crest"
        [class.lg]="size() === 'lg'"
        [src]="team().logo"
        [alt]="team().short"
        [title]="team().short"
        loading="lazy"
        (error)="failed.set(true)"
      />
    } @else {
      <span
        class="badge"
        [class.lg]="size() === 'lg'"
        [title]="team().short"
        [style.background]="'linear-gradient(135deg,' + team().c1 + ' 50%,' + team().c2 + ' 50%)'"
      ></span>
    }
  `,
})
export class Badge {
  readonly team = input.required<BadgeTeam>();
  readonly size = input<'md' | 'lg'>('md');
  protected readonly failed = signal(false);
}

/** Foca o próximo campo de placar da página (Enter avança). */
function focusNextScore(el: HTMLInputElement) {
  const all = Array.from(document.querySelectorAll<HTMLInputElement>('input.score'));
  const next = all[all.indexOf(el) + 1];
  if (next) {
    next.focus();
    next.select();
  } else el.blur();
}

@Component({
  selector: 'app-match',
  imports: [Badge],
  template: `
    @let h = home();
    @let a = away();
    <div class="match" [class.played]="played()" [class.compact]="compact()">
      <div class="side home">
        <span class="full">{{ h.name }}</span><span class="abbr">{{ h.short }}</span>
        <app-badge [team]="h" />
      </div>
      <input
        class="score"
        type="number"
        min="0"
        max="99"
        inputmode="numeric"
        [attr.aria-label]="'Gols ' + h.name"
        [value]="match().hg ?? ''"
        (change)="set('hg', $event)"
        (keydown.enter)="enter($event)"
        (focus)="selectAll($event)"
      />
      <span class="x">×</span>
      <input
        class="score"
        type="number"
        min="0"
        max="99"
        inputmode="numeric"
        [attr.aria-label]="'Gols ' + a.name"
        [value]="match().ag ?? ''"
        (change)="set('ag', $event)"
        (keydown.enter)="enter($event)"
        (focus)="selectAll($event)"
      />
      <div class="side away">
        <app-badge [team]="a" />
        <span class="full">{{ a.name }}</span><span class="abbr">{{ a.short }}</span>
      </div>
      <button class="icon" title="Simular este jogo" (click)="sim()">🎲</button>
    </div>
  `,
})
export class MatchRow {
  private readonly store = inject(Store);
  readonly champ = input.required<Champ>();
  readonly match = input.required<Match>();
  readonly compact = input(false);

  home() {
    return tm(this.champ(), this.match().h);
  }
  away() {
    return tm(this.champ(), this.match().a);
  }
  played() {
    return isPlayed(this.match());
  }

  set(side: 'hg' | 'ag', ev: Event) {
    const raw = (ev.target as HTMLInputElement).value.trim();
    const n = parseInt(raw, 10);
    this.match()[side] = raw === '' || isNaN(n) ? null : clamp(n, 0, 99);
    this.store.commit(this.champ());
  }

  sim() {
    simMatch(this.champ(), this.match());
    this.store.commit(this.champ());
  }

  enter(ev: Event) {
    ev.preventDefault();
    focusNextScore(ev.target as HTMLInputElement);
  }

  selectAll(ev: Event) {
    (ev.target as HTMLInputElement).select();
  }
}

@Component({
  selector: 'app-standings',
  imports: [Badge],
  template: `
    <table class="tbl">
      <thead>
        <tr>
          <th>#</th>
          <th class="l">Time</th>
          <th>P</th>
          <th>J</th>
          <th>V</th>
          <th class="hide-s">E</th>
          <th class="hide-s">D</th>
          <th class="hide-s">GP</th>
          <th class="hide-s">GC</th>
          <th>SG</th>
          @if (mode() === 'liga') {
            <th class="hide-s">%</th>
            <th class="hide-m">Últimos</th>
          }
        </tr>
      </thead>
      <tbody>
        @for (r of rows(); track r.id; let i = $index) {
          @let t = team(r.id);
          <tr [class]="zone(i)">
            <td class="pos"><span>{{ i + 1 }}</span></td>
            <td class="l team">
              <app-badge [team]="t" />
              <span class="full">{{ t.name }}</span><span class="abbr">{{ t.short }}</span>
            </td>
            <td class="pts">{{ r.p }}</td>
            <td>{{ r.j }}</td>
            <td>{{ r.v }}</td>
            <td class="hide-s">{{ r.e }}</td>
            <td class="hide-s">{{ r.d }}</td>
            <td class="hide-s">{{ r.gp }}</td>
            <td class="hide-s">{{ r.gc }}</td>
            <td>{{ r.sg > 0 ? '+' : '' }}{{ r.sg }}</td>
            @if (mode() === 'liga') {
              <td class="hide-s">{{ r.j ? ((r.p / (r.j * 3)) * 100).toFixed(0) : 0 }}</td>
              <td class="hide-m">
                <span class="form">
                  @for (x of r.last; track $index) {
                    <i [class]="'f-' + x">{{ x }}</i>
                  }
                </span>
              </td>
            }
          </tr>
        }
      </tbody>
    </table>
  `,
})
export class Standings {
  readonly champ = input.required<Champ>();
  readonly rows = input.required<Row[]>();
  readonly mode = input<'liga' | 'group'>('liga');
  readonly qualify = input(0);

  team(id: string) {
    return tm(this.champ(), id);
  }

  zone(i: number) {
    if (this.mode() === 'group') return i < this.qualify() ? 'z1' : '';
    return zoneOf(this.champ(), i + 1, this.rows().length);
  }
}
