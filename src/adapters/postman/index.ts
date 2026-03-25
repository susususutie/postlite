import type { Adapter, CollectionIR, ItemIR } from '../core';
import { v4 as uuidv4 } from 'uuid';

function detectPostman(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  return !!(obj.info && (obj.info as Record<string, unknown>).schema && typeof (obj.info as Record<string, unknown>).schema === 'string' && ((obj.info as Record<string, unknown>).schema as string).includes('postman'));
}

function parsePostman(data: unknown): CollectionIR {
  const obj = data as PostmanCollection;
  const items: ItemIR[] = [];

  if (obj.item) {
    obj.item.forEach(item => {
      items.push(processItem(item));
    });
  }

  return {
    name: obj.info?.name || 'Untitled Collection',
    description: obj.info?.description,
    items,
  };
}

function processItem(item: PostmanItem): ItemIR {
  if (item.request) {
    return convertRequest(item);
  }

  return {
    id: uuidv4(),
    type: 'folder',
    name: item.name || 'Folder',
    description: item.description,
    children: item.item?.map(child => processItem(child)) || [],
  };
}

function convertRequest(item: PostmanItem): ItemIR {
  const request = item.request as PostmanRequest;
  const url = typeof request.url === 'string' ? request.url : request.url.raw;

  const params: { key: string; value: string; enabled: boolean }[] = [];
  if (typeof request.url !== 'string' && request.url.query) {
    request.url.query.forEach(q => {
      params.push({
        key: q.key,
        value: q.value || '',
        enabled: true,
      });
    });
  }

  const headers: { key: string; value: string; enabled: boolean }[] = (request.header || []).map(h => ({
    key: h.key,
    value: h.value,
    enabled: true,
  }));

  let body: { mode: string; content?: string } | undefined;
  if (request.body) {
    switch (request.body.mode) {
      case 'raw':
        body = { mode: 'json', content: request.body.raw };
        break;
      case 'urlencoded':
        body = {
          mode: 'urlencoded',
          content: request.body.urlencoded?.map(i => `${encodeURIComponent(i.key)}=${encodeURIComponent(i.value || '')}`).join('&'),
        };
        break;
      case 'formdata':
        body = { mode: 'formdata', content: JSON.stringify(request.body.formdata) };
        break;
    }
  }

  return {
    id: uuidv4(),
    type: 'request',
    name: item.name || 'Request',
    description: item.description,
    method: request.method,
    url,
    headers,
    params,
    body,
  };
}

function exportPostman(ir: CollectionIR): string {
  const items: PostmanItem[] = ir.items.map(item => convertItemToPostman(item));

  const collection: PostmanCollection = {
    info: {
      _postman_id: uuidv4(),
      name: ir.name,
      description: ir.description,
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    item: items,
  };

  return JSON.stringify(collection, null, 2);
}

function convertItemToPostman(item: ItemIR): PostmanItem {
  if (item.type === 'folder') {
    return {
      name: item.name,
      description: item.description,
      item: item.children?.map(child => convertItemToPostman(child)),
    };
  }

  const urlObj = parseUrl(item.url || '');

  return {
    name: item.name,
    description: item.description,
    request: {
      method: item.method || 'GET',
      header: item.headers?.map(h => ({ key: h.key, value: h.value })) || [],
      url: urlObj,
      body: convertBodyToPostman(item.body),
    },
  };
}

function parseUrl(url: string): PostmanUrl {
  try {
    const urlObj = new URL(url);
    return {
      raw: url,
      protocol: urlObj.protocol.replace(':', ''),
      host: urlObj.hostname.split('.'),
      port: urlObj.port || undefined,
      path: urlObj.pathname.split('/').filter(p => p),
      query: [],
    };
  } catch {
    return { raw: url, query: [] };
  }
}

function convertBodyToPostman(body?: { mode: string; content?: string }): PostmanBody | undefined {
  if (!body) return undefined;
  switch (body.mode) {
    case 'json':
    case 'text':
      return { mode: 'raw', raw: body.content };
    case 'urlencoded':
      return {
        mode: 'urlencoded',
        urlencoded: body.content ? parseUrlEncoded(body.content) : [],
      };
    case 'formdata':
      return {
        mode: 'formdata',
        formdata: body.content ? JSON.parse(body.content) : [],
      };
    default:
      return { mode: 'raw', raw: '' };
  }
}

function parseUrlEncoded(content: string): PostmanKeyValue[] {
  return content.split('&').map(pair => {
    const [key, value] = pair.split('=');
    return { key: decodeURIComponent(key || ''), value: decodeURIComponent(value || '') };
  });
}

interface PostmanCollection {
  info: { _postman_id: string; name: string; description?: string; schema: string };
  item: PostmanItem[];
}

interface PostmanItem {
  name: string;
  description?: string;
  item?: PostmanItem[];
  request?: PostmanRequest;
}

interface PostmanRequest {
  method: string;
  header: { key: string; value: string }[];
  url: PostmanUrl;
  body?: PostmanBody;
}

interface PostmanUrl {
  raw: string;
  protocol?: string;
  host?: string[];
  port?: string;
  path?: string[];
  query?: { key: string; value: string }[];
}

interface PostmanBody {
  mode: string;
  raw?: string;
  urlencoded?: PostmanKeyValue[];
  formdata?: PostmanKeyValue[];
}

interface PostmanKeyValue {
  key: string;
  value: string;
  type?: string;
}

export const postmanAdapter: Adapter = {
  name: 'postman',
  supportedFormats: ['postman'],
  detect: detectPostman,
  parse: parsePostman,
  export: exportPostman,
};
