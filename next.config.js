const createNextIntlPlugin = require('next-intl/plugin')('./i18n/request.ts')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  // Tree-shake large barrel-file dependencies so only the modules actually used
  // get bundled. lucide-react, date-fns and recharts are already optimized by
  // Next.js out of the box, so only framer-motion needs listing here.
  experimental: {
    optimizePackageImports: ['framer-motion'],
  },
  
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  
  // Ensure environment variables are available during build
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
}

module.exports = createNextIntlPlugin(nextConfig)
