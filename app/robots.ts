import type { MetadataRoute } from 'next';

const BASE_URL = 'https://gotraderz.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Rutas que requieren sesión — no aportan nada indexadas, y publicar/mensajes
      // muestran contenido distinto por usuario de todas formas.
      disallow: ['/login', '/publicar', '/mensajes', '/configuracion', '/guardados', '/watchlist'],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
