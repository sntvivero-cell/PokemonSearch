import type { Metadata } from 'next';

// Next.js NO mergea openGraph/twitter campo por campo entre layout y page — un
// page.tsx que define su propio `openGraph` reemplaza el objeto entero del layout
// (confirmado renderizando /guide: sin este helper, og:image/og:site_name/og:type del
// layout raíz desaparecían por completo en cualquier página con su propio openGraph).
// Por eso cada página arma su Metadata con esta función en vez de repetir
// images/siteName/type a mano — un solo lugar para cambiarlos si el logo o el nombre
// del sitio cambian.
const SITE_NAME = 'GoTraderz';
const DEFAULT_OG_IMAGES = [{ url: '/logo-1024.png', width: 1024, height: 1024, alt: 'GoTraderz' }];

interface PageMetadataInput {
  title: string;
  description: string;
  path: string;
  // Título/descripción más cortos para OG/Twitter cuando el de <title> es muy largo
  // para verse bien como preview de link (Discord/Reddit truncan distinto que Google).
  ogTitle?: string;
  ogDescription?: string;
}

export function buildPageMetadata({
  title,
  description,
  path,
  ogTitle,
  ogDescription,
}: PageMetadataInput): Metadata {
  return {
    title,
    description,
    alternates: {
      canonical: path,
    },
    openGraph: {
      title: ogTitle ?? title,
      description: ogDescription ?? description,
      url: path,
      siteName: SITE_NAME,
      type: 'website',
      locale: 'en_US',
      images: DEFAULT_OG_IMAGES,
    },
    twitter: {
      card: 'summary_large_image',
      title: ogTitle ?? title,
      description: ogDescription ?? description,
      images: DEFAULT_OG_IMAGES.map((img) => img.url),
    },
  };
}
