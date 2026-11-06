import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Champ, Format, GroupMode, Settings, Team, defaultSettings } from './models';
import { clone, initStructure, sync, uid } from './engine';
import { TEAMS } from '../data/teams';
import { presetById } from '../data/presets';

const LS_KEY = 'simfut:v1';

export interface Draft {
  preset: string;
  year: number;
  name: string;
  division: string;
  country: string;
  format: Format;
  hist: boolean;
  groupMode: GroupMode;
  settings: Settings;
  selected: string[];
}

export interface ChampUi {
  tab?: string;
  round?: number;
}

@Injectable({ providedIn: 'root' })
export class Store {
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  readonly champs = signal<Champ[]>([]);
  readonly customTeams = signal<Team[]>([]);
  readonly toastMsg = signal<string | null>(null);
  /** estado de tela por campeonato (aba, rodada) — não é persistido */
  readonly ui = new Map<string, ChampUi>();
  private toastTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    if (!this.browser) return;
    try {
      const raw = localStorage.getItem(LS_KEY);
      const d = raw ? JSON.parse(raw) : null;
      if (d && Array.isArray(d.champs)) {
        // campeonatos antigos: preenche escudos que ainda não existiam
        for (const c of d.champs as Champ[]) {
          for (const t of c.teams) t.logo ??= TEAMS.find((x) => x.id === t.id)?.logo;
        }
        this.champs.set(d.champs);
        this.customTeams.set(Array.isArray(d.customTeams) ? d.customTeams : []);
      }
    } catch {
      /* cache corrompido: começa vazio */
    }
  }

  private persist() {
    if (!this.browser) return;
    try {
      localStorage.setItem(
        LS_KEY,
        JSON.stringify({ champs: this.champs(), customTeams: this.customTeams() }),
      );
    } catch {
      this.toast('Não foi possível salvar: o cache do navegador está cheio.');
    }
  }

  toast(msg: string) {
    this.toastMsg.set(msg);
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastMsg.set(null), 2600);
  }

  uiOf(id: string): ChampUi {
    let u = this.ui.get(id);
    if (!u) this.ui.set(id, (u = {}));
    return u;
  }

  get(id: string) {
    return this.champs().find((c) => c.id === id);
  }

  allTeams(): Team[] {
    return TEAMS.concat(this.customTeams());
  }

  teamById(id: string): Team | undefined {
    return TEAMS.find((t) => t.id === id) ?? this.customTeams().find((t) => t.id === id);
  }

  /** Salva alterações feitas (in place) no campeonato e notifica a interface. */
  commit(c: Champ) {
    c.updatedAt = Date.now();
    sync(c);
    this.champs.update((list) => list.map((x) => (x.id === c.id ? { ...c } : x)));
    this.persist();
  }

  add(c: Champ) {
    this.champs.update((l) => [...l, c]);
    this.persist();
  }

  remove(id: string) {
    this.champs.update((l) => l.filter((c) => c.id !== id));
    this.ui.delete(id);
    this.persist();
  }

  duplicate(id: string): Champ | undefined {
    const src = this.get(id);
    if (!src) return undefined;
    const c = clone(src);
    c.id = uid();
    c.name += ' (cópia)';
    c.createdAt = c.updatedAt = Date.now();
    this.add(c);
    return c;
  }

  addCustomTeam(t: Omit<Team, 'id' | 'country' | 'uf' | 'custom'>) {
    const team: Team = { ...t, id: 'x-' + uid(), country: 'Brasil', uf: 'Personalizado', custom: true };
    this.customTeams.update((l) => [...l, team]);
    this.persist();
    return team;
  }

  removeCustomTeam(id: string) {
    this.customTeams.update((l) => l.filter((t) => t.id !== id));
    this.persist();
  }

  // ---------- criação ----------
  newDraft(): Draft {
    return {
      preset: '',
      year: new Date().getFullYear(),
      name: '',
      division: '',
      country: 'Brasil',
      format: 'liga',
      hist: false,
      groupMode: 'potes',
      settings: defaultSettings(),
      selected: [],
    };
  }

  applyPreset(d: Draft, presetId: string, year: number) {
    const p = presetById(presetId);
    d.preset = presetId;
    if (!p) return;
    if (!p.years[year]) year = Math.max(...Object.keys(p.years).map(Number));
    d.year = year;
    d.name = p.name(year);
    d.division = p.division;
    d.country = 'Brasil';
    d.format = p.format(year);
    d.settings = { ...defaultSettings(), ...clone(p.settings(year)) };
    d.selected = p.years[year].slice();
    d.groupMode = p.groupMode ?? 'potes';
    d.hist = p.hist(year);
  }

  buildChamp(d: Draft): Champ {
    const p = presetById(d.preset);
    let hist: Map<string, number> | null = null;
    if (d.hist && p && p.hist(d.year) && p.years[d.year]) {
      // força pela campanha real: 1º = 85, último = 68
      const order = p.years[d.year];
      const n = order.length;
      hist = new Map(order.map((id, i) => [id, Math.round(85 - (i * 17) / Math.max(1, n - 1))]));
    }
    const teams = d.selected.map((id) => {
      const t = this.teamById(id)!;
      const r = hist?.get(id) ?? t.rating;
      return { id: t.id, name: t.name, short: t.short, c1: t.c1, c2: t.c2, rating: r, base: r, logo: t.logo };
    });
    const now = Date.now();
    const c: Champ = {
      id: uid(),
      name: d.name.trim() || 'Meu campeonato',
      year: Number(d.year) || new Date().getFullYear(),
      division: d.division.trim(),
      country: d.country.trim(),
      format: d.format,
      settings: clone(d.settings),
      teams,
      createdAt: now,
      updatedAt: now,
    };
    if (c.format === 'ligamata') {
      c.settings.z1 = { name: 'Mata-mata', count: c.settings.qualify };
      c.settings.z2 = { name: '', count: 0 };
    }
    initStructure(c, d.groupMode);
    sync(c);
    return c;
  }

  // ---------- backup ----------
  exportData(c?: Champ) {
    const data = c ? c : { champs: this.champs(), customTeams: this.customTeams() };
    const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (c ? c.name : 'simfut-backup').replace(/[^\w\-]+/g, '_') + '.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  importData(text: string): number {
    const data = JSON.parse(text);
    let n = 0;
    const list: Champ[] = [];
    const take = (c: Champ) => {
      if (c && c.id && c.format && Array.isArray(c.teams)) {
        c.id = uid();
        list.push(c);
        n++;
      }
    };
    if (Array.isArray(data?.champs)) {
      data.champs.forEach(take);
      const known = new Set(this.customTeams().map((t) => t.id));
      const extra = (Array.isArray(data.customTeams) ? data.customTeams : []).filter(
        (t: Team) => t && t.id && !known.has(t.id),
      );
      if (extra.length) this.customTeams.update((l) => [...l, ...extra]);
    } else take(data);
    this.champs.update((l) => [...l, ...list]);
    this.persist();
    return n;
  }
}
