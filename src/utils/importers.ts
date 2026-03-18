// 导入工具 - Postman, Swagger, YApi 格式导入
import { v4 as uuidv4 } from 'uuid';
import type {
  Collection,
  Folder,
  HttpRequest,
  HttpMethod,
  Header,
  Param,
  RequestBody,
  PostmanCollection,
  PostmanItem,
  PostmanRequest,
  SwaggerDocument,
  SwaggerPathItem,
  SwaggerOperation,
  SwaggerParameter,
  YApiProject,
  YApiInterface,
  YApiCategory,
} from '../types';

// 导入 Postman Collection
export function importPostmanCollection(data: PostmanCollection): Collection {
  const now = Date.now();

  const collection: Collection = {
    id: data.info._postman_id || uuidv4(),
    name: data.info.name,
    description: data.info.description,
    folders: [],
    requests: [],
    createdAt: now,
    updatedAt: now,
  };

  // 处理 items
  if (data.item) {
    data.item.forEach(item => {
      processPostmanItem(item, collection.folders, collection.requests);
    });
  }

  return collection;
}

// 递归处理 Postman Item
function processPostmanItem(
  item: PostmanItem,
  folders: Folder[],
  requests: HttpRequest[],
  parentFolder?: Folder
): void {
  // 如果有 request，说明是请求
  if (item.request) {
    const request = convertPostmanRequest(item);
    if (parentFolder) {
      parentFolder.requests.push(request);
    } else {
      requests.push(request);
    }
  }

  // 如果有 item 数组，说明是文件夹
  if (item.item && item.item.length > 0) {
    const folder: Folder = {
      id: uuidv4(),
      name: item.name,
      description: item.description,
      folders: [],
      requests: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    item.item.forEach(childItem => {
      processPostmanItem(childItem, folder.folders, folder.requests, folder);
    });

    if (parentFolder) {
      parentFolder.folders.push(folder);
    } else {
      folders.push(folder);
    }
  }
}

// 转换 Postman 请求
function convertPostmanRequest(item: PostmanItem): HttpRequest {
  const request = item.request as PostmanRequest;
  const url = typeof request.url === 'string' ? request.url : request.url.raw;

  // 解析查询参数
  const params: Param[] = [];
  if (typeof request.url !== 'string' && request.url.query) {
    request.url.query.forEach(q => {
      params.push({
        key: q.key,
        value: q.value || '',
        enabled: true,
      });
    });
  }

  // 解析请求头
  const headers: Header[] = (request.header || []).map(h => ({
    key: h.key,
    value: h.value,
    enabled: true,
  }));

  // 解析请求体
  let body: RequestBody | undefined;
  if (request.body) {
    switch (request.body.mode) {
      case 'raw':
        body = {
          mode: 'json',
          content: request.body.raw || '',
        };
        break;
      case 'urlencoded':
        body = {
          mode: 'urlencoded',
          content: request.body.urlencoded
            ?.map(item => `${encodeURIComponent(item.key)}=${encodeURIComponent(item.value || '')}`)
            .join('&'),
        };
        break;
      case 'formdata':
        body = {
          mode: 'formdata',
          content: JSON.stringify(request.body.formdata),
        };
        break;
    }
  }

  return {
    id: uuidv4(),
    name: item.name,
    method: (request.method.toUpperCase() as HttpMethod) || 'GET',
    url,
    headers,
    params,
    body,
    description: request.description,
  };
}

// 导入 Swagger/OpenAPI
export function importSwagger(data: SwaggerDocument): Collection {
  const now = Date.now();
  const basePath = data.basePath || '';
  const host = data.host || '';
  const schemes = data.schemes || ['http'];
  const baseUrl = host ? `${schemes[0]}://${host}${basePath}` : basePath;

  const collection: Collection = {
    id: uuidv4(),
    name: data.info.title,
    description: data.info.description,
    folders: [],
    requests: [],
    createdAt: now,
    updatedAt: now,
  };

  // 按 tag 分组创建文件夹
  const tagFolders: Map<string, Folder> = new Map();

  if (data.paths) {
    Object.entries(data.paths).forEach(([path, pathItem]) => {
      const methods = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options'] as const;

      methods.forEach(method => {
        const operation = pathItem[method as keyof SwaggerPathItem] as SwaggerOperation | undefined;
        if (operation) {
          const request = convertSwaggerOperation(
            method.toUpperCase() as HttpMethod,
            path,
            operation,
            baseUrl,
            pathItem.parameters || []
          );

          // 如果有 tag，放入对应文件夹
          if (operation.tags && operation.tags.length > 0) {
            const tag = operation.tags[0];
            if (!tagFolders.has(tag)) {
              tagFolders.set(tag, {
                id: uuidv4(),
                name: tag,
                folders: [],
                requests: [],
                createdAt: now,
                updatedAt: now,
              });
            }
            tagFolders.get(tag)!.requests.push(request);
          } else {
            collection.requests.push(request);
          }
        }
      });
    });
  }

  // 添加所有 tag 文件夹
  tagFolders.forEach(folder => {
    collection.folders.push(folder);
  });

  return collection;
}

// 转换 Swagger Operation
function convertSwaggerOperation(
  method: HttpMethod,
  path: string,
  operation: SwaggerOperation,
  baseUrl: string,
  commonParams: SwaggerParameter[]
): HttpRequest {
  const url = `${baseUrl}${path}`;

  // 合并参数
  const allParams = [...(operation.parameters || []), ...commonParams];

  // 解析查询参数
  const params: Param[] = allParams
    .filter(p => p.in === 'query')
    .map(p => ({
      key: p.name,
      value: p.required ? `{{${p.name}}}` : '',
      enabled: true,
    }));

  // 解析请求头
  const headers: Header[] = allParams
    .filter(p => p.in === 'header')
    .map(p => ({
      key: p.name,
      value: p.required ? `{{${p.name}}}` : '',
      enabled: true,
    }));

  // 解析路径参数（替换为变量格式）
  let finalUrl = url;
  allParams
    .filter(p => p.in === 'path')
    .forEach(p => {
      finalUrl = finalUrl.replace(`{${p.name}}`, `{{${p.name}}}`);
    });

  return {
    id: uuidv4(),
    name: operation.summary || `${method} ${path}`,
    method,
    url: finalUrl,
    headers,
    params,
    description: operation.description,
  };
}

// 导入 YApi
export function importYApi(
  project: YApiProject,
  categories: YApiCategory[],
  interfaces: YApiInterface[]
): Collection {
  const now = Date.now();

  const collection: Collection = {
    id: uuidv4(),
    name: project.name,
    description: project.desc,
    folders: [],
    requests: [],
    createdAt: now,
    updatedAt: now,
  };

  // 创建分类文件夹映射
  const categoryFolders: Map<number, Folder> = new Map();

  categories.forEach(cat => {
    const folder: Folder = {
      id: uuidv4(),
      name: cat.name,
      description: cat.desc,
      folders: [],
      requests: [],
      createdAt: now,
      updatedAt: now,
    };
    categoryFolders.set(cat._id, folder);
    collection.folders.push(folder);
  });

  // 将接口分配到对应文件夹
  interfaces.forEach(iface => {
    const request = convertYApiInterface(iface, project);
    const folder = categoryFolders.get(iface.catid || 0);
    if (folder) {
      folder.requests.push(request);
    } else {
      collection.requests.push(request);
    }
  });

  return collection;
}

// 转换 YApi Interface
function convertYApiInterface(iface: YApiInterface, project: YApiProject): HttpRequest {
  const basePath = project.basepath || '';
  const env = project.env && project.env[0];
  const domain = env?.domain || '';
  const url = `${domain}${basePath}${iface.path}`;

  // 解析请求头
  const headers: Header[] = (iface.req_headers || []).map(h => ({
    key: h.name,
    value: h.value,
    enabled: true,
  }));

  // 解析查询参数
  const params: Param[] = (iface.req_query || []).map(q => ({
    key: q.name,
    value: '',
    enabled: true,
  }));

  // 解析请求体
  let body: RequestBody | undefined;
  if (iface.req_body_other) {
    try {
      const bodyObj = JSON.parse(iface.req_body_other);
      body = {
        mode: 'json',
        content: JSON.stringify(bodyObj, null, 2),
      };
    } catch {
      body = {
        mode: 'text',
        content: iface.req_body_other,
      };
    }
  }

  return {
    id: uuidv4(),
    name: iface.title,
    method: (iface.method.toUpperCase() as HttpMethod) || 'GET',
    url,
    headers,
    params,
    body,
    description: iface.desc,
  };
}

// 通用导入函数
export function importCollection(
  data: any,
  format: 'postman' | 'swagger' | 'yapi'
): Collection | null {
  try {
    switch (format) {
      case 'postman':
        return importPostmanCollection(data);
      case 'swagger':
        return importSwagger(data);
      case 'yapi':
        // YApi 需要项目、分类和接口三个数据
        if (data.project && data.categories && data.interfaces) {
          return importYApi(data.project, data.categories, data.interfaces);
        }
        return null;
      default:
        return null;
    }
  } catch (error) {
    console.error('Import error:', error);
    return null;
  }
}

// 自动检测格式并导入
export function autoImport(jsonString: string): Collection | null {
  try {
    const data = JSON.parse(jsonString);

    // 检测 Postman 格式
    if (data.info && data.info.schema && data.info.schema.includes('postman')) {
      return importPostmanCollection(data);
    }

    // 检测 Swagger/OpenAPI 格式
    if ((data.swagger && data.swagger.startsWith('2.')) || data.openapi) {
      return importSwagger(data);
    }

    // 检测 YApi 格式
    if (data.project && data.interfaces) {
      return importYApi(data.project, data.categories || [], data.interfaces);
    }

    return null;
  } catch (error) {
    console.error('Auto import error:', error);
    return null;
  }
}
