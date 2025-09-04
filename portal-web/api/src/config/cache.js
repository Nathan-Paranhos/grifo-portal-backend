/**
 * Configuração de Cache Redis para performance
 * Implementa cache distribuído para sessões e dados frequentes
 */

const Redis = require('ioredis');
const { logger } = require('./logger.js');

class CacheService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.init();
  }

  async init() {
    try {
      // Configuração do Redis baseada no ambiente
      const redisConfig = {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        connectTimeout: 60000,
        lazyConnect: true,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3
      };

      this.client = new Redis(redisConfig);

      this.client.on('connect', () => {
        console.log('🔄 Connecting to Redis...');
      });

      this.client.on('ready', () => {
        console.log('✅ Redis connected successfully');
        this.isConnected = true;
      });

      this.client.on('error', (err) => {
        console.error('❌ Redis connection error:', err.message);
        this.isConnected = false;
      });

      this.client.on('end', () => {
        console.log('⚠️ Redis connection ended');
        this.isConnected = false;
      });

      // Redis se conecta automaticamente quando necessário
      if (!process.env.REDIS_HOST && process.env.NODE_ENV !== 'production') {
        console.log('ℹ️ Redis not configured, using memory cache fallback');
      }
    } catch (error) {
      console.error('❌ Failed to initialize Redis:', error.message);
      this.isConnected = false;
    }
  }

  /**
   * Armazena dados no cache
   */
  async set(key, value, ttl = 3600) {
    try {
      if (!this.isConnected) {
        return false;
      }

      const serializedValue = JSON.stringify(value);
      await this.client.setEx(key, ttl, serializedValue);
      return true;
    } catch (error) {
      console.error('❌ Cache set error:', error.message);
      return false;
    }
  }

  /**
   * Recupera dados do cache
   */
  async get(key) {
    try {
      if (!this.isConnected) {
        return null;
      }

      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('❌ Cache get error:', error.message);
      return null;
    }
  }

  /**
   * Remove dados do cache
   */
  async del(key) {
    try {
      if (!this.isConnected) {
        return false;
      }

      await this.client.del(key);
      return true;
    } catch (error) {
      console.error('❌ Cache delete error:', error.message);
      return false;
    }
  }

  /**
   * Limpa todo o cache
   */
  async flush() {
    try {
      if (!this.isConnected) {
        return false;
      }

      await this.client.flushAll();
      return true;
    } catch (error) {
      console.error('❌ Cache flush error:', error.message);
      return false;
    }
  }

  /**
   * Verifica se uma chave existe
   */
  async exists(key) {
    try {
      if (!this.isConnected) {
        return false;
      }

      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      console.error('❌ Cache exists error:', error.message);
      return false;
    }
  }

  /**
   * Define TTL para uma chave existente
   */
  async expire(key, ttl) {
    try {
      if (!this.isConnected) {
        return false;
      }

      await this.client.expire(key, ttl);
      return true;
    } catch (error) {
      console.error('❌ Cache expire error:', error.message);
      return false;
    }
  }

  /**
   * Fecha a conexão com Redis
   */
  async disconnect() {
    try {
      if (this.client && this.isConnected) {
        await this.client.quit();
        console.log('✅ Redis disconnected gracefully');
      }
    } catch (error) {
      console.error('❌ Error disconnecting Redis:', error.message);
    }
  }
}

// Instância singleton do cache
const cacheService = new CacheService();

/**
 * Middleware para cache de respostas HTTP
 */
const cacheMiddleware = (ttl = 300) => {
  return async (req, res, next) => {
    // Só faz cache de requisições GET
    if (req.method !== 'GET') {
      return next();
    }

    // Gera chave única baseada na URL e query params
    const cacheKey = `http_cache:${req.originalUrl}`;

    try {
      // Verifica se existe no cache
      const cachedResponse = await cacheService.get(cacheKey);
      
      if (cachedResponse) {
        console.log(`🎯 Cache hit for: ${req.originalUrl}`);
        return res.json(cachedResponse);
      }

      // Intercepta a resposta para armazenar no cache
      const originalJson = res.json;
      res.json = function(data) {
        // Armazena no cache apenas respostas de sucesso
        if (res.statusCode >= 200 && res.statusCode < 300) {
          cacheService.set(cacheKey, data, ttl).catch(err => {
            console.error('❌ Failed to cache response:', err.message);
          });
        }
        return originalJson.call(this, data);
      };

      next();
    } catch (error) {
      console.error('❌ Cache middleware error:', error.message);
      next();
    }
  };
};

module.exports = {
  cacheService,
  cacheMiddleware
};