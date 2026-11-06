import { Component, computed, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Store } from '../../core/store';
import { Champ } from '../../core/models';
import { champion, progress, resetChamp, simAll, tm } from '../../core/engine';
import { Badge } from '../../shared/shared';
import { ConfigView, GroupsView, KoView, LeagueView, ProbView, TeamsView } from './views';

type Tab = 'jogos' | 'prob' | 'grupos' | 'chave' | 'times' | 'config';

@Component({
  selector: 'app-champ-page',
  imports: [RouterLink, Badge, LeagueView, ProbView, GroupsView, KoView, TeamsView, ConfigView],
  template: `
    @if (champ(); as c) {
      <div class="champ-head">
        <div>
          <a routerLink="/" class="link">← Meus campeonatos</a>
          <h1>{{ c.name }}</h1>
          <div class="muted">
            {{ c.year }} · {{ c.division || '—' }}@if (c.country) { · {{ c.country }} } · {{ c.teams.length }} times
          </div>
        </div>
        <div class="row wrap">
          <button class="btn btn-primary" (click)="simAll(c)">⚡ Simular tudo</button>
          <button class="btn btn-ghost" (click)="reset(c)">↺ Reiniciar</button>
        </div>
      </div>

      @if (championOf(c); as t) {
        <div class="banner">
          <div class="trophy">🏆</div>
          <div>
            <div class="muted">Campeão · {{ c.name }}</div>
            <div class="banner-team"><app-badge [team]="t" size="lg" /> {{ t.name }}</div>
          </div>
        </div>
      }

      <div class="progress big" [title]="pct(c) + '% dos jogos disputados'">
        <div [style.width.%]="pct(c)"></div>
      </div>

      <nav class="tabs">
        @for (t of tabs(c); track t[0]) {
          <button [class.on]="tab(c) === t[0]" (click)="setTab(c, t[0])">{{ t[1] }}</button>
        }
      </nav>

      @switch (tab(c)) {
        @case ('jogos') { <app-league-view [champ]="c" /> }
        @case ('prob') { <app-prob-view [champ]="c" /> }
        @case ('grupos') { <app-groups-view [champ]="c" /> }
        @case ('chave') { <app-ko-view [champ]="c" /> }
        @case ('times') { <app-teams-view [champ]="c" /> }
        @case ('config') { <app-config-view [champ]="c" (deleted)="remove(c)" /> }
      }
    } @else {
      <div class="card empty">
        Campeonato não encontrado no cache deste navegador. <a routerLink="/" class="link">Voltar</a>
      </div>
    }
  `,
})
export class ChampPage {
  private readonly store = inject(Store);
  private readonly router = inject(Router);
  /** parâmetro :id da rota */
  readonly id = input.required<string>();
  protected readonly champ = computed(() => this.store.champs().find((c) => c.id === this.id()));

  tabs(c: Champ): [Tab, string][] {
    const common: [Tab, string][] = [
      ['times', 'Times & força'],
      ['config', 'Configurações'],
    ];
    if (c.format === 'liga') return [['jogos', 'Tabela & jogos'], ['prob', 'Probabilidades'], ...common];
    if (c.format === 'mata') return [['chave', 'Chaveamento'], ...common];
    if (c.format === 'ligamata') return [['jogos', '1ª fase'], ['chave', 'Mata-mata'], ...common];
    return [['grupos', 'Fase de grupos'], ['chave', 'Mata-mata'], ...common];
  }

  tab(c: Champ): Tab {
    const u = this.store.uiOf(c.id);
    const tabs = this.tabs(c);
    if (!tabs.some((t) => t[0] === u.tab)) u.tab = tabs[0][0];
    return u.tab as Tab;
  }
  setTab(c: Champ, t: Tab) {
    this.store.uiOf(c.id).tab = t;
  }

  championOf(c: Champ) {
    const id = champion(c);
    return id ? tm(c, id) : null;
  }
  pct(c: Champ) {
    return Math.round(progress(c) * 100);
  }

  simAll(c: Champ) {
    simAll(c);
    this.store.commit(c);
    if (c.format === 'grupos' || c.format === 'ligamata') this.setTab(c, 'chave');
  }
  reset(c: Champ) {
    if (!confirm('Apagar todos os resultados deste campeonato?')) return;
    resetChamp(c);
    this.store.uiOf(c.id).round = 0;
    this.store.commit(c);
  }
  remove(c: Champ) {
    this.store.remove(c.id);
    this.router.navigate(['/']);
  }
}
