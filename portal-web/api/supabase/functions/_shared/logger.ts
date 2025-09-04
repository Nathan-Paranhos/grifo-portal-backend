/**
 * Sistema de logging estruturado para Edge Functions
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  function_name?: string;
  user_id?: string;
  empresa_id?: string;
  request_id?: string;
  duration_ms?: number;
  metadata?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

/**
 * Classe principal do logger
 */
export class Logger {
  private functionName: string;
  public requestId: string;
  private startTime: number;

  constructor(functionName: string, requestId?: string) {
    this.functionName = functionName;
    this.requestId = requestId || this.generateRequestId();
    this.startTime = Date.now();
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private createLogEntry(
    level: LogLevel,
    message: string,
    metadata?: Record<string, any>,
    error?: Error
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      function_name: this.functionName,
      request_id: this.requestId,
      duration_ms: Date.now() - this.startTime,
    };

    if (metadata) {
      entry.metadata = metadata;
    }

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        ...(error.stack && { stack: error.stack })
      };
    }

    return entry;
  }

  private log(entry: LogEntry): void {
    const logString = JSON.stringify(entry);
    
    switch (entry.level) {
      case 'debug':
        console.debug(logString);
        break;
      case 'info':
        console.info(logString);
        break;
      case 'warn':
        console.warn(logString);
        break;
      case 'error':
        console.error(logString);
        break;
    }
  }

  debug(message: string, metadata?: Record<string, any>): void {
    if (Deno.env.get('LOG_LEVEL') === 'debug') {
      this.log(this.createLogEntry('debug', message, metadata));
    }
  }

  info(message: string, metadata?: Record<string, any>): void {
    this.log(this.createLogEntry('info', message, metadata));
  }

  warn(message: string, metadata?: Record<string, any>): void {
    this.log(this.createLogEntry('warn', message, metadata));
  }

  error(message: string, error?: Error, metadata?: Record<string, any>): void {
    this.log(this.createLogEntry('error', message, metadata, error));
  }

  setUser(userId: string, empresaId?: string): void {
    // Adiciona informações do usuário a todos os logs subsequentes
    this.startTime = Date.now(); // Reset para incluir user info
  }

  /**
   * Log de início de função
   */
  start(metadata?: Record<string, any>): void {
    this.info(`Iniciando função ${this.functionName}`, metadata);
  }

  /**
   * Log de fim de função
   */
  end(metadata?: Record<string, any>): void {
    const duration = Date.now() - this.startTime;
    this.info(`Finalizando função ${this.functionName}`, {
      ...metadata,
      duration_ms: duration,
    });
  }

  /**
   * Log de performance
   */
  performance(operation: string, durationMs: number, metadata?: Record<string, any>): void {
    this.info(`Performance: ${operation}`, {
      ...metadata,
      operation,
      duration_ms: durationMs,
    });
  }

  /**
   * Log de auditoria
   */
  audit(
    action: string,
    userId: string,
    empresaId: string,
    details?: Record<string, any>
  ): void {
    this.info(`Auditoria: ${action}`, {
      audit: true,
      action,
      user_id: userId,
      empresa_id: empresaId,
      details,
    });
  }

  /**
   * Log de segurança
   */
  security(
    event: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    details?: Record<string, any>
  ): void {
    this.warn(`Evento de segurança: ${event}`, {
      security: true,
      event,
      severity,
      details,
    });
  }
}

/**
 * Middleware de logging para Edge Functions
 */
export function withLogging<T>(
  functionName: string,
  handler: (req: Request, logger: Logger) => Promise<T>
) {
  return async (req: Request): Promise<Response> => {
    const logger = new Logger(functionName);
    
    try {
      logger.start({
        method: req.method,
        url: req.url,
        headers: Object.fromEntries(req.headers.entries()),
      });

      const result = await handler(req, logger);
      
      logger.end({ success: true });
      
      return result as Response;
    } catch (error) {
      logger.error('Erro na execução da função', error as Error);
      
      // Retornar erro estruturado
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : 'Erro interno',
          request_id: logger.requestId,
          timestamp: new Date().toISOString(),
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'X-Request-ID': logger.requestId,
          },
        }
      );
    }
  };
}

/**
 * Utilitário para medir tempo de execução
 */
export class Timer {
  private startTime: number;
  private logger: Logger;
  private operation: string;

  constructor(logger: Logger, operation: string) {
    this.logger = logger;
    this.operation = operation;
    this.startTime = Date.now();
  }

  end(metadata?: Record<string, any>): number {
    const duration = Date.now() - this.startTime;
    this.logger.performance(this.operation, duration, metadata);
    return duration;
  }
}

/**
 * Cria um timer para medir performance
 */
export function createTimer(logger: Logger, operation: string): Timer {
  return new Timer(logger, operation);
}

/**
 * Decorator para logging automático de funções
 */
