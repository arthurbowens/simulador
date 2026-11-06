import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Draft, Store } from '../core/store';
import { Format, Team } from '../core/models';
import { isPow2, shuffle } from '../core/engine';
import { PRESETS, Preset, presetById, presetYears } from '../data/presets';
import { Badge } from '../shared/shared';

@Component({
  selector: 'app-new-champ',
  imports: [RouterLink, FormsModule, Badge],
  template: `
    <div class="champ-head">
      <div>
        <a routerLink="/" class="link">← Voltar</a>
        <h1>Novo campeonato</h1>
      </div>
    </div>

    <div class="form-grid">
      <div class="card">
        <h3>1. Modelo</h3>
        <div class="fields">
          <label>
            Modelo base
            <select [ngModel]="d.preset" (ngModelChange)="pickPreset($event)">
              <option value="">Personalizado (do zero)</option>
              @for (p of presets; track p.id) {
                <option [value]="p.id">{{ p.label }}</option>
              }
            </select>
          </label>
          @if (preset(); as p) {
            @if (years(p).length > 1) {
              <label>
                Temporada
                <select [ngModel]="d.year" (ngModelChange)="pickYear($event)">
                  @for (y of years(p); track y) {
                    <option [ngValue]="y">{{ y }}</option>
                  }
                </select>
              </label>
            }
          }
        </div>
        @if (preset(); as p) {
          @if (p.hist(d.year)) {
            <label class="check">
              <input type="checkbox" [(ngModel)]="d.hist" />
              Força dos times baseada na campanha real de {{ d.year }}
            </label>
          }
          @if (p.note?.(d.year); as note) {
            <p class="hint note">{{ note }}</p>
          }
          <p class="hint">
            O modelo preenche nome, times e regras — você pode alterar tudo abaixo antes de criar.
          </p>
        }

        <h3>2. Informações</h3>
        <div class="fields">
          <label class="span2">
            Nome
            <input [(ngModel)]="d.name" placeholder="Ex.: Brasileirão 2010" />
          </label>
          <label>
            Ano
            <input type="number" [(ngModel)]="d.year" />
          </label>
          <label>
            Divisão
            <input [(ngModel)]="d.division" list="div-list" placeholder="Série A" />
            <datalist id="div-list">
              @for (x of divisions; track x) {
                <option [value]="x"></option>
              }
            </datalist>
          </label>
          <label class="span2">
            Região
            <input [(ngModel)]="d.country" placeholder="Brasil" />
          </label>
        </div>

        <h3>3. Formato</h3>
        <div class="seg">
          @for (f of formats; track f[0]) {
            <button [class.on]="d.format === f[0]" (click)="d.format = f[0]">{{ f[1] }}</button>
          }
        </div>
        <div class="fields">
          @switch (d.format) {
            @case ('liga') {
              <label>
                Turnos
                <select [(ngModel)]="d.settings.turnos">
                  <option [ngValue]="1">Turno único</option>
                  <option [ngValue]="2">Turno e returno</option>
                </select>
              </label>
              <label>
                Rebaixados
                <input type="number" min="0" [(ngModel)]="d.settings.releg" />
              </label>
              <label>
                Zona 1 (nome)
                <input [(ngModel)]="d.settings.z1.name" />
              </label>
              <label>
                Zona 1 (vagas)
                <input type="number" min="0" [(ngModel)]="d.settings.z1.count" />
              </label>
              <label>
                Zona 2 (nome)
                <input [(ngModel)]="d.settings.z2.name" />
              </label>
              <label>
                Zona 2 (vagas)
                <input type="number" min="0" [(ngModel)]="d.settings.z2.count" />
              </label>
            }
            @case ('ligamata') {
              <label>
                Turnos
                <select [(ngModel)]="d.settings.turnos">
                  <option [ngValue]="1">Turno único</option>
                  <option [ngValue]="2">Turno e returno</option>
                </select>
              </label>
              <label>
                Classificados ao mata-mata
                <select [(ngModel)]="d.settings.qualify">
                  @for (q of [2, 4, 8, 16]; track q) {
                    <option [ngValue]="q">{{ q }}</option>
                  }
                </select>
              </label>
              <label>
                Rebaixados
                <input type="number" min="0" [(ngModel)]="d.settings.releg" />
              </label>
            }
            @case ('grupos') {
              <label>
                Nº de grupos
                <input type="number" min="1" [(ngModel)]="d.settings.groups" />
              </label>
              <label>
                Classificados por grupo
                <input type="number" min="1" [(ngModel)]="d.settings.qualify" />
              </label>
              <label>
                Jogos nos grupos
                <select [(ngModel)]="d.settings.groupTurnos">
                  <option [ngValue]="1">Só ida</option>
                  <option [ngValue]="2">Ida e volta</option>
                </select>
              </label>
              <label>
                Montagem dos grupos
                <select [(ngModel)]="d.groupMode">
                  <option value="potes">Sorteio por potes (força)</option>
                  <option value="ordem">Na ordem da lista</option>
                </select>
              </label>
            }
          }
          @if (d.format !== 'liga') {
            <label>
              Confrontos do mata-mata
              <select [(ngModel)]="d.settings.legs">
                <option [ngValue]="1">Jogo único</option>
                <option [ngValue]="2">Ida e volta</option>
              </select>
            </label>
            <label class="check">
              <input type="checkbox" [(ngModel)]="d.settings.finalSingle" />
              Final em jogo único (campo neutro)
            </label>
          }
        </div>
        <div class="fields">
          <label class="span2">
            Aleatoriedade (fator zebra): {{ d.settings.chaos }}%
            <input type="range" min="0" max="100" [(ngModel)]="d.settings.chaos" />
          </label>
          <label class="check span2">
            <input type="checkbox" [(ngModel)]="d.settings.homeAdv" />
            Vantagem para o mandante
          </label>
        </div>
      </div>

      <div class="card">
        <h3>4. Times <span class="pill">{{ d.selected.length }}</span></h3>
        <div class="picker">
          <div class="pick-col">
            <div class="row">
              <select [(ngModel)]="filterCountry">
                <option value="">Todos os estados</option>
                @for (c of ufs(); track c) {
                  <option [value]="c">{{ c }}</option>
                }
              </select>
              <input type="search" placeholder="Buscar time…" [(ngModel)]="search" />
            </div>
            <div class="pick-list">
              @for (t of available(); track t.id) {
                <div class="pick-item" (click)="add(t.id)">
                  <app-badge [team]="t" />
                  <span class="grow">{{ t.name }} <small class="muted">{{ t.uf }}</small></span>
                  <span class="rating">{{ t.rating }}</span>
                  @if (t.custom) {
                    <button class="icon xs danger" title="Apagar time" (click)="delCustom($event, t)">✕</button>
                  }
                  <span class="plus">+</span>
                </div>
              } @empty {
                <div class="muted pad">Nenhum time encontrado.</div>
              }
            </div>
            <div class="row wrap">
              <button class="btn btn-ghost btn-sm" (click)="addFiltered()">+ Adicionar todos da lista</button>
            </div>
            <details class="custom-team">
              <summary>Criar time personalizado</summary>
              <div class="fields">
                <label class="span2">Nome <input [(ngModel)]="ct.name" placeholder="Meu Time FC" /></label>
                <label>Sigla <input [(ngModel)]="ct.short" maxlength="4" placeholder="MTF" /></label>
                <label>Força (40–99) <input type="number" min="40" max="99" [(ngModel)]="ct.rating" /></label>
                <label>Cor 1 <input type="color" [(ngModel)]="ct.c1" /></label>
                <label>Cor 2 <input type="color" [(ngModel)]="ct.c2" /></label>
              </div>
              <button class="btn btn-sm" (click)="createCustom()">Criar e adicionar</button>
            </details>
          </div>

          <div class="pick-col">
            <div class="row wrap sel-tools">
              <button class="btn btn-ghost btn-sm" (click)="d.selected = shuffleSel()">Embaralhar</button>
              <button class="btn btn-ghost btn-sm" (click)="sortByRating()">Ordenar por força</button>
              <button class="btn btn-ghost btn-sm" (click)="d.selected = []">Limpar</button>
            </div>
            <div class="pick-list sel">
              @for (id of d.selected; track id; let i = $index) {
                @if (team(id); as t) {
                  <div class="pick-item">
                    <span class="num">{{ i + 1 }}</span>
                    <app-badge [team]="t" />
                    <span class="grow">{{ t.name }}</span>
                    <span class="rating">{{ t.rating }}</span>
                    <button class="icon xs" title="Subir" (click)="up(i)" [disabled]="i === 0">↑</button>
                    <button class="icon xs danger" title="Remover" (click)="remove(i)">✕</button>
                  </div>
                }
              } @empty {
                <div class="muted pad">Clique nos times à esquerda para adicioná-los.</div>
              }
            </div>
            @if (d.format === 'mata' || d.format === 'grupos') {
              <p class="hint">
                A ordem define os cabeças de chave (1º enfrenta o último).
                @if (d.format === 'grupos') { No modo "na ordem da lista", cada bloco de times forma um grupo. }
              </p>
            }
          </div>
        </div>
      </div>
    </div>

    <div class="create-bar card">
      <span class="hint" [class.err]="!!error()">{{ error() ?? summary() }}</span>
      <button class="btn btn-primary" [disabled]="!!error()" (click)="create()">Criar campeonato</button>
    </div>
  `,
})
export class NewChampPage {
  private readonly store = inject(Store);
  private readonly router = inject(Router);

