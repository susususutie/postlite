import { describe, it, expect, beforeEach } from 'vitest';
import { swaggerAdapter } from './index';
import { getService } from '../../services/storageBridge';
import type { CollectionIR } from '../core/types';
import type { Collection } from '../../types';

const swaggerJsonContent = `{"swagger": "2.0", "basePath": "/api/v1", "paths": {"/agent_manage/agent/install/configs": {"get": {"responses": {"200": {"description": "Success"}}, "summary": "agent安装配置", "operationId": "get_agent_install_os_types_resource", "parameters": [{"name": "X-Fields", "in": "header", "type": "string", "description": "An optional fields mask"}], "tags": ["agent_manage"]}}, "/agent_manage/agent/offline/install": {"post": {"responses": {"200": {"description": "Success"}}, "summary": "agent离线安装", "operationId": "post_agent_offline_install_resource", "parameters": [{"name": "payload", "required": true, "in": "body", "schema": {"type": "object"}}], "tags": ["agent_manage"]}}, "/agent_manage/agent/{agent_id}": {"parameters": [{"name": "agent_id", "in": "path", "required": true, "type": "integer"}], "get": {"responses": {"200": {"description": "Success"}}, "summary": "agent详情", "operationId": "get_agent_detail_resource", "tags": ["agent_manage"]}, "put": {"responses": {"200": {"description": "Success"}}, "summary": "agent编辑", "operationId": "put_agent_detail_resource", "tags": ["agent_manage"]}}, "/users/{user_id}": {"get": {"responses": {"200": {"description": "Success"}}, "summary": "获取用户信息", "tags": ["user"]}}}, "info": {"title": "Test API", "version": "1.0.0"}, "host": "api.example.com", "schemes": ["https"]}`;

describe('Swagger Full Import to IndexedDB', () => {
  let ir: CollectionIR;
  let service: NonNullable<ReturnType<typeof getService>>;
  let createdCollection: Collection | null;

  beforeEach(async () => {
    const swaggerData = JSON.parse(swaggerJsonContent);
    ir = swaggerAdapter.parse(swaggerData);
    const rawService = getService();
    expect(rawService).not.toBeNull();
    service = rawService!;

    createdCollection = await service.createCollection(ir.name, ir.description);
    console.log('Created collection:', createdCollection.name, createdCollection.id);

    const rootFolder = createdCollection.folders[0];
    expect(rootFolder).toBeDefined();

    const folderMap = new Map<string, string>();
    folderMap.set('root', rootFolder.id);

    for (const item of ir.items) {
      if (item.type === 'folder') {
        const folderItem = await service.createItem(createdCollection.id, {
          type: 'folder',
          name: item.name,
          parentId: rootFolder.id,
          data: { description: item.description },
        });
        expect(folderItem).not.toBeNull();
        console.log('Created folder:', folderItem!.name, folderItem!.id);
        folderMap.set(item.name, folderItem!.id);

        if (item.children) {
          for (const child of item.children) {
            await service.createItem(createdCollection.id, {
              type: 'request',
              name: child.name,
              parentId: folderItem!.id,
              data: {
                method: child.method,
                url: child.url,
                headers: child.headers,
                params: child.params,
                body: child.body,
                description: child.description,
              },
            });
            console.log('Created request in folder:', child.name, child.method);
          }
        }
      } else {
        await service.createItem(createdCollection.id, {
          type: 'request',
          name: item.name,
          parentId: rootFolder.id,
          data: {
            method: item.method,
            url: item.url,
            headers: item.headers,
            params: item.params,
            body: item.body,
            description: item.description,
          },
        });
        console.log('Created root request:', item.name, item.method);
      }
    }
  });

  it('should create collection with correct name', () => {
    expect(createdCollection?.name).toBe('Test API');
  });

  it('should save and retrieve collection from IndexedDB', async () => {
    const retrieved = await service.getCollection(createdCollection!.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.name).toBe('Test API');
    console.log('Retrieved collection:', retrieved?.name);
  });

  it('should have correct folder structure', async () => {
    const retrieved = await service.getCollection(createdCollection!.id);
    expect(retrieved?.folders.length).toBeGreaterThan(0);

    const rootFolder = retrieved?.folders[0];
    expect(rootFolder).not.toBeUndefined();

    const subfolders = rootFolder?.folders || [];
    console.log('Subfolders:', subfolders.map(f => f.name));

    const agentFolder = subfolders.find(f => f.name === 'agent_manage');
    const userFolder = subfolders.find(f => f.name === 'user');

    expect(agentFolder).not.toBeUndefined();
    expect(userFolder).not.toBeUndefined();
  });

  it('should have requests in correct folders', async () => {
    const retrieved = await service.getCollection(createdCollection!.id);
    const rootFolder = retrieved?.folders[0];
    const subfolders = rootFolder?.folders || [];

    const agentFolder = subfolders.find(f => f.name === 'agent_manage');
    expect(agentFolder?.requests.length).toBe(4);
    console.log('Agent requests:', agentFolder?.requests.map(r => `${r.method} ${r.name}`));

    const userFolder = subfolders.find(f => f.name === 'user');
    expect(userFolder?.requests.length).toBe(1);
    console.log('User requests:', userFolder?.requests.map(r => `${r.method} ${r.name}`));
  });

  it('should have correct HTTP methods', async () => {
    const retrieved = await service.getCollection(createdCollection!.id);
    const rootFolder = retrieved?.folders[0];
    const subfolders = rootFolder?.folders || [];
    const agentFolder = subfolders.find(f => f.name === 'agent_manage');

    const methods = agentFolder?.requests.map(r => r.method) || [];
    expect(methods).toContain('GET');
    expect(methods).toContain('POST');
    expect(methods).toContain('PUT');
  });

  it('should have correct URLs with path parameters', async () => {
    const retrieved = await service.getCollection(createdCollection!.id);
    const rootFolder = retrieved?.folders[0];
    const subfolders = rootFolder?.folders || [];
    const agentFolder = subfolders.find(f => f.name === 'agent_manage');

    const agentByIdRequest = agentFolder?.requests.find(r => r.name.includes('agent详情') || r.name.includes('agent编辑'));
    expect(agentByIdRequest?.url).toContain('{{agent_id}}');
    console.log('URL with path param:', agentByIdRequest?.url);
  });

  it('should have query and header parameters', async () => {
    const retrieved = await service.getCollection(createdCollection!.id);
    const rootFolder = retrieved?.folders[0];
    const subfolders = rootFolder?.folders || [];
    const agentFolder = subfolders.find(f => f.name === 'agent_manage');

    const installConfigRequest = agentFolder?.requests.find(r => r.name.includes('agent安装配置'));
    expect(installConfigRequest?.headers?.length).toBeGreaterThan(0);
    console.log('Headers:', installConfigRequest?.headers);
  });

  it('should list all collections', async () => {
    const collections = await service.getAllCollections();
    expect(collections.length).toBeGreaterThan(0);
    console.log('All collections:', collections.map(c => c.name));
  });
});
