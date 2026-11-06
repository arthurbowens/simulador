import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Store } from '../core/store';
import { Champ, FORMAT_LABEL } from '../core/models';
import { champion, progress, tm } from '../core/engine';
import { PRESETS, presetById, presetYears } from '../data/presets';
import { Badge } from '../shared/shared';

@Component({
  selector: 'app-home',
  imports: [RouterLink, FormsModule, Badge],
  template: `
    <section class="hero card">
      <div class="hero-text">
        <h1>Simulador de resultados de futebol</h1>
        <p>
          Monte campeonatos com clubes brasileiros reais: escolha ano, divisão (Séries A, B e C), formato e participantes. Depois
          simule rodada a rodada, tudo de uma vez ou digite os placares você mesmo.
        </p>
      </div>
      <div class="quick">
        <label class="lbl">Início rápido</label>
        <div class="row wrap">
          <select [(ngModel)]="qPreset" (ngModelChange)="fixYear()">
            @for (p of presets; track p.id) {
              <option [value]="p.id">{{ p.label }}</option>
            }
          </select>
          <select [(ngModel)]="qYear">
            @for (y of years(); track y) {
              <option [ngValue]="y">{{ y }}</option>
            }
          </select>
          <button class="btn btn-primary" (click)="quick()">Criar</button>
        </div>
        <a routerLink="/novo" class="link">ou monte um campeonato personalizado →</a>
      </div>
    </section>

    <section>
      <div class="section-head">
        <h2>Meus campeonatos</h2>
        <div class="row wrap">
          <button class="btn btn-ghost btn-sm" (click)="store.exportData()" [disabled]="!champs().length">
            Exportar backup
          </button>
          <label class="btn btn-ghost btn-sm">
            Importar
            <input type="file" accept=".json,application/json" hidden (change)="import($event)" />
          </label>
        </div>
      </div>

      @if (champs().length) {
        <div class="cards">
          @for (c of champs(); track c.id) {
            @let ch = champOf(c);
            @let p = prog(c);
            <a class="champ-card card" [routerLink]="['/c', c.id]">
              <div class="cc-top">
                <span class="tag">{{ formatLabel[c.format] }}</span>
                <span class="muted">{{ c.teams.length }} times</span>
              </div>
              <h3>{{ c.name }}</h3>
              <div class="muted">
                {{ c.year }} · {{ c.division || '—' }}@if (c.country) { · {{ c.country }} }
              </div>
              <div class="progress"><div [style.width.%]="p"></div></div>
              <div class="cc-foot">
                @if (ch) {
                  <span class="cc-champ">🏆 <app-badge [team]="ch" /> {{ ch.name }}</span>
                } @else {
                  <span class="muted">{{ p }}% simulado</span>
                }
                <span class="row">
                  <button class="icon" title="Duplicar" (click)="dup($event, c)">⧉</button>
                  <button class="icon danger" title="Excluir" (click)="del($event, c)">🗑</button>
                </span>
              </div>
            </a>
          }
        </div>
      } @else {
        <div class="card empty">
          Nenhum campeonato ainda. Use o início rápido acima (ex.: Brasileirão Série A 2010) ou crie
          um do zero.
        </div>
      }
    </section>
  `,
})
export class HomePage {
  protected readonly store = inject(Store);
  private readonly router = inject(Router);
  protected readonly presets = PRESETS;
  protected readonly formatLabel = FORMAT_LABEL;
  protected qPreset = 'br-a';
  protected qYear = 2010;

  protected readonly champs = computed(() =>
    this.store
      .champs()
      .slice()
      .sort((a, b) => b.updatedAt - a.updatedAt),
  );

  years() {
    return presetYears(presetById(this.qPreset)!);
  }
  fixYear() {
    const ys = this.years();
    if (!ys.includes(this.qYear)) this.qYear = ys[0];
  }

  quick() {
    const d = this.store.newDraft();
    this.store.applyPreset(d, this.qPreset, this.qYear);
    const c = this.store.buildChamp(d);
    this.store.add(c);
    this.router.navigate(['/c', c.id]);
  }

  champOf(c: Champ) {
    const id = champion(c);
    return id ? tm(c, id) : null;
  }
  prog(c: Champ) {
    return Math.round(progress(c) * 100);
  }

  dup(ev: Event, c: Champ) {
    ev.preventDefault();
    ev.stopPropagation();
    this.store.duplicate(c.id);
    this.store.toast('Campeonato duplicado');
  }

  del(ev: Event, c: Champ) {
    ev.preventDefault();
    ev.stopPropagation();
    if (confirm(`Excluir "${c.name}"? Essa ação não pode ser desfeita.`)) this.store.remove(c.id);
  }

  import(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const f = input.files?.[0];
    if (!f) return;
    f.text().then((txt) => {
      try {
        const n = this.store.importData(txt);
        this.store.toast(`${n} campeonato(s) importado(s)`);
      } catch {
        this.store.toast('Arquivo inválido');
      }
      input.value = '';
    });
  }
}
