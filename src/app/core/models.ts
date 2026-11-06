export interface Team {
  id: string;
  name: string;
  short: string;
  c1: string;
  c2: string;
  rating: number;
  country: string;
  /** sigla do estado (ou "Personalizado") */
  uf: string;
  /** caminho do escudo em public/ */
  logo?: string;
  custom?: boolean;
}

export interface ChampTeam {
  id: string;
  name: string;
  short: string;
  c1: string;
  c2: string;
  rating: number;
  base: number;
  logo?: string;
}

export interface Match {
  h: string;
  a: string;
  hg: number | null;
  ag: number | null;
  neutral?: boolean;
}

export interface Tie {
  a: string;
  b: string;
  legs: Match[];
  pens: [number, number] | null;
  winner: string | null;
  agg?: [number, number];
}

export interface KoRound {
  name: string;
  ties: Tie[];
}

export interface Group {
  name: string;
  teams: string[];
  rounds: Match[][];
}

export interface Zone {
  name: string;
  count: number;
}

export interface Settings {
  turnos: number;
  homeAdv: boolean;
  chaos: number;
  z1: Zone;
  z2: Zone;
  releg: number;
  legs: number;
  finalSingle: boolean;
  groups: number;
  groupTurnos: number;
  qualify: number;
}

export type Format = 'liga' | 'ligamata' | 'mata' | 'grupos';
export type GroupMode = 'potes' | 'ordem';

export interface Champ {
  id: string;
  name: string;
  year: number;
  division: string;
  country: string;
  format: Format;
  settings: Settings;
  teams: ChampTeam[];
  league?: { rounds: Match[][] };
  groups?: Group[];
  ko?: { rounds: KoRound[] };
  createdAt: number;
  updatedAt: number;
}

export interface Row {
  id: string;
  p: number;
  j: number;
  v: number;
  e: number;
  d: number;
  gp: number;
  gc: number;
  sg: number;
  last: ('V' | 'E' | 'D')[];
}

export const FORMAT_LABEL: Record<Format, string> = {
  liga: 'Pontos corridos',
  ligamata: 'Pontos corridos + mata-mata',
  mata: 'Mata-mata',
  grupos: 'Grupos + mata-mata',
};

export function defaultSettings(): Settings {
  return {
    turnos: 2,
    homeAdv: true,
    chaos: 25,
    z1: { name: 'Libertadores', count: 4 },
    z2: { name: 'Sul-Americana', count: 6 },
    releg: 4,
    legs: 2,
    finalSingle: true,
    groups: 4,
    groupTurnos: 1,
    qualify: 2,
  };
}
