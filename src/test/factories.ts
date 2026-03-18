// 测试工厂函数 - 用于生成 Mock 数据
import { v4 as uuidv4 } from 'uuid';
import type {
  HttpRequest,
  HttpResponse,
  HttpMethod,
  Header,
  Param,
  RequestBody,
  Collection,
  Folder,
  Environment,
  EnvironmentVariable,
  HistoryItem,
  PostmanCollection,
  SwaggerDocument,
  YApiProject,
  YApiInterface,
  YApiCategory,
} from '../types';

// ========== 基础工厂函数 ==========

export function createMockId(): string {
  return uuidv4();
}

export function createMockTimestamp(): number {
  return Date.now();
}

// ========== Header & Param 工厂 ==========

export function createMockHeader(overrides: Partial<Header> = {}): Header {
  return {
    key: 'Content-Type',
    value: 'application/json',
    enabled: true,
    ...overrides,
  };
}

export function createMockParam(overrides: Partial<Param> = {}): Param {
  return {
    key: 'page',
    value: '1',
    enabled: true,
    ...overrides,
  };
}

export function createMockHeaders(count: number = 3): Header[] {
  const commonHeaders = [
    { key: 'Content-Type', value: 'application/json' },
    { key: 'Authorization', value: 'Bearer token123' },
    { key: 'Accept', value: 'application/json' },
    { key: 'X-Request-ID', value: 'req-123' },
    { key: 'User-Agent', value: 'Postlite/1.0' },
  ];
  
  return commonHeaders.slice(0, count).map((h, i) => 
    createMockHeader({ ...h, enabled: i % 2 === 0 })
  );
}

export function createMockParams(count: number = 3): Param[] {
  const commonParams = [
    { key: 'page', value: '1' },
    { key: 'limit', value: '10' },
    { key: 'search', value: 'test' },
    { key: 'sort', value: 'desc' },
    { key: 'filter', value: 'active' },
  ];
  
  return commonParams.slice(0, count).map((p, i) => 
    createMockParam({ ...p, enabled: i % 2 === 0 })
  );
}

// ========== Request Body 工厂 ==========

export function createMockJsonBody(content?: object): RequestBody {
  return {
    mode: 'json',
    content: content ? JSON.stringify(content, null, 2) : '{\n  "key": "value"\n}',
  };
}

export function createMockTextBody(content?: string): RequestBody {
  return {
    mode: 'text',
    content: content || 'Plain text content',
  };
}

export function createMockFormUrlEncodedBody(params?: Record<string, string>): RequestBody {
  const data = params || { name: 'test', value: '123' };
  return {
    mode: 'urlencoded',
    content: Object.entries(data)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&'),
  };
}

export function createMockFormDataBody(): RequestBody {
  return {
    mode: 'formdata',
    content: JSON.stringify([
      { key: 'file', type: 'file', src: ['test.txt'] },
      { key: 'name', value: 'test', type: 'text' },
    ]),
  };
}

export function createMockNoneBody(): RequestBody {
  return {
    mode: 'none',
  };
}

// ========== HttpRequest 工厂 ==========

export interface RequestFactoryOptions {
  method?: HttpMethod;
  withHeaders?: boolean;
  withParams?: boolean;
  withBody?: boolean;
  bodyMode?: 'none' | 'json' | 'text' | 'formdata' | 'urlencoded';
}

export function createMockRequest(
  overrides: Partial<HttpRequest> = {},
  options: RequestFactoryOptions = {}
): HttpRequest {
  const {
    method = 'GET',
    withHeaders = false,
    withParams = false,
    withBody = false,
    bodyMode = 'json',
  } = options;

  let body: RequestBody | undefined;
  if (withBody) {
    switch (bodyMode) {
      case 'json':
        body = createMockJsonBody();
        break;
      case 'text':
        body = createMockTextBody();
        break;
      case 'urlencoded':
        body = createMockFormUrlEncodedBody();
        break;
      case 'formdata':
        body = createMockFormDataBody();
        break;
      default:
        body = createMockNoneBody();
    }
  }

  return {
    id: createMockId(),
    name: 'Test Request',
    method,
    url: 'https://api.example.com/users',
    headers: withHeaders ? createMockHeaders() : [],
    params: withParams ? createMockParams() : [],
    body,
    description: 'Test request description',
    ...overrides,
  };
}

export function createMockRequests(count: number, options: RequestFactoryOptions = {}): HttpRequest[] {
  const methods: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
  return Array.from({ length: count }, (_, i) => 
    createMockRequest(
      {
        name: `Request ${i + 1}`,
        method: methods[i % methods.length],
        url: `https://api.example.com/resource${i + 1}`,
      },
      options
    )
  );
}

