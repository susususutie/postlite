// Enhanced URL object supporting structured URL (Postman-style)
export interface UrlObject {
  raw: string;                  // Raw URL string (may contain templates like {{baseUrl}}/users)
  protocol?: string;            // Protocol (e.g., https, ws)
  host?: string[];              // Host parts (e.g., ["{{baseUrl}}"] or ["api", "example", "com"])
  path?: string[];              // Path segments (e.g., ["users", ":id"])
  query?: {                     // Query parameters (Postman-style)
    key: string;
    value: string;
  }[];
  variable?: {                  // Path variables (e.g., :id in /users/:id)
    key: string;
    value?: string;
    description?: string;
  }[];
}

export interface CollectionIR {
  name: string;
  description?: string;
  defaultBaseUrl?: string;      // Extracted base URL hint
  variables?: { key: string; value: string }[];  // Collection-level variables (Postman-compatible)
  items: ItemIR[];
}

export interface ItemIR {
  id: string;
  type: 'folder' | 'request';
  name: string;
  description?: string;
  children?: ItemIR[];
  method?: string;
  url?: string | UrlObject;     // Support both string and structured URL
  headers?: { key: string; value: string; enabled: boolean }[];
  params?: { key: string; value: string; enabled: boolean }[];
  body?: { mode: string; content?: string };
}

export function isCollectionIR(value: unknown): value is CollectionIR {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.name === 'string' &&
    Array.isArray(obj.items)
  );
}

export function isItemIR(value: unknown): value is ItemIR {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  
  if (typeof obj.id !== 'string') return false;
  if (obj.type !== 'folder' && obj.type !== 'request') return false;
  if (typeof obj.name !== 'string') return false;
  
  if (obj.type === 'folder') {
    return Array.isArray(obj.children);
  }
  
  return true;
}
