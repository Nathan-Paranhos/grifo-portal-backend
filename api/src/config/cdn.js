/**
 * Configuração de CDN para otimização de assets estáticos
 * Implementa cache de imagens e arquivos para melhor performance
 */

const path = require('path');
const fs = require('fs').promises;
const sharp = require('sharp');
const { cacheService } = require('./cache.js');

class CDNService {
  constructor() {
    this.cdnBaseUrl = process.env.CDN_BASE_URL || '';
    this.enableImageOptimization = process.env.ENABLE_IMAGE_OPTIMIZATION === 'true';
    this.maxImageSize = parseInt(process.env.MAX_IMAGE_SIZE) || 2048;
    this.imageQuality = parseInt(process.env.IMAGE_QUALITY) || 85;
  }

  /**
   * Otimiza imagem usando Sharp
   */
  async optimizeImage(buffer, options = {}) {
    try {
      const {
        width = this.maxImageSize,
        height = this.maxImageSize,
        quality = this.imageQuality,
        format = 'webp'
      } = options;

      const optimized = await sharp(buffer)
        .resize(width, height, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .toFormat(format, { quality })
        .toBuffer();

      return optimized;
    } catch (error) {
      console.error('❌ Image optimization error:', error.message);
      return buffer; // Retorna buffer original em caso de erro
    }
  }

  /**
   * Gera URL otimizada para CDN
   */
  getCDNUrl(assetPath, options = {}) {
    if (!this.cdnBaseUrl) {
      return assetPath;
    }

    const {
      width,
      height,
      quality,
      format
    } = options;

    let url = `${this.cdnBaseUrl}${assetPath}`;
    const params = new URLSearchParams();

    if (width) params.append('w', width.toString());
    if (height) params.append('h', height.toString());
    if (quality) params.append('q', quality.toString());
    if (format) params.append('f', format);

    const queryString = params.toString();
    if (queryString) {
      url += `?${queryString}`;
    }

    return url;
  }

  /**
   * Middleware para servir assets otimizados
   */
  createAssetMiddleware() {
    return async (req, res, next) => {
      try {
        const { path: assetPath } = req.params;
        const { w: width, h: height, q: quality, f: format } = req.query;

        // Verifica se é uma imagem
        const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(assetPath);
        
        if (!isImage || !this.enableImageOptimization) {
          return next();
        }

        // Gera chave de cache
        const cacheKey = `cdn_asset:${assetPath}:${width || ''}:${height || ''}:${quality || ''}:${format || ''}`;
        
        // Verifica cache
        const cachedAsset = await cacheService.get(cacheKey);
        if (cachedAsset) {
          res.set({
            'Content-Type': cachedAsset.contentType,
            'Cache-Control': 'public, max-age=31536000', // 1 ano
            'ETag': cachedAsset.etag
          });
          return res.send(Buffer.from(cachedAsset.buffer, 'base64'));
        }

        // Lê arquivo original
        const filePath = path.join(process.cwd(), 'uploads', assetPath);
        const fileBuffer = await fs.readFile(filePath);

        // Otimiza imagem se necessário
        let optimizedBuffer = fileBuffer;
        let contentType = 'image/jpeg';

        if (width || height || quality || format) {
          const options = {
            width: width ? parseInt(width) : undefined,
            height: height ? parseInt(height) : undefined,
            quality: quality ? parseInt(quality) : undefined,
            format: format || 'webp'
          };

          optimizedBuffer = await this.optimizeImage(fileBuffer, options);
          contentType = `image/${options.format}`;
        }

        // Gera ETag
        const crypto = require('crypto');
        const etag = crypto.createHash('md5').update(optimizedBuffer).digest('hex');

        // Armazena no cache
        const cacheData = {
          buffer: optimizedBuffer.toString('base64'),
          contentType,
          etag
        };
        await cacheService.set(cacheKey, cacheData, 86400); // 24 horas

        // Envia resposta
        res.set({
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000',
          'ETag': etag
        });
        res.send(optimizedBuffer);

      } catch (error) {
        console.error('❌ CDN middleware error:', error.message);
        next();
      }
    };
  }

  /**
   * Middleware para headers de cache estático
   */
  createStaticCacheMiddleware() {
    return (req, res, next) => {
      // Define cache para diferentes tipos de arquivo
      const ext = path.extname(req.url).toLowerCase();
      
      const cacheSettings = {
        // Imagens - cache longo
        '.jpg': 'public, max-age=31536000', // 1 ano
        '.jpeg': 'public, max-age=31536000',
        '.png': 'public, max-age=31536000',
        '.gif': 'public, max-age=31536000',
        '.webp': 'public, max-age=31536000',
        '.svg': 'public, max-age=31536000',
        
        // CSS e JS - cache médio
        '.css': 'public, max-age=604800', // 1 semana
        '.js': 'public, max-age=604800',
        
        // Fontes - cache longo
        '.woff': 'public, max-age=31536000',
        '.woff2': 'public, max-age=31536000',
        '.ttf': 'public, max-age=31536000',
        '.eot': 'public, max-age=31536000',
        
        // Documentos - cache curto
        '.pdf': 'public, max-age=86400', // 1 dia
        '.doc': 'public, max-age=86400',
        '.docx': 'public, max-age=86400'
      };

      const cacheControl = cacheSettings[ext];
      if (cacheControl) {
        res.set('Cache-Control', cacheControl);
      }

      next();
    };
  }
}

// Instância singleton do CDN
const cdnService = new CDNService();

/**
 * Middleware para compressão avançada
 */
const compressionMiddleware = () => {
  const compression = require('compression');
  
  return compression({
    filter: (req, res) => {
      // Não comprime se já estiver comprimido
      if (req.headers['x-no-compression']) {
        return false;
      }
      
      // Comprime apenas tipos específicos
      const contentType = res.getHeader('content-type');
      if (!contentType) return false;
      
      return /json|text|javascript|css|xml|svg/.test(contentType);
    },
    level: 6, // Nível de compressão (1-9)
    threshold: 1024, // Só comprime arquivos > 1KB
    windowBits: 15,
    memLevel: 8
  });
};

module.exports = {
  CDNService,
  cdnService,
  createAssetMiddleware: () => cdnService.createAssetMiddleware(),
  createStaticCacheMiddleware: () => cdnService.createStaticCacheMiddleware(),
  compressionMiddleware
};