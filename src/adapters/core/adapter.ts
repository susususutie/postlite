import type { CollectionIR } from './types';

export interface ImportAdapter {
  detect(data: unknown): boolean;
  parse(data: unknown): CollectionIR;
}

export interface ExportAdapter {
  export(ir: CollectionIR): string;
}

export interface Adapter extends ImportAdapter, ExportAdapter {
  readonly name: string;
  readonly supportedFormats: string[];
}
