import type { MetadataRoute } from 'next';

const BASE_URL = 'https://gotraderz.com';

// Solo rutas públicas de contenido, sin login. Deliberadamente afuera: /login,
// /publicar, /mensajes, /configuracion, /guardados, /watchlist, /usuario/[userId] —
// todas requieren sesión (o, en el caso de perfiles de usuario, son contenido
// generado por usuarios sin valor de indexación propio) y no tiene sentido que Google
// las rastree como páginas de destino.
export default function sitemap(): MetadataRoute.Sitemap {
  const routes: { path: string; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']; priority: number }[] = [
    { path: '/', changeFrequency: 'hourly', priority: 1 },
    { path: '/guide', changeFrequency: 'monthly', priority: 0.8 },
    { path: '/leaderboard', changeFrequency: 'daily', priority: 0.6 },
    { path: '/contacto', changeFrequency: 'yearly', priority: 0.3 },
    { path: '/status', changeFrequency: 'daily', priority: 0.2 },
    { path: '/legal/privacidad', changeFrequency: 'yearly', priority: 0.2 },
    { path: '/legal/terminos', changeFrequency: 'yearly', priority: 0.2 },
  ];

  return routes.map((route) => ({
    url: `${BASE_URL}${route.path}`,
    lastModified: new Date(),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
