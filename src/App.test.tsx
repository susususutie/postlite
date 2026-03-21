import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

describe('App Layout - Right Sider Trigger Style', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should verify right sider has zeroWidthTriggerStyle fix applied', async () => {
    // Read the App.tsx file and verify the configuration
    const fs = await import('fs');
    const path = await import('path');
    const appPath = path.join(process.cwd(), 'src', 'App.tsx');
    const content = fs.readFileSync(appPath, 'utf-8');
    
    // Check that the right sider has the expected configuration
    // It should have reverseArrow and zeroWidthTriggerStyle or similar fix
    const hasReverseArrow = content.includes('reverseArrow');
    expect(hasReverseArrow).toBe(true);
    
    // Check for zeroWidthTriggerStyle (the fix we want to apply)
    const hasZeroWidthTriggerStyle = content.includes('zeroWidthTriggerStyle');
    
    // THE FIX MUST BE APPLIED - this test will fail until zeroWidthTriggerStyle is added
    expect(hasZeroWidthTriggerStyle).toBe(true);
    
    // If zeroWidthTriggerStyle is present, verify it has proper border styling
    if (hasZeroWidthTriggerStyle) {
      const triggerStyleMatch = content.match(/zeroWidthTriggerStyle=\{\{([^}]+)\}\}/s);
      if (triggerStyleMatch) {
        const styleContent = triggerStyleMatch[1];
        // Should have border defined and borderRight: 0
        expect(styleContent.includes('border')).toBe(true);
      }
    }
  });

  it('should verify zeroWidthTriggerStyle has proper border configuration', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const appPath = path.join(process.cwd(), 'src', 'App.tsx');
    const content = fs.readFileSync(appPath, 'utf-8');
    
    // Find the right sider section
    const rightSiderMatch = content.match(/\{\/\* 右侧环境管理区 \*\/\s*<Sider[\s\S]*?<\/Sider>/);
    
    if (rightSiderMatch) {
      const rightSiderContent = rightSiderMatch[0];
      
      // Check for zeroWidthTriggerStyle
      const hasZeroWidthTriggerStyle = rightSiderContent.includes('zeroWidthTriggerStyle');
      
      if (hasZeroWidthTriggerStyle) {
        const styleMatch = rightSiderContent.match(/zeroWidthTriggerStyle=\{\{([^}]+)\}\}/s);
        if (styleMatch) {
          const style = styleMatch[1];
          
          // Verify border is defined
          expect(style.includes('border')).toBe(true);
          
          // Verify borderRight: 0 is set (to remove the border that touches the sider)
          expect(style.includes('borderRight') || style.includes('border-right')).toBe(true);
        }
      }
    }
  });

  it('should not have hardcoded border color in zeroWidthTriggerStyle', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const appPath = path.join(process.cwd(), 'src', 'App.tsx');
    const content = fs.readFileSync(appPath, 'utf-8');
    
    // If zeroWidthTriggerStyle exists, check it uses CSS variables
    const zeroWidthMatch = content.match(/zeroWidthTriggerStyle=\{\{([^}]+)\}\}/s);
    
    if (zeroWidthMatch) {
      const style = zeroWidthMatch[1];
      
      // Should not have hardcoded hex colors like #f0f0f0 or #d9d9d9
      const hasHardcodedColor = /#[0-9a-fA-F]{3,6}/.test(style);
      
      // Should use CSS variables instead
      const usesCssVariables = style.includes('var(--');
      
      // Either no hardcoded colors, or uses CSS variables
      if (hasHardcodedColor) {
        expect(usesCssVariables).toBe(true);
      }
    }
  });

  it('should apply zeroWidthTriggerStyle to the right sider only', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const appPath = path.join(process.cwd(), 'src', 'App.tsx');
    const content = fs.readFileSync(appPath, 'utf-8');
    
    // Count how many Sider components have zeroWidthTriggerStyle
    const matches = content.match(/zeroWidthTriggerStyle/g);
    const count = matches ? matches.length : 0;
    
    // Should be applied only to right sider (1 time)
    // Or not at all if the fix hasn't been applied yet
    expect(count).toBeLessThanOrEqual(1);
  });
});
