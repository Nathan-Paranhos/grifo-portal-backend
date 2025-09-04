/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export', // Habilitado para export estático no Netlify
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  experimental: {
    serverComponentsExternalPackages: ['@supabase/supabase-js']
  },
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      config.devtool = 'cheap-module-source-map'
    }
    
    // Configuração explícita de aliases para resolver problemas no Netlify
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': require('path').resolve(__dirname),
      '@/lib': require('path').resolve(__dirname, 'lib'),
      '@/components': require('path').resolve(__dirname, 'components'),
      '@/app': require('path').resolve(__dirname, 'app'),
    }
    
    // Garantir que extensões sejam resolvidas corretamente
    config.resolve.extensions = ['.tsx', '.ts', '.jsx', '.js', '.json']
    
    return config
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://fsvwifbvehdhlufauahj.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzdndpZmJ2ZWhkaGx1ZmF1YWhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ2MjI1MDYsImV4cCI6MjA3MDE5ODUwNn0.IC-I9QsH2t5o60v70TmzVFmfe8rUuFdMD5kMErQ4CPI'
  }
}

module.exports = nextConfig