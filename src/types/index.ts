// Postlite 核心类型定义

export interface HttpRequest {
  id: string;
  name: string;
  method: HttpMethod;
  url: string;
  headers: Header[];
  params: Param[];
  body?: RequestBody;
  description?: string;
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

export interface Header {
  key: string;
  value: string;
  enabled: boolean;
}

export interface Param {
  key: string;
  value: string;
  enabled: boolean;
}

export interface RequestBody {
  mode: 'none' | 'json' | 'text' | 'formdata' | 'urlencoded';
  content?: string;
}

export interface HttpResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: any;
  time: number;
  size: number;
}

export interface Collection {
  id: string;
  name: string;
  description?: string;
  folders: Folder[];
  requests: HttpRequest[];
  createdAt: number;
  updatedAt: number;
}

export interface Folder {
  id: string;
  name: string;
  description?: string;
  requests: HttpRequest[];
  folders: Folder[];
  createdAt: number;
  updatedAt: number;
}

export interface Environment {
  id: string;
  name: string;
  variables: EnvironmentVariable[];
  isDefault?: boolean;
}

export interface EnvironmentVariable {
  key: string;
  value: string;
  type: 'string' | 'secret';
  enabled: boolean;
}

export interface AppState {
  collections: Collection[];
  environments: Environment[];
  currentEnvironmentId?: string;
  history: HistoryItem[];
}

export interface HistoryItem {
  id: string;
  request: HttpRequest;
  response: HttpResponse;
  timestamp: number;
}

// Postman Collection 格式 (v2.1)
export interface PostmanCollection {
  info: {
    _postman_id: string;
    name: string;
    description?: string;
    schema: string;
  };
  item: PostmanItem[];
  variable?: PostmanVariable[];
}

export interface PostmanItem {
  name: string;
  description?: string;
  item?: PostmanItem[];
  request?: PostmanRequest;
  response?: any[];
}

export interface PostmanRequest {
  method: string;
  header: PostmanHeader[];
  url: PostmanUrl;
  body?: PostmanBody;
  description?: string;
}

export interface PostmanHeader {
  key: string;
  value: string;
  type?: string;
}

export interface PostmanUrl {
  raw: string;
  protocol?: string;
  host?: string[];
  port?: string;
  path?: string[];
  query?: PostmanQuery[];
  variable?: any[];
}

export interface PostmanQuery {
  key: string;
  value: string;
}

export interface PostmanBody {
  mode: 'raw' | 'urlencoded' | 'formdata' | 'file' | 'graphql';
  raw?: string;
  urlencoded?: PostmanKeyValue[];
  formdata?: PostmanFormData[];
}

export interface PostmanKeyValue {
  key: string;
  value: string;
  type?: string;
}

export interface PostmanFormData {
  key: string;
  value?: string;
  src?: string[];
  type?: string;
}

export interface PostmanVariable {
  key: string;
  value: string;
  type?: string;
}

// Swagger/OpenAPI 格式
export interface SwaggerDocument {
  swagger?: string;
  openapi?: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  paths: Record<string, SwaggerPathItem>;
  basePath?: string;
  host?: string;
  schemes?: string[];
}

export interface SwaggerPathItem {
  get?: SwaggerOperation;
  post?: SwaggerOperation;
  put?: SwaggerOperation;
  delete?: SwaggerOperation;
  patch?: SwaggerOperation;
  head?: SwaggerOperation;
  options?: SwaggerOperation;
  parameters?: any[];
}

export interface SwaggerOperation {
  summary?: string;
  description?: string;
  operationId?: string;
  parameters?: SwaggerParameter[];
  responses?: Record<string, any>;
  tags?: string[];
}

export interface SwaggerParameter {
  name: string;
  in: 'query' | 'header' | 'path' | 'body' | 'formData';
  description?: string;
  required?: boolean;
  type?: string;
  schema?: any;
}

// YApi 格式
export interface YApiProject {
  _id: number;
  name: string;
  desc?: string;
  basepath?: string;
  env?: YApiEnv[];
}

export interface YApiEnv {
  name: string;
  domain: string;
  header?: any[];
}

export interface YApiInterface {
  _id: number;
  title: string;
  path: string;
  method: string;
  desc?: string;
  req_headers?: YApiHeader[];
  req_query?: YApiParam[];
  req_body_other?: string;
  res_body?: string;
  catid?: number;
}

export interface YApiHeader {
  name: string;
  value: string;
}

export interface YApiParam {
  name: string;
  desc?: string;
  required?: string;
}

export interface YApiCategory {
  _id: number;
  name: string;
  desc?: string;
}
