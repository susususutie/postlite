// 导出工具 - Postman, Swagger, YApi 格式导出
import type {
  Collection,
  Folder,
  HttpRequest,
  PostmanCollection,
  PostmanItem,
  PostmanRequest,
  PostmanUrl,
  PostmanBody,
  SwaggerDocument,
  SwaggerPathItem,
  SwaggerOperation,
  SwaggerParameter,
} from '../types';

// 导出为 Postman Collection
export function exportToPostman(collection: Collection): PostmanCollection {
  const postmanItems: PostmanItem[] = [];

  // 添加根目录下的请求
  collection.requests.forEach(request => {
    postmanItems.push(convertToPostmanItem(request));
  });

  // 递归添加文件夹
  collection.folders.forEach(folder => {
    postmanItems.push(convertFolderToPostmanItem(folder));
  });

  return {
    info: {
      _postman_id: collection.id,
      name: collection.name,
      description: collection.description,
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    item: postmanItems,
  };
}

// 转换文件夹为 Postman Item
function convertFolderToPostmanItem(folder: Folder): PostmanItem {
  const items: PostmanItem[] = [];

  // 添加文件夹内的请求
  folder.requests.forEach(request => {
    items.push(convertToPostmanItem(request));
  });

  // 递归添加子文件夹
  folder.folders.forEach(subFolder => {
    items.push(convertFolderToPostmanItem(subFolder));
  });

  return {
    name: folder.name,
    description: folder.description,
    item: items,
  };
}

// 转换请求为 Postman Item
function convertToPostmanItem(request: HttpRequest): PostmanItem {
  const url: PostmanUrl = convertToPostmanUrl(request.url, request.params);

  const postmanRequest: PostmanRequest = {
    method: request.method,
    header: request.headers.map(h => ({
      key: h.key,
      value: h.value,
      type: 'text',
    })),
    url,
    description: request.description,
  };

  // 处理请求体
  if (request.body && request.body.mode !== 'none') {
    postmanRequest.body = convertToPostmanBody(request.body);
  }

  return {
    name: request.name,
    request: postmanRequest,
    response: [],
  };
}

// 转换 URL
function convertToPostmanUrl(url: string, params: { key: string; value: string; enabled: boolean }[]): PostmanUrl {
  try {
    const urlObj = new URL(url);

    const postmanUrl: PostmanUrl = {
      raw: url,
      protocol: urlObj.protocol.replace(':', ''),
      host: urlObj.hostname.split('.'),
      port: urlObj.port || undefined,
      path: urlObj.pathname.split('/').filter(p => p),
      query: params
        .filter(p => p.enabled && p.key)
        .map(p => ({
          key: p.key,
          value: p.value,
        })),
    };

    return postmanUrl;
  } catch {
    // 如果 URL 解析失败，返回简化版本
    return {
      raw: url,
      query: params
        .filter(p => p.enabled && p.key)
        .map(p => ({
          key: p.key,
          value: p.value,
        })),
    };
  }
}

// 转换请求体
function convertToPostmanBody(body: { mode: string; content?: string }): PostmanBody {
  switch (body.mode) {
    case 'json':
      return {
        mode: 'raw',
        raw: body.content || '',
      };
    case 'text':
      return {
        mode: 'raw',
        raw: body.content || '',
      };
    case 'urlencoded':
      // 解析 URL 编码的表单数据
      const pairs: { key: string; value: string; type: string }[] = [];
      if (body.content) {
        const params = new URLSearchParams(body.content);
        params.forEach((value, key) => {
          pairs.push({
            key,
            value,
            type: 'text',
          });
        });
      }
      return {
        mode: 'urlencoded',
        urlencoded: pairs,
      };
    case 'formdata':
      return {
        mode: 'formdata',
        formdata: body.content ? JSON.parse(body.content) : [],
      };
    default:
      return {
        mode: 'raw',
        raw: '',
      };
  }
}

// 导出为 Swagger/OpenAPI 2.0
export function exportToSwagger(collection: Collection): SwaggerDocument {
  const paths: Record<string, SwaggerPathItem> = {};

  // 处理根目录下的请求
  collection.requests.forEach(request => {
    addRequestToSwaggerPaths(request, paths);
  });

  // 递归处理文件夹
  collection.folders.forEach(folder => {
    processFolderForSwagger(folder, paths);
  });

  return {
    swagger: '2.0',
    info: {
      title: collection.name,
      description: collection.description,
      version: '1.0.0',
    },
    basePath: '/',
    paths,
  };
}

// 递归处理文件夹用于 Swagger 导出
function processFolderForSwagger(
  folder: Folder,
  paths: Record<string, SwaggerPathItem>
): void {
  // 处理文件夹内的请求
  folder.requests.forEach(request => {
    addRequestToSwaggerPaths(request, paths, folder.name);
  });

  // 递归处理子文件夹
  folder.folders.forEach(subFolder => {
    processFolderForSwagger(subFolder, paths);
  });
}

// 添加请求到 Swagger Paths
function addRequestToSwaggerPaths(
  request: HttpRequest,
  paths: Record<string, SwaggerPathItem>,
  tag?: string
): void {
  try {
    const urlObj = new URL(request.url);
    let path = urlObj.pathname;

    // 确保路径以 / 开头
    if (!path.startsWith('/')) {
      path = '/' + path;
    }

    if (!paths[path]) {
      paths[path] = {};
    }

    const method = request.method.toLowerCase() as keyof SwaggerPathItem;

    const parameters: SwaggerParameter[] = [];

    // 添加查询参数
    request.params.forEach(param => {
      if (param.enabled && param.key) {
        parameters.push({
          name: param.key,
          in: 'query',
          description: '',
          required: false,
          type: 'string',
        });
      }
    });

    // 添加请求头参数
    request.headers.forEach(header => {
      if (header.enabled && header.key) {
        parameters.push({
          name: header.key,
          in: 'header',
          description: '',
          required: false,
          type: 'string',
        });
      }
    });

    const operation: SwaggerOperation = {
      summary: request.name,
      description: request.description,
      operationId: `${request.method.toLowerCase()}_${path.replace(/[^a-zA-Z0-9]/g, '_')}`,
      parameters,
      responses: {
        '200': {
          description: 'Successful response',
        },
      },
    };

    if (tag) {
      operation.tags = [tag];
    }

    (paths[path][method] as SwaggerOperation) = operation;
  } catch {
    // 如果 URL 解析失败，跳过此请求
    console.warn('Failed to parse URL for Swagger export:', request.url);
  }
}

// 导出为 JSON（通用格式）
export function exportToJSON(collection: Collection): string {
  return JSON.stringify(collection, null, 2);
}

// 通用导出函数
export function exportCollection(
  collection: Collection,
  format: 'postman' | 'swagger' | 'json'
): string {
  switch (format) {
    case 'postman':
      return JSON.stringify(exportToPostman(collection), null, 2);
    case 'swagger':
      return JSON.stringify(exportToSwagger(collection), null, 2);
    case 'json':
      return exportToJSON(collection);
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}

// 下载文件
export function downloadFile(content: string, filename: string, mimeType: string = 'application/json'): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
