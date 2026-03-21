import { useState, useEffect, useCallback } from 'react';
import {
  Layout,
  theme,
  message,
} from 'antd';
import type { HttpRequest } from './types';
import { CollectionTree } from './components/CollectionTree';
import { RequestBuilder } from './components/RequestBuilder';
import { EnvironmentManager } from './components/EnvironmentManager';
import { createRequest, updateRequest } from './services/collection';
import './App.css';

const { Header, Sider, Content } = Layout;

// 注册 Service Worker
const registerServiceWorker = async () => {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registered:', registration);
    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  }
};

function App() {
  const [selectedRequest, setSelectedRequest] = useState<HttpRequest | undefined>(undefined);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | undefined>(undefined);
  const [selectedFolderId, setSelectedFolderId] = useState<string | undefined>(undefined);
  const [refreshKey, setRefreshKey] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const [envCollapsed, setEnvCollapsed] = useState(false);

  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  // 注册 Service Worker
  useEffect(() => {
    registerServiceWorker();
  }, []);

  // 处理选择请求
  const handleSelectRequest = useCallback((request: HttpRequest, collectionId: string, folderId?: string) => {
    setSelectedRequest(request);
    setSelectedCollectionId(collectionId);
    setSelectedFolderId(folderId);
  }, []);

  // 处理创建新请求
  const handleCreateRequest = useCallback((collectionId: string, folderId?: string) => {
    const newRequest: HttpRequest = {
      id: '',
      name: 'New Request',
      method: 'GET',
      url: '',
      headers: [],
      params: [],
    };
    setSelectedRequest(newRequest);
    setSelectedCollectionId(collectionId);
    setSelectedFolderId(folderId);
  }, []);

  // 处理保存请求
  const handleSaveRequest = useCallback((request: HttpRequest) => {
    if (!selectedCollectionId) {
      message.error('Please select a collection first');
      return;
    }

    let savedRequest: HttpRequest | null;

    if (request.id) {
      // 更新现有请求
      savedRequest = updateRequest(
        selectedCollectionId,
        request.id,
        {
          name: request.name,
          method: request.method,
          url: request.url,
          headers: request.headers,
          params: request.params,
          body: request.body,
        },
        selectedFolderId
      );
    } else {
      // 创建新请求
      savedRequest = createRequest(
        selectedCollectionId,
        {
          name: request.name,
          method: request.method,
          url: request.url,
          headers: request.headers,
          params: request.params,
          body: request.body,
        },
        selectedFolderId
      );
    }

    if (savedRequest) {
      message.success('Request saved successfully');
      setSelectedRequest(savedRequest);
      setRefreshKey(prev => prev + 1);
    } else {
      message.error('Failed to save request');
    }
  }, [selectedCollectionId, selectedFolderId]);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', alignItems: 'center', background: '#001529', padding: '0 24px' }}>
        <h1 style={{ color: 'white', margin: 0, fontSize: 20 }}>Postlite</h1>
        <span style={{ color: 'rgba(255,255,255,0.65)', marginLeft: 16 }}>
          Lightweight API Testing Tool
        </span>
      </Header>

      <Layout>
        {/* 左侧 Collection 树 */}
        <Sider
          width={300}
          theme="light"
          collapsible
          collapsed={collapsed}
          onCollapse={setCollapsed}
          style={{
            background: colorBgContainer,
            borderRight: '1px solid #f0f0f0',
          }}
        >
          <div style={{ padding: 16, height: '100%', overflow: 'auto' }}>
            <CollectionTree
              onSelectRequest={handleSelectRequest}
              onCreateRequest={handleCreateRequest}
              refreshKey={refreshKey}
            />
          </div>
        </Sider>

        {/* 中间请求构建区 */}
        <Content style={{ padding: 24, background: '#f5f5f5' }}>
          <div
            style={{
              background: colorBgContainer,
              padding: 24,
              borderRadius: borderRadiusLG,
              minHeight: '100%',
            }}
          >
            <RequestBuilder
              initialRequest={selectedRequest}
              onSave={handleSaveRequest}
              collectionId={selectedCollectionId}
              folderId={selectedFolderId}
            />
          </div>
        </Content>

        {/* 右侧环境管理区 */}
        <Sider
          width={350}
          theme="light"
          collapsible
          collapsed={envCollapsed}
          onCollapse={setEnvCollapsed}
          collapsedWidth={0}
          reverseArrow
          zeroWidthTriggerStyle={{
            border: '1px solid var(--ant-color-border)',
            borderRight: 0,
          }}
          style={{
            background: colorBgContainer,
            borderLeft: '1px solid #f0f0f0',
          }}
        >
          <div style={{ padding: 16, height: '100%', overflow: 'auto' }}>
            <EnvironmentManager
              onChange={() => {
                // 环境变量变化时触发刷新
              }}
            />
          </div>
        </Sider>
      </Layout>
    </Layout>
  );
}

export default App;