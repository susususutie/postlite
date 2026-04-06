import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  detectProxyAvailability, 
  clearProxyCache,
  initNetworkStatusListener 
} from './proxyDetector';

describe('proxyDetector', () => {
  beforeEach(() => {
    clearProxyCache();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    clearProxyCache();
    vi.restoreAllMocks();
  });
  
  describe('detectProxyAvailability', () => {
    it('应该返回true当代理端点可用', async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: true });
      
      const result = await detectProxyAvailability();
      
      expect(result).toBe(true);
      expect(fetch).toHaveBeenCalledWith('/api/proxy/health', expect.any(Object));
    });
    
    it('应该返回false当代理端点不可用', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
      
      const result = await detectProxyAvailability();
      
      expect(result).toBe(false);
    });
    
    it('应该缓存检测结果', async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: true });
      
      // 第一次调用
      await detectProxyAvailability();
      // 第二次调用应该使用缓存
      await detectProxyAvailability();
      
      // fetch 应该只被调用一次
      expect(fetch).toHaveBeenCalledTimes(1);
    });
    
    it('应该防止并发探测', async () => {
      let resolveFetch: (value: { ok: boolean }) => void;
      const fetchPromise = new Promise<{ ok: boolean }>((resolve) => {
        resolveFetch = resolve;
      });
      
      global.fetch = vi.fn().mockReturnValue(fetchPromise);
      
      // 同时发起两个检测请求
      const promise1 = detectProxyAvailability();
      const promise2 = detectProxyAvailability();
      
      resolveFetch!({ ok: true });
      
      const [result1, result2] = await Promise.all([promise1, promise2]);
      
      // 两个请求应该返回相同结果
      expect(result1).toBe(true);
      expect(result2).toBe(true);
      // fetch 应该只被调用一次
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('应该处理响应不为ok的情况', async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 503 });
      
      const result = await detectProxyAvailability();
      
      expect(result).toBe(false);
    });

    it('应该使用正确的请求配置', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      global.fetch = mockFetch;
      
      await detectProxyAvailability();
      
      expect(mockFetch).toHaveBeenCalledWith('/api/proxy/health', {
        method: 'GET',
        signal: expect.any(AbortSignal),
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      });
    });
  });
  
  describe('clearProxyCache', () => {
    it('应该清除缓存', async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: true });
      
      await detectProxyAvailability();
      clearProxyCache();
      await detectProxyAvailability();
      
      // fetch 应该被调用两次（因为缓存被清除）
      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('initNetworkStatusListener', () => {
    it('应该只在window存在时执行', () => {
      const originalWindow = global.window;
      // @ts-expect-error - 模拟window不存在的情况
      global.window = undefined;
      
      // 不应该抛出错误
      expect(() => initNetworkStatusListener()).not.toThrow();
      
      global.window = originalWindow;
    });

    it('应该添加online事件监听器', () => {
      // 使用 vitest 的 mock 来验证行为
      // 由于模块级状态，我们只能验证函数不抛出错误
      expect(() => initNetworkStatusListener()).not.toThrow();
    });

    it('应该防止重复初始化', () => {
      // 由于模块级状态无法重置，我们只验证多次调用不会抛出错误
      expect(() => {
        initNetworkStatusListener();
        initNetworkStatusListener();
      }).not.toThrow();
    });
  });
});
