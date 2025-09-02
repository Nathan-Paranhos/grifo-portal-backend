/** @type {import('next').NextConfig} */
const nextConfig = {
  // Configuração para corrigir problemas de WebSocket
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
      };
    }
    return config;
  },
  // Configuração experimental para melhor suporte a WebSocket
  experimental: {
    esmExternals: 'loose'
  },
  // Configuração de servidor para desenvolvimento
  ...(process.env.NODE_ENV === 'development' && {
    devIndicators: {
      buildActivity: true,
      buildActivityPosition: 'bottom-right'
    }
  })
};

export default nextConfig;
