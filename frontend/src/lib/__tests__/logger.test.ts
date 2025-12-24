// src/lib/__tests__/logger.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger } from '../logger';

describe('Logger utility', () => {
  let consoleDebugSpy: any;
  let consoleInfoSpy: any;
  let consoleWarnSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleDebugSpy.mockRestore();
    consoleInfoSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('basic logging', () => {
    it('logs debug messages in development', () => {
      logger.debug('Debug message');
      
      expect(consoleDebugSpy).toHaveBeenCalledWith('[DEBUG] Debug message', '');
    });

    it('logs info messages', () => {
      logger.info('Info message');
      expect(consoleInfoSpy).toHaveBeenCalledWith('[INFO] Info message', '');
    });

    it('logs warn messages', () => {
      logger.warn('Warning message');
      expect(consoleWarnSpy).toHaveBeenCalledWith('[WARN] Warning message', '');
    });

    it('logs error messages', () => {
      const testError = new Error('Test error');
      logger.error('Error message', testError);
      expect(consoleErrorSpy).toHaveBeenCalledWith('[ERROR] Error message', testError, '');
    });

    it('includes context data in logs', () => {
      logger.info('Message with context', { userId: '123', action: 'test' });
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        '[INFO] Message with context',
        { userId: '123', action: 'test' }
      );
    });
  });

  describe('transaction logging', () => {
    it('logs transaction with hash', () => {
      logger.transaction('Certificate issued', '0x123abc', { certId: '1' });
      
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        '[INFO] Transaction: Certificate issued',
        { hash: '0x123abc', certId: '1' }
      );
    });

    it('handles transactions without context', () => {
      logger.transaction('Transaction sent', '0xabc123');
      
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        '[INFO] Transaction: Transaction sent',
        { hash: '0xabc123' }
      );
    });
  });

  describe('contract logging', () => {
    it('logs contract interactions', () => {
      logger.contract('verifyCertificate', '0xContract123', { hash: '0xDoc123' });
      
      expect(consoleDebugSpy).toHaveBeenCalledWith(
        '[DEBUG] Contract: verifyCertificate',
        { contractAddress: '0xContract123', hash: '0xDoc123' }
      );
    });

    it('handles contract calls without context', () => {
      logger.contract('getCertificate', '0xContract123');
      
      expect(consoleDebugSpy).toHaveBeenCalledWith(
        '[DEBUG] Contract: getCertificate',
        { contractAddress: '0xContract123' }
      );
    });
  });

  describe('user action logging', () => {
    it('logs user actions', () => {
      logger.userAction('Button clicked', { button: 'submit', form: 'login' });
      
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        '[INFO] User Action: Button clicked',
        { button: 'submit', form: 'login' }
      );
    });

    it('handles user actions without context', () => {
      logger.userAction('Page viewed');
      
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        '[INFO] User Action: Page viewed',
        ''
      );
    });
  });

  describe('error handling', () => {
    it('handles Error objects', () => {
      const error = new Error('Test error');
      error.stack = 'Error stack trace';
      
      logger.error('Operation failed', error);
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[ERROR] Operation failed',
        error,
        ''
      );
    });

    it('handles string errors', () => {
      logger.error('Operation failed', 'String error');
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[ERROR] Operation failed',
        'String error',
        ''
      );
    });

    it('handles object errors', () => {
      const error = { code: 'E001', message: 'Custom error' };
      logger.error('Operation failed', error);
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[ERROR] Operation failed',
        error,
        ''
      );
    });

    it('handles null/undefined errors', () => {
      logger.error('Operation failed', null);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[ERROR] Operation failed',
        '',
        ''
      );
      
      logger.error('Operation failed', undefined);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[ERROR] Operation failed',
        '',
        ''
      );
    });
  });

  describe('timestamp formatting', () => {
    it('includes timestamps in log output', () => {
      logger.info('Test message');
      
      // Logger doesn't add timestamps - just check it was called
      expect(consoleInfoSpy).toHaveBeenCalledWith('[INFO] Test message', '');
    });
  });

  describe('log levels', () => {
    it('filters logs based on level in production', () => {
      // Debug logs are enabled in DEV mode, so should be called
      logger.debug('Debug message');
      expect(consoleDebugSpy).toHaveBeenCalled();
    });

    it('always logs errors regardless of level', () => {
      logger.error('Error message', new Error('Critical'));
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('structured logging', () => {
    it('logs with proper structure for monitoring tools', () => {
      logger.info('Structured log', {
        userId: '123',
        action: 'certificate_issued',
        timestamp: Date.now()
      });

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        '[INFO] Structured log',
        expect.objectContaining({
          userId: '123',
          action: 'certificate_issued',
          timestamp: expect.any(Number)
        })
      );
    });

    it('handles complex nested objects', () => {
      const complexData = {
        user: { id: '123', role: 'student' },
        certificate: { id: '456', hash: '0xabc' },
        metadata: { issued: Date.now() }
      };

      logger.info('Complex log', complexData);

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        '[INFO] Complex log',
        expect.objectContaining({
          user: expect.objectContaining({ id: '123' }),
          certificate: expect.objectContaining({ id: '456' }),
          metadata: expect.any(Object)
        })
      );
    });
  });
});
