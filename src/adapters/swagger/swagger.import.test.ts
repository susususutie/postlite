import { describe, it, expect, beforeEach } from 'vitest';
import { swaggerAdapter } from './index';
import type { CollectionIR, ItemIR } from '../core/types';

const swaggerJsonContent = `{"swagger": "2.0", "basePath": "/api/v1", "paths": {"/agent_manage/agent/install/configs": {"get": {"responses": {"200": {"description": "Success", "schema": {"$ref": "#/definitions/Agent%20Install%20Configs%20Response%20Model"}}}, "summary": "agent安装操作系统类", "operationId": "get_agent_install_os_types_resource", "parameters": [{"name": "X-Fields", "in": "header", "type": "string", "format": "mask", "description": "An optional fields mask"}], "tags": ["agent_manage"]}}, "/agent_manage/agent/offline/install": {"post": {"responses": {"200": {"description": "Success"}}, "summary": "agent离线安装, 生成安装命令", "operationId": "post_agent_offline_install_resource", "parameters": [{"name": "payload", "required": true, "in": "body", "schema": {"$ref": "#/definitions/Agent%20Offline%20Install%20Request%20Model"}}], "tags": ["agent_manage"]}}, "/agent_manage/agent/{agent_id}": {"parameters": [{"name": "agent_id", "in": "path", "required": true, "type": "integer"}], "put": {"responses": {"200": {"description": "Success", "schema": {"$ref": "#/definitions/Agent%20Create%20Response%20Model"}}}, "summary": "agent编辑", "operationId": "put_agent_detail_resource", "parameters": [{"name": "payload", "required": true, "in": "body", "schema": {"$ref": "#/definitions/Agent%20Create%20Request%20Model"}}, {"name": "X-Fields", "in": "header", "type": "string", "format": "mask", "description": "An optional fields mask"}], "tags": ["agent_manage"]}, "get": {"responses": {"200": {"description": "Success", "schema": {"$ref": "#/definitions/Agent%20Response%20Model"}}}, "summary": "agent详情", "operationId": "get_agent_detail_resource", "parameters": [{"name": "X-Fields", "in": "header", "type": "string", "format": "mask", "description": "An optional fields mask"}], "tags": ["agent_manage"]}, "delete": {"responses": {"200": {"description": "Success"}}, "summary": "agent删除", "operationId": "delete_agent_detail_resource", "tags": ["agent_manage"]}}, "/agent_manage/agents": {"get": {"responses": {"200": {"description": "Success", "schema": {"$ref": "#/definitions/Agent%20List%20Response%20Model"}}}, "summary": "agent列表", "operationId": "get_agent_list_resource", "parameters": [{"name": "page", "in": "query", "type": "integer", "description": "Page number"}, {"name": "page_size", "in": "query", "type": "integer", "description": "Page size"}, {"name": "X-Fields", "in": "header", "type": "string", "format": "mask", "description": "An optional fields mask"}], "tags": ["agent_manage"]}, "post": {"responses": {"200": {"description": "Success", "schema": {"$ref": "#/definitions/Agent%20Create%20Response%20Model"}}}, "summary": "agent创建", "operationId": "post_agent_list_resource", "parameters": [{"name": "payload", "required": true, "in": "body", "schema": {"$ref": "#/definitions/Agent%20Create%20Request%20Model"}}], "tags": ["agent_manage"]}}, "/users/{user_id}": {"get": {"responses": {"200": {"description": "Success"}}, "summary": "获取用户信息", "operationId": "get_user_detail", "tags": ["user"]}, "put": {"responses": {"200": {"description": "Success"}}, "summary": "更新用户信息", "operationId": "update_user", "tags": ["user"]}}, "/users": {"get": {"responses": {"200": {"description": "Success"}}, "summary": "用户列表", "operationId": "get_user_list", "tags": ["user"]}, "post": {"responses": {"200": {"description": "Success"}}, "summary": "创建用户", "operationId": "create_user", "tags": ["user"]}}}, "info": {"title": "Agent Management API", "description": "API for managing agents and users", "version": "1.0.0"}, "host": "api.example.com", "schemes": ["https"]}`;

