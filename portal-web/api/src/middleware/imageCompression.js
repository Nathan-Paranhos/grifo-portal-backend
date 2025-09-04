const sharp = require('sharp');
const { AppError } = require('./errorHandler.js');

/**
 * Middleware para compressão automática de imagens
 * Otimiza imagens JPEG, PNG, WebP e GIF para reduzir tamanho
 */
class ImageCompressionService {
  constructor() {
    this.compressionSettings = {
      jpeg: {
        quality: 85,
        progressive: true,
        mozjpeg: true
      },
      png: {
        compressionLevel: 8,
        progressive: true
      },
      webp: {
        quality: 85,
        effort: 6
      },
      gif: {
        // GIF será convertido para WebP para melhor compressão
        convertToWebp: true,
        quality: 85
      }
    };

    this.maxDimensions = {
      inspection_photos: { width: 1920, height: 1080 },
      property_documents: { width: 2480, height: 3508 }, // A4 300dpi
      contest_evidence: { width: 1920, height: 1080 },
      user_avatar: { width: 512, height: 512 },
      company_logo: { width: 1024, height: 1024 },
      report_attachments: { width: 1920, height: 1080 }
    };
  }

  /**
   * Verifica se o arquivo é uma imagem que pode ser comprimida
   */
  isCompressibleImage(mimeType) {
    const compressibleTypes = [
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/webp',
      'image/gif'
    ];
    return compressibleTypes.includes(mimeType.toLowerCase());
  }

  /**
   * Comprime uma imagem baseada no tipo de upload
   */
  async compressImage(buffer, mimeType, uploadType = 'inspection_photos') {
    try {
      const dimensions = this.maxDimensions[uploadType] || this.maxDimensions.inspection_photos;
      
      let sharpInstance = sharp(buffer)
        .resize(dimensions.width, dimensions.height, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .rotate(); // Auto-rotate based on EXIF

      // Aplicar compressão baseada no tipo de imagem
      switch (mimeType.toLowerCase()) {
        case 'image/jpeg':
        case 'image/jpg':
          return {
            buffer: await sharpInstance
              .jpeg(this.compressionSettings.jpeg)
              .toBuffer(),
            mimeType: 'image/jpeg',
            extension: '.jpg'
          };

        case 'image/png':
          return {
            buffer: await sharpInstance
              .png(this.compressionSettings.png)
              .toBuffer(),
            mimeType: 'image/png',
            extension: '.png'
          };

        case 'image/webp':
          return {
            buffer: await sharpInstance
              .webp(this.compressionSettings.webp)
              .toBuffer(),
            mimeType: 'image/webp',
            extension: '.webp'
          };

        case 'image/gif':
          // Converter GIF para WebP para melhor compressão
          if (this.compressionSettings.gif.convertToWebp) {
            return {
              buffer: await sharpInstance
                .webp({ quality: this.compressionSettings.gif.quality })
                .toBuffer(),
              mimeType: 'image/webp',
              extension: '.webp'
            };
          }
          // Manter como GIF se não converter
          return {
            buffer: await sharpInstance
              .gif()
              .toBuffer(),
            mimeType: 'image/gif',
            extension: '.gif'
          };

        default:
          throw new AppError(`Tipo de imagem não suportado: ${mimeType}`);
      }
    } catch (error) {
      console.error('Erro na compressão de imagem:', error);
      throw new AppError('Erro ao processar imagem');
    }
  }

  /**
   * Gera múltiplas versões da imagem (thumbnail, medium, original)
   */
  async generateImageVariants(buffer, mimeType, uploadType = 'inspection_photos') {
    try {
      const variants = {};
      const baseSharp = sharp(buffer).rotate();

      // Thumbnail (256x256)
      variants.thumbnail = {
        buffer: await baseSharp
          .clone()
          .resize(256, 256, { fit: 'cover' })
          .jpeg({ quality: 80 })
          .toBuffer(),
        mimeType: 'image/jpeg',
        extension: '.jpg',
        suffix: '_thumb'
      };

      // Medium (800x600)
      variants.medium = {
        buffer: await baseSharp
          .clone()
          .resize(800, 600, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 85 })
          .toBuffer(),
        mimeType: 'image/jpeg',
        extension: '.jpg',
        suffix: '_medium'
      };

      // Original comprimido
      variants.original = await this.compressImage(buffer, mimeType, uploadType);
      variants.original.suffix = '';

      return variants;
    } catch (error) {
      console.error('Erro ao gerar variantes da imagem:', error);
      throw new AppError('Erro ao processar variantes da imagem');
    }
  }

  /**
   * Middleware Express para compressão automática
   */
  middleware() {
    return async (req, res, next) => {
      try {
        if (!req.files || req.files.length === 0) {
          return next();
        }

        const { upload_type: uploadType } = req.body;
        const processedFiles = [];

        for (const file of req.files) {
          if (this.isCompressibleImage(file.mimetype)) {
            console.log(`Comprimindo imagem: ${file.originalname}`);
            
            const originalSize = file.buffer.length;
            const compressed = await this.compressImage(
              file.buffer, 
              file.mimetype, 
              uploadType
            );
            
            const compressionRatio = ((originalSize - compressed.buffer.length) / originalSize * 100).toFixed(1);
            
            console.log(`Imagem comprimida: ${file.originalname} - Redução: ${compressionRatio}%`);
            
            // Atualizar o arquivo com a versão comprimida
            file.buffer = compressed.buffer;
            file.mimetype = compressed.mimeType;
            file.size = compressed.buffer.length;
            
            // Atualizar extensão se necessário
            if (compressed.extension !== file.originalname.slice(file.originalname.lastIndexOf('.'))) {
              const nameWithoutExt = file.originalname.slice(0, file.originalname.lastIndexOf('.'));
              file.originalname = nameWithoutExt + compressed.extension;
            }
          }
          
          processedFiles.push(file);
        }

        req.files = processedFiles;
        next();
      } catch (error) {
        console.error('Erro no middleware de compressão:', error);
        next(error);
      }
    };
  }
}

// Instância singleton
const imageCompressionService = new ImageCompressionService();

module.exports = {
  ImageCompressionService,
  imageCompressionService,
  compressImage: imageCompressionService.compressImage.bind(imageCompressionService),
  generateImageVariants: imageCompressionService.generateImageVariants.bind(imageCompressionService),
  imageCompressionMiddleware: imageCompressionService.middleware()
};