// ========== HttpResponse 工厂 ==========

export function createMockResponse(overrides: Partial<HttpResponse> = {}): HttpResponse {
  return {
    status: 200,
    statusText: 'OK',
    headers: {
      'content-type': 'application/json',
      'x-request-id': 'req-123',
    },
    data: { id: 1, name: 'Test' },
    time: 150,
    size: 1024,
    ...overrides,
  };
}

export function createMockErrorResponse(status: number = 404): HttpResponse {
  const statusTexts: Record<number, string> = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
  };

  return createMockResponse({
    status,
    statusText: statusTexts[status] || 'Error',
    data: { error: 'Something went wrong' },
    time: 50,
    size: 256,
  });
}

// ========== Folder 工厂 ==========

export function createMockFolder(
  overrides: Partial<Folder> = {},
  withRequests: boolean = false,
  requestCount: number = 2
): Folder {
  const id = createMockId();
  const now = createMockTimestamp();
  
  return {
    id,
    name: 'Test Folder',
    description: 'Folder description',
    folders: [],
    requests: withRequests ? createMockRequests(requestCount) : [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function createMockFolders(count: number, depth: number = 0): Folder[] {
  return Array.from({ length: count }, (_, i) => {
    const folder = createMockFolder({
      name: `Folder ${i + 1}`,
      description: `Description for folder ${i + 1}`,
    });
    
    if (depth > 0) {
      folder.folders = createMockFolders(2, depth - 1);
    }
    
    return folder;
  });
}

// ========== Collection 工厂 ==========

export interface CollectionFactoryOptions {
  withFolders?: boolean;
  folderCount?: number;
  withRequests?: boolean;
  requestCount?: number;
  nestedDepth?: number;
}

export function createMockCollection(
  overrides: Partial<Collection> = {},
  options: CollectionFactoryOptions = {}
): Collection {
  const {
    withFolders = false,
    folderCount = 2,
    withRequests = false,
    requestCount = 3,
    nestedDepth = 0,
  } = options;

  const id = createMockId();
  const now = createMockTimestamp();

  return {
    id,
    name: 'Test Collection',
    description: 'Test collection description',
    folders: withFolders ? createMockFolders(folderCount, nestedDepth) : [],
    requests: withRequests ? createMockRequests(requestCount) : [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function createMockCollections(count: number, options: CollectionFactoryOptions = {}): Collection[] {
  return Array.from({ length: count }, (_, i) =>
    createMockCollection(
      {
        name: `Collection ${i + 1}`,
        description: `Description for collection ${i + 1}`,
      },
      options
    )
  );
}

// ========== Environment 工厂 ==========

export function createMockEnvironmentVariable(
  overrides: Partial<EnvironmentVariable> = {}
): EnvironmentVariable {
  return {
    key: 'BASE_URL',
    value: 'https://api.example.com',
    type: 'string',
    enabled: true,
    ...overrides,
  };
}

export function createMockEnvironmentVariables(count: number = 3): EnvironmentVariable[] {
  const defaults = [
    { key: 'BASE_URL', value: 'https://api.example.com', type: 'string' as const },
    { key: 'API_KEY', value: 'secret-key-123', type: 'secret' as const },
    { key: 'TIMEOUT', value: '5000', type: 'string' as const },
    { key: 'VERSION', value: 'v1', type: 'string' as const },
    { key: 'USER_ID', value: '12345', type: 'string' as const },
  ];

  return defaults.slice(0, count).map((v, i) =>
    createMockEnvironmentVariable({ ...v, enabled: i % 3 !== 0 })
  );
}

export function createMockEnvironment(
  overrides: Partial<Environment> = {},
  withVariables: boolean = false,
  variableCount: number = 3
): Environment {
  return {
    id: createMockId(),
    name: 'Test Environment',
    variables: withVariables ? createMockEnvironmentVariables(variableCount) : [],
    isDefault: false,
    ...overrides,
  };
}

export function createMockEnvironments(count: number, withVariables: boolean = true): Environment[] {
  return Array.from({ length: count }, (_, i) =>
    createMockEnvironment({
      name: `Environment ${i + 1}`,
      isDefault: i === 0,
    }, withVariables, 3 + i)
  );
}

// ========== HistoryItem 工厂 ==========

export function createMockHistoryItem(overrides: Partial<HistoryItem> = {}): HistoryItem {
  return {
    id: createMockId(),
    request: createMockRequest(),
    response: createMockResponse(),
    timestamp: createMockTimestamp(),
    ...overrides,
  };
}

export function createMockHistory(count: number): HistoryItem[] {
  return Array.from({ length: count }, (_, i) =>
    createMockHistoryItem({
      timestamp: Date.now() - i * 60000, // 每分钟一个
    })
  );
}

// ========== Postman 格式工厂 ==========

export function createMockPostmanCollection(overrides: Partial<PostmanCollection> = {}): PostmanCollection {
  return {
    info: {
      _postman_id: createMockId(),
      name: 'Postman Collection',
      description: 'Imported from Postman',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    item: [
      {
        name: 'Get Users',
        request: {
          method: 'GET',
          header: [],
          url: {
            raw: 'https://api.example.com/users',
            protocol: 'https',
            host: ['api', 'example', 'com'],
            path: ['users'],
          },
        },
      },
    ],
    ...overrides,
  };
}

// ========== Swagger 格式工厂 ==========

export function createMockSwaggerDocument(overrides: Partial<SwaggerDocument> = {}): SwaggerDocument {
  return {
    swagger: '2.0',
    info: {
      title: 'Swagger API',
      version: '1.0.0',
      description: 'Test API',
    },
    basePath: '/api',
    host: 'api.example.com',
    schemes: ['https'],
    paths: {
      '/users': {
        get: {
          summary: 'Get users',
          operationId: 'getUsers',
          parameters: [
            { name: 'page', in: 'query', type: 'integer' },
            { name: 'limit', in: 'query', type: 'integer' },
          ],
          responses: {
            '200': { description: 'Success' },
          },
        },
      },
    },
    ...overrides,
  };
}

// ========== YApi 格式工厂 ==========

export function createMockYApiProject(overrides: Partial<YApiProject> = {}): YApiProject {
  return {
    _id: 1,
    name: 'YApi Project',
    desc: 'Test YApi project',
    basepath: '/api',
    env: [{ name: 'local', domain: 'http://localhost:3000' }],
    ...overrides,
  };
}

export function createMockYApiCategory(overrides: Partial<YApiCategory> = {}): YApiCategory {
  return {
    _id: 1,
    name: 'User',
    desc: 'User related APIs',
    ...overrides,
  };
}

export function createMockYApiInterface(overrides: Partial<YApiInterface> = {}): YApiInterface {
  return {
    _id: 1,
    title: 'Get User',
    path: '/user/{id}',
    method: 'GET',
    desc: 'Get user by ID',
    req_headers: [{ name: 'Authorization', value: 'Bearer token' }],
    req_query: [{ name: 'include', desc: 'Include related data' }],
    catid: 1,
    ...overrides,
  };
}

// ========== 边界情况数据工厂 ==========

export function createBoundaryTestData() {
  return {
    // 超长字符串
    veryLongString: 'a'.repeat(10000),
    veryLongUrl: `https://example.com/${'path/'.repeat(100)}`,
    veryLongName: 'Test '.repeat(500),
    
    // 特殊字符
    specialChars: {
      unicode: '🎉🚀💯 unicode test',
      html: '<script>alert("xss")</script>',
      sql: "'; DROP TABLE users; --",
      path: '/path/with spaces/and/special!@#$%chars',
      query: 'key=value&special=hello world&unicode=测试',
    },
    
    // 空值
    emptyValues: {
      null: null,
      undefined: undefined,
      emptyString: '',
      emptyArray: [],
      emptyObject: {},
    },
    
    // 嵌套深度
    deeplyNested: (depth: number) => {
      let result: Record<string, unknown> = { value: 'leaf' };
      for (let i = 0; i < depth; i++) {
        result = { nested: result };
      }
      return result;
    },
    
    // 数组边界
    largeArray: (size: number) => Array.from({ length: size }, (_, i) => i),
    
    // 数字边界
    numberBoundaries: {
      max: Number.MAX_SAFE_INTEGER,
      min: Number.MIN_SAFE_INTEGER,
      maxValue: Number.MAX_VALUE,
      minValue: Number.MIN_VALUE,
      infinity: Infinity,
      negativeInfinity: -Infinity,
      nan: NaN,
    },
  };
}

// ========== 测试状态工厂 ==========

export function createMockAppState(overrides: Record<string, unknown> = {}) {
  return {
    collections: createMockCollections(2, { withFolders: true, withRequests: true }),
    environments: createMockEnvironments(2, true),
    currentEnvironmentId: undefined as string | undefined,
    history: createMockHistory(5),
    ...overrides,
  };
}