export function loggedFunction(
  functionName: string,
  logArgs: boolean = false,
  logResult: boolean = false
) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const logger = new Logger(functionName);
      
      try {
        logger.start(logArgs ? { arguments: args } : undefined);
        
        const result = await originalMethod.apply(this, args);
        
        logger.end(logResult ? { result } : undefined);
        
        return result;
      } catch (error) {
        logger.error('Erro na função', error as Error);
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Utilitários para logging de métricas
 */
export class MetricsLogger {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Log de métrica de contador
   */
  counter(name: string, value: number = 1, tags?: Record<string, string>): void {
    this.logger.info(`Métrica: ${name}`, {
      metric_type: 'counter',
      metric_name: name,
      metric_value: value,
      tags,
    });
  }

  /**
   * Log de métrica de gauge
   */
  gauge(name: string, value: number, tags?: Record<string, string>): void {
    this.logger.info(`Métrica: ${name}`, {
      metric_type: 'gauge',
      metric_name: name,
      metric_value: value,
      tags,
    });
  }

  /**
   * Log de métrica de histograma
   */
  histogram(name: string, value: number, tags?: Record<string, string>): void {
    this.logger.info(`Métrica: ${name}`, {
      metric_type: 'histogram',
      metric_name: name,
      metric_value: value,
      tags,
    });
  }

  /**
   * Log de métrica de tempo
   */
  timing(name: string, durationMs: number, tags?: Record<string, string>): void {
    this.histogram(`${name}.duration`, durationMs, tags);
  }
}

/**
 * Configurações de logging
 */
export interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableRemote: boolean;
  remoteEndpoint?: string;
  batchSize?: number;
  flushInterval?: number;
}

/**
 * Logger configurável
 */
export class ConfigurableLogger {
  private config: LoggerConfig;
  private logBuffer: LogEntry[] = [];
  private flushTimer?: any;
  private functionName: string;
  private requestId: string;
  private startTime: number;
  private userId?: string;
  private empresaId?: string;

  constructor(functionName: string, config: LoggerConfig, requestId?: string) {
    this.functionName = functionName;
    this.requestId = requestId || this.generateRequestId();
    this.startTime = Date.now();
    this.config = config;
    
    if (config.enableRemote && config.flushInterval) {
      this.startFlushTimer();
    }
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.config.flushInterval!);
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.config.level);
    const logLevelIndex = levels.indexOf(level);
    return logLevelIndex >= currentLevelIndex;
  }

  private createLogEntry(
    level: LogLevel,
    message: string,
    metadata?: Record<string, any>,
    error?: Error
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      function_name: this.functionName,
      request_id: this.requestId,
      duration_ms: Date.now() - this.startTime,
    };

    if (this.userId) {
      entry.user_id = this.userId;
    }

    if (this.empresaId) {
      entry.empresa_id = this.empresaId;
    }

    if (metadata) {
      entry.metadata = metadata;
    }

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        ...(error.stack && { stack: error.stack })
      };
    }

    return entry;
  }

  private log(entry: LogEntry): void {
    if (!this.shouldLog(entry.level)) {
      return;
    }

    if (this.config.enableConsole) {
      const logString = JSON.stringify(entry);
      
      switch (entry.level) {
        case 'debug':
          console.debug(logString);
          break;
        case 'info':
          console.info(logString);
          break;
        case 'warn':
          console.warn(logString);
          break;
        case 'error':
          console.error(logString);
          break;
      }
    }

    if (this.config.enableRemote) {
      this.logBuffer.push(entry);
      
      if (this.logBuffer.length >= (this.config.batchSize || 10)) {
        this.flush();
      }
    }
  }

  debug(message: string, metadata?: Record<string, any>): void {
    if (Deno.env.get('LOG_LEVEL') === 'debug') {
      this.log(this.createLogEntry('debug', message, metadata));
    }
  }

  info(message: string, metadata?: Record<string, any>): void {
    this.log(this.createLogEntry('info', message, metadata));
  }

  warn(message: string, metadata?: Record<string, any>): void {
    this.log(this.createLogEntry('warn', message, metadata));
  }

  error(message: string, error?: Error, metadata?: Record<string, any>): void {
    this.log(this.createLogEntry('error', message, metadata, error));
  }

  setUser(userId: string, empresaId?: string): void {
    this.userId = userId;
    if (empresaId) {
      this.empresaId = empresaId;
    }
    this.startTime = Date.now();
  }

  start(metadata?: Record<string, any>): void {
    this.info(`Iniciando função ${this.functionName}`, metadata);
  }

  end(metadata?: Record<string, any>): void {
    const duration = Date.now() - this.startTime;
    this.info(`Finalizando função ${this.functionName}`, {
      ...metadata,
      duration_ms: duration,
    });
  }

  performance(operation: string, durationMs: number, metadata?: Record<string, any>): void {
    this.info(`Performance: ${operation}`, {
      ...metadata,
      operation,
      duration_ms: durationMs,
    });
  }

  audit(
    action: string,
    userId: string,
    empresaId: string,
    details?: Record<string, any>
  ): void {
    this.info(`Auditoria: ${action}`, {
      audit: true,
      action,
      user_id: userId,
      empresa_id: empresaId,
      details,
    });
  }

  security(
    event: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    details?: Record<string, any>
  ): void {
    this.warn(`Evento de segurança: ${event}`, {
      security: true,
      event,
      severity,
      details,
    });
  }

  private async flush(): Promise<void> {
    if (this.logBuffer.length === 0 || !this.config.remoteEndpoint) {
      return;
    }

    const logs = [...this.logBuffer];
    this.logBuffer = [];

    try {
      await fetch(this.config.remoteEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ logs }),
      });
    } catch (error) {
      console.error('Erro ao enviar logs remotos:', error);
      // Recolocar logs no buffer em caso de erro
      this.logBuffer.unshift(...logs);
    }
  }

  async close(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    await this.flush();
  }
}

/**
 * Factory para criar loggers
 */
export function createLogger(
  functionName: string,
  config?: Partial<LoggerConfig>
): ConfigurableLogger {
  const defaultConfig: LoggerConfig = {
    level: (Deno.env.get('LOG_LEVEL') as LogLevel) || 'info',
    enableConsole: true,
    enableRemote: false,
    batchSize: 10,
    flushInterval: 5000
  };

  const finalConfig = { ...defaultConfig, ...config };
  return new ConfigurableLogger(functionName, finalConfig);
}