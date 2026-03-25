export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

export type BodyMode = 'none' | 'json' | 'text' | 'formdata' | 'urlencoded';

export interface KeyValue {
  key: string;
  value: string;
  enabled: boolean;
}

export interface BodyContent {
  mode: BodyMode;
  content?: string;
}

export interface StorageCollection {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
}

export interface StorageItem {
  id: string;
  type: 'folder' | 'request';
  name: string;
  parentId: string;
  collectionId: string;
  createdAt: number;
  updatedAt: number;
  description?: string;
  method?: HttpMethod;
  url?: string;
  headers?: KeyValue[];
  params?: KeyValue[];
  body?: BodyContent;
}