import type { Adapter, CollectionIR, ItemIR } from '../core';
import { v4 as uuidv4 } from 'uuid';

function detectSwagger(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  return !!(obj.swagger?.toString().startsWith('2.') || obj.openapi);
}

function parseSwagger(data: unknown): CollectionIR {
  const doc = data as SwaggerDocument;
  const items: ItemIR[] = [];
  const tagFolders: Map<string, ItemIR> = new Map();

  // Extract defaultBaseUrl from servers (OpenAPI 3.0+) or host+basePath (Swagger 2.0)
  let defaultBaseUrl: string | undefined;
  if (doc.servers && doc.servers.length > 0) {
    defaultBaseUrl = doc.servers[0].url;
  } else if (doc.host) {
    const scheme = doc.schemes?.[0] || 'https';
    defaultBaseUrl = `${scheme}://${doc.host}${doc.basePath || ''}`;
  }

  if (doc.paths) {
    Object.entries(doc.paths).forEach(([path, pathItem]) => {
      const methods = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options'] as const;

      methods.forEach(method => {
        const operation = pathItem[method as keyof SwaggerPathItem] as SwaggerOperation | undefined;
        if (operation) {
          const request = convertOperation(method.toUpperCase(), path, operation, doc);
          const tag = operation.tags?.[0];

          if (tag) {
            if (!tagFolders.has(tag)) {
              const folder: ItemIR = {
                id: uuidv4(),
                type: 'folder',
                name: tag,
                children: [],
              };
              tagFolders.set(tag, folder);
              items.push(folder);
            }
            tagFolders.get(tag)!.children!.push(request);
          } else {
            items.push(request);
          }
        }
      });
    });
  }

  return {
    name: doc.info?.title || 'Swagger Collection',
    description: doc.info?.description,
    defaultBaseUrl,
    items,
  };
}

function convertOperation(
  method: string,
  path: string,
  operation: SwaggerOperation,
  doc: SwaggerDocument
): ItemIR {
  // Always build full URL for backward compatibility
  // The defaultBaseUrl is set at collection level for reference
  const url = `${buildBaseUrl(doc)}${path}`;

  const allParams = [...(operation.parameters || []), ...((doc.paths?.[path] as SwaggerPathItem)?.parameters || [])];

  const params: { key: string; value: string; enabled: boolean }[] = allParams
    .filter(p => p.in === 'query')
    .map(p => ({ key: p.name, value: p.required ? `{{${p.name}}}` : '', enabled: true }));

  const headers: { key: string; value: string; enabled: boolean }[] = allParams
    .filter(p => p.in === 'header')
    .map(p => ({ key: p.name, value: p.required ? `{{${p.name}}}` : '', enabled: true }));

  let finalUrl = url;
  allParams.filter(p => p.in === 'path').forEach(p => {
    finalUrl = finalUrl.replace(`{${p.name}}`, `{{${p.name}}}`);
  });

  return {
    id: uuidv4(),
    type: 'request',
    name: operation.summary || `${method} ${path}`,
    description: operation.description,
    method,
    url: finalUrl,
    headers,
    params,
  };
}

function buildBaseUrl(doc: SwaggerDocument): string {
  const basePath = doc.basePath || '';
  const host = doc.host || '';
  const schemes = doc.schemes || ['http'];
  return host ? `${schemes[0]}://${host}${basePath}` : basePath;
}

function exportSwagger(ir: CollectionIR): string {
  const paths: Record<string, SwaggerPathItem> = {};

  ir.items.forEach(item => processItemForExport(item, paths));

  const doc: SwaggerDocument = {
    swagger: '2.0',
    info: {
      title: ir.name,
      description: ir.description,
      version: '1.0.0',
    },
    basePath: '/',
    paths,
  };

  return JSON.stringify(doc, null, 2);
}

function processItemForExport(item: ItemIR, paths: Record<string, SwaggerPathItem>, tag?: string): void {
  if (item.type === 'folder' && item.children) {
    item.children.forEach(child => processItemForExport(child, paths, item.name));
    return;
  }

  if (!item.url) return;

  try {
    const urlObj = new URL(item.url);
    const path = urlObj.pathname || '/';

    if (!paths[path]) {
      paths[path] = {};
    }

    const method = (item.method?.toLowerCase() || 'get') as keyof SwaggerPathItem;

    const parameters: SwaggerParameter[] = [];

    item.params?.filter(p => p.enabled && p.key).forEach(p => {
      parameters.push({ name: p.key, in: 'query', type: 'string' });
    });

    item.headers?.filter(h => h.enabled && h.key).forEach(h => {
      parameters.push({ name: h.key, in: 'header', type: 'string' });
    });

    const operation: SwaggerOperation = {
      summary: item.name,
      description: item.description,
      operationId: `${method}_${path.replace(/[^a-zA-Z0-9]/g, '_')}`,
      parameters,
      responses: { '200': { description: 'Successful response' } },
    };

    if (tag) {
      operation.tags = [tag];
    }

    (paths[path][method] as SwaggerOperation) = operation;
  } catch {
    // skip invalid URLs
  }
}

interface SwaggerDocument {
  swagger?: string;
  openapi?: string;
  info: { title: string; version: string; description?: string };
  paths: Record<string, SwaggerPathItem>;
  basePath?: string;
  host?: string;
  schemes?: string[];
  servers?: { url: string; description?: string }[];
}

interface SwaggerPathItem {
  get?: SwaggerOperation;
  post?: SwaggerOperation;
  put?: SwaggerOperation;
  delete?: SwaggerOperation;
  patch?: SwaggerOperation;
  head?: SwaggerOperation;
  options?: SwaggerOperation;
  parameters?: SwaggerParameter[];
}

interface SwaggerOperation {
  summary?: string;
  description?: string;
  operationId?: string;
  parameters?: SwaggerParameter[];
  responses?: Record<string, unknown>;
  tags?: string[];
}

interface SwaggerParameter {
  name: string;
  in: 'query' | 'header' | 'path' | 'body' | 'formData';
  description?: string;
  required?: boolean;
  type?: string;
  schema?: unknown;
}

export const swaggerAdapter: Adapter = {
  name: 'swagger',
  supportedFormats: ['swagger', 'openapi'],
  detect: detectSwagger,
  parse: parseSwagger,
  export: exportSwagger,
};
