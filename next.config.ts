import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'raw.githubusercontent.com',
      },
      {
        protocol: 'https',
        hostname: '*.pokeapi.co',
      },
      {
        // Signed URLs de imágenes del chat (bucket privado "chat-images") — ver
        // app/lib/chatImages.ts.
        protocol: 'https',
        hostname: 'rplcfsphdbeeletbfpom.supabase.co',
      },
    ],
  },
};

export default nextConfig;