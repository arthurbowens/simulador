import { Format, GroupMode, Settings } from '../core/models';

export interface Preset {
  id: string;
  label: string;
  division: string;
  years: Record<number, string[]>;
  name: (y: number) => string;
  format: (y: number) => Format;
  settings: (y: number) => Partial<Settings>;
  /** true quando a lista do ano está na ordem da classificação final real */
  hist: (y: number) => boolean;
  groupMode?: GroupMode;
  /** observação mostrada na criação (simplificações de formato etc.) */
  note?: (y: number) => string | null;
}

function years(src: Record<number, string>): Record<number, string[]> {
  const out: Record<number, string[]> = {};
  for (const [y, list] of Object.entries(src)) out[Number(y)] = list.trim().split(/\s+/);
  return out;
}

/** Série A — times na ordem da classificação final de cada ano (2026 em andamento). */
const BR_A = years({
  2003: 'cru san spfc sca cfc int cam fla goi par fig cap gua vit juv cor flu vas gre cri pon pay for bah',
  2004: 'san cap spfc pal cor goi juv int fig sca cru cfc par pon flu vas bot fla cam pay vit cri gua gre',
  2005: 'cor int goi pal flu cap par cru bot san spfc vas juv pon for fla fig sca cfc cam pay brs',
  2006: 'spfc int gre san par vas fig goi cru fla bot cap cor juv flu pal pon for sca stc',
  2007: 'spfc san fla flu cru gre pal cam bot vas int spt cap nau goi fig cor par juv amr',
  2008: 'spfc gre cru pal fla int bot goi cfc vit spt cam san cap flu nau fig vas lus ipa',
  2009: 'fla int spfc cru pal ava cam gre goi cor bar san vit cap bot flu cfc sta nau spt',
  2010: 'flu cru cor gre cap bot int san spfc pal vas cea cam fla ava acg vit gua goi pru',
  2011: 'cor vas flu fla int spfc fig cfc bot san pal gre acg bah cam cru cap cea amg ava',
  2012: 'flu cam gre spfc vas cor bot san cru int fla nau cfc pon bah lus spt pal acg fig',
  2013: 'cru gre cap bot vit goi san cam spfc cor cfc bah int cri flu fla lus vas pon nau',
  2014: 'cru spfc int cor cam flu gre cap san fla spt goi fig cha cfc pal vit bah bot cri',
  2015: 'cor cam gre spfc int spt san cru pal cap pon fla flu cha cfc fig ava vas goi jec',
  2016: 'pal san fla cam bot cap cor pon gre spfc cha cru flu spt cfc vit int fig stc amg',
  2017: 'cor pal san gre cru fla vas cha cam bot cap bah spfc flu spt vit cfc ava pon acg',
  2018: 'pal fla int gre spfc cam cap cru bot san bah flu cor cha cea vas spt amg vit par',
  2019: 'fla san pal gre cap spfc int cor for goi bah vas cam flu bot cea cru csa cha ava',
  2020: 'fla int cam spfc flu gre pal san cap rbb cea cor acg bah spt for vas goi cfc bot',
  2021: 'cam fla pal for cor rbb flu amg acg san cea int spfc cap cui juv gre bah spt cha',
  2022: 'pal int flu cor fla cap cam for spfc amg bot san goi rbb cfc cui cea acg ava juv',
  2023: 'pal gre cam fla bot rbb flu cap int for spfc cui cor cru vas bah san goi cfc amg',
  2024: 'bot pal fla for int spfc cor bah cru vas vit cam flu gre juv rbb cap cri acg cui',
  2025: 'fla pal cru mir flu bot bah spfc gre rbb cam san cor vas vit int cea for juv spt',
  2026: 'fla pal cru flu cap bah cam rbb san spfc bot cfc vas mir vit int cor gre rem cha',
});

/** Série B — ordem da classificação final (2026 em andamento). */
const BR_B = years({
  2006: 'cam spt nau amr pau cfc sta brs mar itu gam rem ava lus cea crb pay gua sra vno',
  2007: 'cfc ipa lus vit for mar cri crb brs sca pon gam bar sta ava cea pau stc rem itu',
  2008: 'cor sta ava bar pon vno rbb juv sca bah par cea abc brs amr for mar cri gam crb',
  2009: 'vas gua cea acg lus fig sca dqc rbb par pon bah vno brs ipa amr juv for cpn abc',
  2010: 'cfc fig bah amg lus spt par rbb asa sca dqc ica nau pon gtg vno brs sta ipa amr',
  2011: 'lus nau pon spt vit rbb boa amc bar abc goi gua par cri sca asa ica vno sal dqc',
  2012: 'goi cri cap vit sca jec ava amg amr par cea abc asa rbb boa gtg crb gua ipa bar',
  2013: 'pal cha spt fig ica jec cea par amg ava boa rbb amr abc oes acg gtg pay sca asa',
  2014: 'jec pon vas ava amg boa acg cea stc sam par luv nau abc oes rbb amr ica vno lus',
  2015: 'bot stc vit amg nau rbb pay sam bah luv crb cri par acg cea oes mac abc boa mog',
  2016: 'acg ava vas bah nau lon crb cri luv cea bpe vno goi pay par oes jec tup rbb sam',
  2017: 'amg int cea par lon oes vno bpe juv boa pay fig cri goi crb gua luv stc abc nau',
  2018: 'for csa ava goi pon acg vno lon gua cfc bpe crb sbe cri fig oes pay sam juv boa',
  2019: 'rbb spt cfc acg amg par crb cui bfs ope pon vit gua bpe oes fig lon sbe cri vno',
  2020: 'cha amg juv cui csa sam pon ope ava crb cru bpe gua vit con nau fig par bfs oes',
  2021: 'bot goi cfc ava csa gua crb nau vno vas pon ope bru cru sam lon rem vit con bpe',
  2022: 'cru gre bah vas sam itu spt cri lon gua crb pon vno cha tom nov csa bru ope nau',
  2023: 'vit juv cri acg nov mir spt vno crb gua cea bfs ava itu pon cha sam tom lon abc',
  2024: 'san mir spt cea nov goi ope amg vno ava ama cfc pay bfs cha crb pon itu bru gua',
  2025: 'cfc cap cha rem cri goi nov crb ava cui acg ope vno amg ath bfs fer ama vre pay',
  2026: 'nov juv vno cri for crb goi spt acg sbc bfs ope cui ath nau cea ava lon amg pon',
});

