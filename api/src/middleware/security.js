/**
 * Middleware de segurança avançado para headers HTTP e SSL/TLS
 * Implementa proteções contra ataques e força HTTPS em produção
 */

/**
 * Middleware para forçar HTTPS em produção
 */
const enforceHTTPS = (req, res, next) => {
  // Só aplica redirecionamento HTTPS em produção E quando não for localhost
  if (process.env.NODE_ENV === 'production' && !req.get('Host')?.includes('localhost')) {
    // Verifica se a requisição não é HTTPS
    if (!req.secure && req.get('X-Forwarded-Proto') !== 'https') {
      // Redireciona para HTTPS
      return res.redirect(301, `https://${req.get('Host')}${req.url}`);
    }
  }
  next();
};

/**
 * Headers de segurança avançados
 */
const securityHeaders = (req, res, next) => {
  // Previne clickjacking
  res.setHeader('X-Frame-Options', 'DENY');

  // Previne MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Proteção XSS avançada
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Content Security Policy mais restritivo
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: https: blob:",
    "font-src 'self' https://fonts.gstatic.com",
    "connect-src 'self' https://*.supabase.co https://api.grifo.com wss://*.supabase.co",
    "media-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests"
  ];
  res.setHeader('Content-Security-Policy', cspDirectives.join('; '));

  // HSTS - Força HTTPS por 1 ano
  if (process.env.NODE_ENV === 'production') {
    res.setHeader(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }

  // Previne referrer leakage
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Controla recursos cross-origin
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

  // Previne DNS prefetching
  res.setHeader('X-DNS-Prefetch-Control', 'off');

  // Remove headers que expõem tecnologia
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');

  // Cache control para recursos sensíveis
  if (req.path.includes('/api/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }

  next();
};

module.exports = {
  securityHeaders,
  enforceHTTPS
};
