import { RenderMode, ServerRoute } from '@angular/ssr';

/**
 * Tudo é renderizado no navegador: os campeonatos ficam só no localStorage,
 * que não existe no servidor.
 */
export const serverRoutes: ServerRoute[] = [
  {
    path: '**',
    renderMode: RenderMode.Client,
  },
];