  protected d: Draft = this.store.newDraft();
  protected filterCountry = '';
  protected search = '';
  protected ct = { name: '', short: '', rating: 72, c1: '#1e40af', c2: '#ffffff' };

  protected readonly formats: [Format, string][] = [
    ['liga', 'Pontos corridos'],
    ['ligamata', 'Pontos corridos + mata-mata'],
    ['mata', 'Mata-mata'],
    ['grupos', 'Grupos + mata-mata'],
  ];
  protected readonly divisions = ['Série A', 'Série B', 'Série C', 'Série D', '1ª divisão', '2ª divisão', 'Copa', 'Amistoso'];
  protected readonly presets = PRESETS;

  preset() {
    return presetById(this.d.preset);
  }
  years(p: Preset) {
    return presetYears(p);
  }
  pickPreset(id: string) {
    if (!id) {
      this.d.preset = '';
      return;
    }
    this.store.applyPreset(this.d, id, this.d.year);
  }
  pickYear(y: number) {
    this.store.applyPreset(this.d, this.d.preset, y);
  }

  team(id: string) {
    return this.store.teamById(id);
  }

  ufs() {
    return [...new Set(this.store.allTeams().map((t) => t.uf))].sort((a, b) =>
      a === 'Personalizado' ? 1 : b === 'Personalizado' ? -1 : a.localeCompare(b),
    );
  }