/** Série C — ordem da classificação geral final (fase alcançada, depois pontos). */
const BR_C = years({
  2016: 'boa gua abc juv bfs for bpb asa tom ypi rem cui con sal mog mac amr lus riv gtg',
  2017: 'csa for sbe sam tup vre tom con jec bfs sal ypi cui rem bpb rbb mot mac mog asa',
  2018: 'ope cui bfs rbb nau aac stc bpb luv con tom ypi rem glo abc vre tup jua sal jec',
  2019: 'nau sam juv con pay imp ypi sjo rem frv bpb vre stc tom boa tre abc glo luv aac',
  2020: 'vno rem lon bru stc ypi pay itu tom man jac frv vre sjo bpb cri tre sbe boa imp',
  2021: 'itu tom nov cri ypi bpb man pay fig vre frv sjo bfs alt flo mir jac par stc oes',
  2022: 'mir abc bfs vit fig pay vre apa bpb ypi sjo rem man con flo alt ace bpe frv cpn',
  2023: 'ama bru ope pay vre sjo sbc bpb con nau rem csa ypi flo apa fig man amr alt pou',
  2024: 'vre ath fer rem bpb sbc ypi lon nau csa fig tom con abc cax flo sam apa frv sjo',
  2025: 'pon lon nau sbc cax bru gua flo con ypi mga itu bpb fig ana ita csa abc ret tom',
  2026: 'mga fer stc inl bru bpb flo pay ypi gua fig mra ama cax itu vre brr ana ita con',
  // 2027 (provisório): 3 rebaixados da B 2026 já definidos + 6 acessos da D + 14 que permaneceram;
  // o 4º rebaixado da Série B 2026 ainda não está definido
  2027: 'amg lon pon abc asa gam goa nac ube ama ana brr bpb bru cax fig flo gua itu mra pay vre ypi',
});

export const PRESETS: Preset[] = [
  {
    id: 'br-a',
    label: 'Brasileirão Série A',
    division: 'Série A',
    years: BR_A,
    name: (y) => `Brasileirão Série A ${y}`,
    format: () => 'liga',
    settings: (y) => ({
      turnos: 2,
      z1: { name: 'Libertadores', count: y >= 2017 ? 6 : 4 },
      z2: { name: 'Sul-Americana', count: 6 },
      releg: y === 2003 ? 2 : 4,
    }),
    hist: (y) => y <= 2025,
    note: (y) =>
      y === 2026 ? 'Temporada 2026 ainda em andamento: a força usa o momento atual dos times.' : null,
  },
  {
    id: 'br-b',
    label: 'Brasileirão Série B',
    division: 'Série B',
    years: BR_B,
    name: (y) => `Brasileirão Série B ${y}`,
    format: () => 'liga',
    settings: () => ({
      turnos: 2,
      z1: { name: 'Acesso', count: 4 },
      z2: { name: '', count: 0 },
      releg: 4,
    }),
    hist: (y) => y <= 2025,
    note: (y) =>
      y === 2026 ? 'Temporada 2026 ainda em andamento: a força usa o momento atual dos times.' : null,
  },
  {
    id: 'br-c',
    label: 'Brasileirão Série C',
    division: 'Série C',
    years: BR_C,
    name: (y) => `Brasileirão Série C ${y}`,
    format: (y) => (y >= 2022 ? 'ligamata' : 'grupos'),
    settings: (y) =>
      y >= 2022
        ? {
            turnos: 1,
            qualify: 8,
            legs: 2,
            finalSingle: false,
            releg: y === 2026 ? 2 : 4,
          }
        : {
            groups: 2,
            groupTurnos: 2,
            qualify: 4,
            legs: 2,
            finalSingle: false,
          },
    hist: (y) => y <= 2026,
    groupMode: 'potes',
    note: (y) =>
      y === 2027
        ? 'Série C 2027 provisória: 23 clubes já definidos — falta o 4º rebaixado da Série B 2026 (adicione-o na lista ao lado quando sair). O regulamento de 2027 (24 clubes) ainda não foi aplicado: aqui é turno único e os 8 primeiros vão ao mata-mata. A força usa o momento atual dos times.'
        : y >= 2022
        ? 'Fase única com 20 times em turno único; os 8 primeiros vão ao mata-mata (quartas, semi e final em ida e volta). Na vida real a 2ª fase é em dois quadrangulares — os 4 semifinalistas equivalem aos 4 que sobem.'
        : y >= 2020
          ? 'Dois grupos de 10 (ida e volta), 4 de cada avançam ao mata-mata em ida e volta. Na vida real a 2ª fase foi em quadrangulares; os grupos aqui são sorteados por força (no real eram regionais).'
          : 'Dois grupos de 10 (ida e volta), 4 de cada avançam às quartas em ida e volta. Os grupos aqui são sorteados por força (no real eram regionais).',
  },
];

export const presetById = (id: string) => PRESETS.find((p) => p.id === id);

export function presetYears(p: Preset): number[] {
  return Object.keys(p.years)
    .map(Number)
    .sort((a, b) => b - a);
}
