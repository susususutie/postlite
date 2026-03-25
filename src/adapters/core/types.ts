export interface CollectionIR {
  name: string;
  description?: string;
  items: ItemIR[];
}

export interface ItemIR {
  id: string;
  type: 'folder' | 'request';
  name: string;
  description?: string;
  children?: ItemIR[];
  method?: string;
  url?: string;
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