  available(): Team[] {
    const sel = new Set(this.d.selected);
    const q = this.search
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '');
    return this.store.allTeams().filter((t) => {
      if (sel.has(t.id)) return false;
      if (this.filterCountry && t.uf !== this.filterCountry) return false;
      if (!q) return true;
      const name = t.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      return name.includes(q) || t.short.toLowerCase().includes(q);
    });
  }

  add(id: string) {
    if (!this.d.selected.includes(id)) this.d.selected = [...this.d.selected, id];
  }
  addFiltered() {
    this.d.selected = [...this.d.selected, ...this.available().map((t) => t.id)];
  }
  remove(i: number) {
    this.d.selected = this.d.selected.filter((_, j) => j !== i);
  }
  up(i: number) {
    const s = this.d.selected.slice();
    [s[i - 1], s[i]] = [s[i], s[i - 1]];
    this.d.selected = s;
  }
  shuffleSel() {
    return shuffle(this.d.selected);
  }
  sortByRating() {
    this.d.selected = this.d.selected
      .slice()
      .sort((a, b) => (this.team(b)?.rating ?? 0) - (this.team(a)?.rating ?? 0));
  }

  createCustom() {
    const name = this.ct.name.trim();
    if (!name) return this.store.toast('Dê um nome ao time');
    const short = (this.ct.short.trim() || name.slice(0, 3)).toUpperCase();
    const rating = Math.max(40, Math.min(99, Number(this.ct.rating) || 70));
    const t = this.store.addCustomTeam({ name, short, rating, c1: this.ct.c1, c2: this.ct.c2 });
    this.add(t.id);
    this.ct = { ...this.ct, name: '', short: '' };
  }
  delCustom(ev: Event, t: Team) {
    ev.stopPropagation();
    if (confirm(`Apagar o time "${t.name}"? (campeonatos já criados não são afetados)`)) {
      this.store.removeCustomTeam(t.id);
    }
  }

  error(): string | null {
    const n = this.d.selected.length;
    const s = this.d.settings;
    if (n < 2) return 'Selecione pelo menos 2 times.';
    if (this.d.format === 'mata' && !isPow2(n)) {
      return `Mata-mata precisa de 2, 4, 8, 16, 32 ou 64 times (você tem ${n}).`;
    }
    if (this.d.format === 'grupos') {
      const G = Number(s.groups);
      if (!G || n % G) return `${n} times não se dividem igualmente em ${G} grupos.`;
      const size = n / G;
      if (size < 2) return 'Cada grupo precisa de pelo menos 2 times.';
      if (s.qualify < 1 || s.qualify >= size) return `Classificados por grupo deve ser entre 1 e ${size - 1}.`;
      if (!isPow2(G * s.qualify)) {
        return `Total de classificados (${G * s.qualify}) precisa ser 2, 4, 8, 16 ou 32.`;
      }
    }
    if (this.d.format === 'ligamata') {
      if (!isPow2(s.qualify) || s.qualify > n) return `Classificados ao mata-mata (${s.qualify}) deve ser 2, 4, 8 ou 16 e no máximo ${n}.`;
      if (s.qualify + s.releg > n) return 'Classificados + rebaixados somam mais que o número de times.';
    }
    if (this.d.format === 'liga' && s.z1.count + s.z2.count + s.releg > n) {
      return 'As zonas da tabela somam mais vagas que o número de times.';
    }
    return null;
  }

  summary() {
    const n = this.d.selected.length;
    if (this.d.format === 'liga') {
      const jogos = ((n * (n - 1)) / 2) * this.d.settings.turnos;
      const rodadas = (n % 2 ? n : n - 1) * this.d.settings.turnos;
      return `${n} times · ${rodadas} rodadas · ${jogos} jogos`;
    }
    if (this.d.format === 'ligamata') {
      const rodadas = (n % 2 ? n : n - 1) * this.d.settings.turnos;
      return `${n} times · ${rodadas} rodadas na 1ª fase · ${this.d.settings.qualify} no mata-mata`;
    }
    if (this.d.format === 'grupos') {
      return `${n} times · ${this.d.settings.groups} grupos de ${n / this.d.settings.groups} · ${this.d.settings.groups * this.d.settings.qualify} no mata-mata`;
    }
    return `${n} times no mata-mata`;
  }

  create() {
    if (this.error()) return;
    const c = this.store.buildChamp(this.d);
    this.store.add(c);
    this.router.navigate(['/c', c.id]);
  }
}
