import { Routes } from '@angular/router';
import { HomePage } from './pages/home';
import { NewChampPage } from './pages/new-champ';
import { ChampPage } from './pages/champ/champ-page';

export const routes: Routes = [
  { path: '', component: HomePage, title: 'SimFut — Simulador de futebol' },
  { path: 'novo', component: NewChampPage, title: 'Novo campeonato — SimFut' },
  { path: 'c/:id', component: ChampPage, title: 'Campeonato — SimFut' },
  { path: '**', redirectTo: '' },
];
