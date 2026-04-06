import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from './App';

// Mock window.innerWidth
const mockWindowWidth = (width: number) => {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  });
  window.dispatchEvent(new Event('resize'));
};

describe('Sidebar Three-State Switching', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    mockWindowWidth(1024); // Reset to default
  });

  // ==================== 响应式断点测试 ====================
  describe('Responsive Breakpoints', () => {
    const testCases = [
      { width: 1400, expected: 'expanded', desc: '超大屏幕' },
      { width: 1200, expected: 'expanded', desc: '大屏幕' },
      { width: 1020, expected: 'expanded', desc: '临界值1020px' },
      { width: 1019, expected: 'icon', desc: '刚好小于1020px' },
      { width: 900, expected: 'icon', desc: '中等屏幕' },
      { width: 768, expected: 'icon', desc: '临界值768px' },
      { width: 767, expected: 'hidden', desc: '刚好小于768px' },
      { width: 600, expected: 'hidden', desc: '小屏幕' },
      { width: 400, expected: 'hidden', desc: '超小屏幕' },
    ];

    testCases.forEach(({ width, expected, desc }) => {
      it(`should be ${expected} at ${width}px (${desc})`, async () => {
        mockWindowWidth(width);
        render(<App />);
        
        await waitFor(() => {
          const sider = document.querySelector('.ant-layout-sider');
          if (expected === 'hidden') {
            expect(sider).toHaveStyle({ display: 'none' });
          } else if (expected === 'icon') {
            expect(sider).toHaveClass('ant-layout-sider-collapsed');
            expect(sider).toHaveStyle({ flex: '0 0 56px' });
          } else {
            expect(sider).not.toHaveClass('ant-layout-sider-collapsed');
            expect(sider).toHaveStyle({ flex: '0 0 300px' });
          }
        });
      });
    });
  });

  // ==================== 手动切换测试 ====================
  describe('Manual Toggle', () => {
    it('should cycle through states on toggle button click', async () => {
      mockWindowWidth(1200);
      render(<App />);

      const toggleButton = screen.getByLabelText('toggle-sidebar');
      const sider = document.querySelector('.ant-layout-sider');

      // 初始 expanded
      expect(sider).toHaveStyle({ flex: '0 0 300px' });

      // 点击一次 -> icon
      fireEvent.click(toggleButton);
      await waitFor(() => {
        expect(sider).toHaveClass('ant-layout-sider-collapsed');
        expect(sider).toHaveStyle({ flex: '0 0 56px' });
      });

      // 点击第二次 -> hidden
      fireEvent.click(toggleButton);
      await waitFor(() => {
        expect(sider).toHaveStyle({ display: 'none' });
      });

      // 点击第三次 -> expanded
      fireEvent.click(toggleButton);
      await waitFor(() => {
        expect(sider).not.toHaveClass('ant-layout-sider-collapsed');
        expect(sider).toHaveStyle({ flex: '0 0 300px' });
      });
    });

    const widths = [1400, 900, 600];
    widths.forEach((width) => {
      it(`should support manual toggle at ${width}px`, async () => {
        mockWindowWidth(width);
        render(<App />);

        const toggleButton = screen.getByLabelText('toggle-sidebar');
        
        // 点击切换按钮不应报错
        fireEvent.click(toggleButton);
        await waitFor(() => {
          const sider = document.querySelector('.ant-layout-sider');
          expect(sider).toBeInTheDocument();
        });
      });
    });
  });

  // ==================== UI渲染测试 ====================
  describe('UI Rendering', () => {
    it('should show full content in expanded mode', async () => {
      mockWindowWidth(1200);
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Collections')).toBeInTheDocument();
        expect(screen.getByLabelText('Import')).toBeInTheDocument();
        expect(screen.getByLabelText('New Collection')).toBeInTheDocument();
      });
    });

    it('should show only icons in icon mode', async () => {
      mockWindowWidth(900);
      render(<App />);

      await waitFor(() => {
        expect(screen.queryByText('Collections')).not.toBeInTheDocument();
        expect(screen.getByLabelText('Import')).toBeInTheDocument();
        expect(screen.getByLabelText('New Collection')).toBeInTheDocument();
      });
    });

    it('should hide sidebar in hidden mode', async () => {
      mockWindowWidth(600);
      render(<App />);

      await waitFor(() => {
        const sider = document.querySelector('.ant-layout-sider');
        expect(sider).toHaveStyle({ display: 'none' });
      });
    });
  });

  // ==================== 无横向滚动条测试 ====================
  describe('No Horizontal Scrollbar', () => {
    it('should not have horizontal scrollbar in icon mode', async () => {
      mockWindowWidth(900);
      render(<App />);

      await waitFor(() => {
        const siderContent = document.querySelector('.ant-layout-sider-children');
        expect(siderContent).toHaveStyle({ overflowX: 'hidden' });
      });
    });

    it('should not have horizontal scrollbar in hidden mode', async () => {
      mockWindowWidth(600);
      render(<App />);

      await waitFor(() => {
        const sider = document.querySelector('.ant-layout-sider');
        expect(sider).toHaveStyle({ display: 'none' });
      });
    });
  });

  // ==================== Resize事件测试 ====================
  describe('Window Resize', () => {
    it('should auto-expand when resizing from small to large', async () => {
      mockWindowWidth(600);
      const { rerender } = render(<App />);

      await waitFor(() => {
        const sider = document.querySelector('.ant-layout-sider');
        expect(sider).toHaveStyle({ display: 'none' });
      });

      mockWindowWidth(1200);
      rerender(<App />);

      await waitFor(() => {
        const sider = document.querySelector('.ant-layout-sider');
        expect(sider).not.toHaveClass('ant-layout-sider-collapsed');
        expect(sider).toHaveStyle({ flex: '0 0 300px' });
      });
    });

    it('should auto-collapse when resizing from large to small', async () => {
      mockWindowWidth(1200);
      const { rerender } = render(<App />);

      await waitFor(() => {
        const sider = document.querySelector('.ant-layout-sider');
        expect(sider).toHaveStyle({ flex: '0 0 300px' });
      });

      mockWindowWidth(600);
      rerender(<App />);

      await waitFor(() => {
        const sider = document.querySelector('.ant-layout-sider');
        expect(sider).toHaveStyle({ display: 'none' });
      });
    });

    it('should handle multiple resizes', async () => {
      mockWindowWidth(1200);
      const { rerender } = render(<App />);

      const widths = [1200, 900, 600, 900, 1200, 600];
      for (const width of widths) {
        mockWindowWidth(width);
        rerender(<App />);
        await waitFor(() => {
          const sider = document.querySelector('.ant-layout-sider');
          expect(sider).toBeInTheDocument();
        });
      }
    });
  });

  // ==================== CollectionTree接收sidebarMode ====================
  describe('CollectionTree Props', () => {
    it('should pass sidebarMode to CollectionTree', async () => {
      mockWindowWidth(900);
      render(<App />);

      // CollectionTree应该接收到 sidebarMode="icon"
      await waitFor(() => {
        const collectionTree = document.querySelector('[data-testid="collection-tree"]');
        expect(collectionTree).toHaveAttribute('data-mode', 'icon');
      });
    });
  });
});
