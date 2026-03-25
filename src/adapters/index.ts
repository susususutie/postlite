import type { Adapter } from './core';

const adapters = new Map<string, Adapter>();

export function register(adapter: Adapter): void {
  if (adapters.has(adapter.name)) {
    throw new Error(`Adapter '${adapter.name}' is already registered`);
  }
  adapters.set(adapter.name, adapter);
}

export function unregister(name: string): boolean {
  return adapters.delete(name);
}

export function get(name: string): Adapter | undefined {
  return adapters.get(name);
}

export function getAll(): Adapter[] {
  return Array.from(adapters.values());
}

export function detectAndParse(data: unknown): { adapter: Adapter; ir: ReturnType<Adapter['parse']> } | null {
  for (const adapter of adapters.values()) {
    if (adapter.detect(data)) {
      return {
        adapter,
        ir: adapter.parse(data),
      };
    }
  }
  return null;
}

export function exportCollection(name: string, ir: Parameters<Adapter['export']>[0]): string | null {
  const adapter = adapters.get(name);
  if (!adapter) {
    throw new Error(`Adapter '${name}' not found`);
  }
  return adapter.export(ir);
}

export function getAdapterNames(): string[] {
  return Array.from(adapters.keys());
}
