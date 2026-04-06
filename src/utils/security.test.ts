import { describe, it, expect } from 'vitest';
import { 
  isUrlAllowed, 
  normalizeIP, 
  sanitizeRequestHeaders,
  sanitizeResponseHeaders 
} from './security';

describe('security', () => {
  describe('normalizeIP', () => {
    it('应该规范化八进制IP', () => {
      expect(normalizeIP('0177.0.0.1')).toBe('127.0.0.1');
      expect(normalizeIP('0177.000.000.001')).toBe('127.0.0.1');
    });
    
    it('应该规范化十六进制IP', () => {
      expect(normalizeIP('0x7f.0.0.1')).toBe('127.0.0.1');
      expect(normalizeIP('0x7f.0x00.0x00.0x01')).toBe('127.0.0.1');
    });
    
    it('应该规范化十进制整数IP', () => {
      expect(normalizeIP('2130706433')).toBe('127.0.0.1');
    });
    
    it('应该返回null对于无效IP', () => {
      expect(normalizeIP('invalid')).toBeNull();
      expect(normalizeIP('')).toBeNull();
    });
  });
  
  describe('isUrlAllowed', () => {
    it('应该允许公共URL', () => {
      expect(isUrlAllowed('https://api.example.com/test')).toBe(true);
      expect(isUrlAllowed('http://example.com')).toBe(true);
    });
    
    it('应该阻止localhost', () => {
      expect(isUrlAllowed('http://localhost:3000')).toBe(false);
      expect(isUrlAllowed('http://127.0.0.1')).toBe(false);
    });

    it('应该阻止IPv6方括号格式的回环地址', () => {
      // [::1] 是 IPv6 回环地址，应该被阻止
      expect(isUrlAllowed('http://[::1]')).toBe(false);
      expect(isUrlAllowed('http://[0:0:0:0:0:0:0:1]')).toBe(false);
    });
    
    it('应该阻止私有IP段', () => {
      expect(isUrlAllowed('http://10.0.0.1')).toBe(false);  // 10.x.x.x
      expect(isUrlAllowed('http://192.168.1.1')).toBe(false);  // 192.168.x.x
      expect(isUrlAllowed('http://172.16.0.1')).toBe(false);  // 172.16.x.x
    });
    
    it('应该阻止八进制表示的私有IP', () => {
      expect(isUrlAllowed('http://0177.0.0.1')).toBe(false);  // 127.0.0.1
      expect(isUrlAllowed('http://0177.000.000.001')).toBe(false);
    });
    
    it('应该阻止十六进制表示的私有IP', () => {
      expect(isUrlAllowed('http://0x7f.0.0.1')).toBe(false);  // 127.0.0.1
    });
    
    it('应该阻止十进制表示的私有IP', () => {
      expect(isUrlAllowed('http://2130706433')).toBe(false);  // 127.0.0.1
    });
    
    it('应该阻止云服务元数据端点', () => {
      expect(isUrlAllowed('http://169.254.169.254')).toBe(false);  // AWS/通用 metadata endpoint
      expect(isUrlAllowed('http://169.254.169.254/latest/meta-data/')).toBe(false);
    });
    
    it('应该阻止非http协议', () => {
      expect(isUrlAllowed('ftp://example.com')).toBe(false);
      expect(isUrlAllowed('file:///etc/passwd')).toBe(false);
    });
  });
  
  describe('sanitizeRequestHeaders', () => {
    it('应该过滤Hop-by-Hop头', () => {
      const headers = {
        'Content-Type': 'application/json',
        'Connection': 'keep-alive',
        'Transfer-Encoding': 'chunked',
      };
      const sanitized = sanitizeRequestHeaders(headers);
      expect(sanitized['Content-Type']).toBe('application/json');
      expect(sanitized['Connection']).toBeUndefined();
      expect(sanitized['Transfer-Encoding']).toBeUndefined();
    });
    
    it('应该过滤敏感头', () => {
      const headers = {
        'Content-Type': 'application/json',
        'Cookie': 'session=abc',
        'Authorization': 'Bearer token',
        'X-Forwarded-For': '1.2.3.4',
      };
      const sanitized = sanitizeRequestHeaders(headers);
      expect(sanitized['Content-Type']).toBe('application/json');
      expect(sanitized['Cookie']).toBeUndefined();
      expect(sanitized['Authorization']).toBeUndefined();
      expect(sanitized['X-Forwarded-For']).toBeUndefined();
    });
  });

  describe('sanitizeResponseHeaders', () => {
    it('应该过滤敏感响应头', () => {
      const headers = {
        'Content-Type': 'application/json',
        'Set-Cookie': 'session=abc',
        'Server': 'nginx',
        'X-Powered-By': 'PHP/7.0',
      };
      const sanitized = sanitizeResponseHeaders(headers);
      expect(sanitized['Content-Type']).toBe('application/json');
      expect(sanitized['Set-Cookie']).toBeUndefined();
      expect(sanitized['Server']).toBeUndefined();
      expect(sanitized['X-Powered-By']).toBeUndefined();
    });

    it('应该过滤Hop-by-Hop响应头', () => {
      const headers = {
        'Content-Type': 'application/json',
        'Connection': 'keep-alive',
        'Keep-Alive': 'timeout=5',
      };
      const sanitized = sanitizeResponseHeaders(headers);
      expect(sanitized['Content-Type']).toBe('application/json');
      expect(sanitized['Connection']).toBeUndefined();
    });

    it('应该处理空headers对象', () => {
      expect(sanitizeResponseHeaders({})).toEqual({});
      expect(sanitizeResponseHeaders(null as unknown as Record<string, string>)).toEqual({});
      expect(sanitizeResponseHeaders(undefined as unknown as Record<string, string>)).toEqual({});
    });
  });
});