describe('Swagger Import', () => {
  let ir: CollectionIR;

  beforeEach(() => {
    const swaggerData = JSON.parse(swaggerJsonContent);
    ir = swaggerAdapter.parse(swaggerData);
  });

  it('should parse CollectionIR with correct name', () => {
    expect(ir.name).toBe('Agent Management API');
    console.log('Collection name:', ir.name);
  });

  it('should parse CollectionIR with description', () => {
    expect(ir.description).toBe('API for managing agents and users');
    console.log('Collection description:', ir.description);
  });

  it('should have items', () => {
    expect(ir.items).toBeDefined();
    expect(Array.isArray(ir.items)).toBe(true);
    console.log('Items count:', ir.items.length);
  });

  it('should have correct folder structure by tags', () => {
    const folders = ir.items.filter((item): item is ItemIR => item.type === 'folder');
    const requests = ir.items.filter((item): item is ItemIR => item.type === 'request');

    console.log('Folders:', folders.length);
    console.log('Root requests (no tag):', requests.length);

    folders.forEach(folder => {
      console.log(`Folder: ${folder.name}, Children: ${folder.children?.length || 0}`);
    });

    requests.forEach(req => {
      console.log(`Request: ${req.name} [${req.method}] ${req.url}`);
    });

    expect(folders.length).toBe(2);
    expect(folders.find(f => f.name === 'agent_manage')).toBeDefined();
    expect(folders.find(f => f.name === 'user')).toBeDefined();
  });

  it('should correctly convert requests with path parameters', () => {
    const agentFolder = ir.items.find(
      (item): item is ItemIR => item.type === 'folder' && item.name === 'agent_manage'
    );
    
    expect(agentFolder).toBeDefined();
    const agentRequests = agentFolder?.children || [];
    
    const agentByIdRequest = agentRequests.find((r): r is ItemIR => {
      return typeof r.url === 'string' && r.url.includes('{agent_id}');
    });
    
    expect(agentByIdRequest).toBeDefined();
    expect(agentByIdRequest?.url).toContain('{{agent_id}}');
    
    console.log('Request with path param:', agentByIdRequest?.url);
  });

  it('should extract query and header parameters', () => {
    const agentFolder = ir.items.find(
      (item): item is ItemIR => item.type === 'folder' && item.name === 'agent_manage'
    );
    
    const agentListRequest = agentFolder?.children?.find(
      (r): r is ItemIR => r.name.includes('agent列表')
    );
    
    expect(agentListRequest).toBeDefined();
    expect(agentListRequest?.params?.length).toBeGreaterThan(0);
    expect(agentListRequest?.headers?.length).toBeGreaterThan(0);
    
    console.log('Query params:', agentListRequest?.params);
    console.log('Header params:', agentListRequest?.headers);
  });

  it('should build correct base URL', () => {
    const agentFolder = ir.items.find(
      (item): item is ItemIR => item.type === 'folder' && item.name === 'agent_manage'
    );
    
    const request = agentFolder?.children?.[0];
    expect(request?.url).toMatch(/^https:\/\/api\.example\.com/);
    
    console.log('Full URL:', request?.url);
  });
});

describe('Swagger Adapter detect', () => {
  it('should detect swagger 2.0', () => {
    expect(swaggerAdapter.detect({ swagger: '2.0', info: { title: 'Test', version: '1.0' } })).toBe(true);
  });

  it('should detect openapi 3.x', () => {
    expect(swaggerAdapter.detect({ openapi: '3.0.0', info: { title: 'Test', version: '1.0' } })).toBe(true);
  });

  it('should reject invalid documents', () => {
    expect(swaggerAdapter.detect({ info: { title: 'Test', version: '1.0' } })).toBe(false);
    expect(swaggerAdapter.detect(null)).toBe(false);
    expect(swaggerAdapter.detect(undefined)).toBe(false);
  });
});
