import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Input,
  Select,
  Button,
  Tabs,
  Table,
  Space,
  Switch,
  Tag,
  Row,
  Col,
  Card,
  Alert,
  Spin,
  Empty,
  Typography,
  message,
  Dropdown,
} from 'antd';
import type { MenuProps } from 'antd';
import {
  SendOutlined,
  PlusOutlined,
  DeleteOutlined,
  SaveOutlined,
  CopyOutlined,
  DownOutlined,
  GlobalOutlined,
  WarningOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import {
  resolveVariables,
  StaticVariableResolver,
  extractUnresolvedVariables,
} from '../utils/variables';
import { normalizeUrl, isValidUrl } from '../utils/url';
import type { HttpRequest, HttpResponse, HttpMethod, Header, Param, RequestBody } from '../types';
import { sendRequest } from '../services/http';
import { getCurrentEnvironment } from '../services/environment';
import { applyEnvToUrl, applyEnvToHeaders, applyEnvToBody } from '../utils/environment';
import { JsonEditor } from './JsonEditor';

const { Option } = Select;
const { Text } = Typography;

const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];

const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: 'green',
  POST: 'blue',
  PUT: 'orange',
  DELETE: 'red',
  PATCH: 'purple',
  HEAD: 'cyan',
  OPTIONS: 'default',
};

interface RequestBuilderProps {
  initialRequest?: HttpRequest;
  onSave?: (request: HttpRequest) => void;
  collectionId?: string;
  folderId?: string;
  collection?: { defaultBaseUrl?: string };
}

export const RequestBuilder: React.FC<RequestBuilderProps> = (props) => {
  const { initialRequest, onSave, collection } = props;
  // 请求状态
  const [method, setMethod] = useState<HttpMethod>(initialRequest?.method || 'GET');
  const [url, setUrl] = useState(initialRequest?.url || '');
  const [headers, setHeaders] = useState<Header[]>(initialRequest?.headers || []);
  const [params, setParams] = useState<Param[]>(initialRequest?.params || []);
  const [body, setBody] = useState<RequestBody | undefined>(initialRequest?.body);
  const [requestName, setRequestName] = useState(initialRequest?.name || 'New Request');

  // 响应状态
  const [response, setResponse] = useState<HttpResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 获取当前环境变量
  const envVariables = useMemo(() => {
    const currentEnv = getCurrentEnvironment();
    return currentEnv?.variables || [];
  }, []);

  // 计算 URL 预览
  const urlPreview = useMemo(() => {
    if (!url) {
      return { url: '', status: 'empty' as const };
    }

    try {
      // 1. 弱拼接 defaultBaseUrl
      let rawUrl = url;
      if (collection?.defaultBaseUrl &&
          !rawUrl.includes('://') &&
          !rawUrl.includes('{{') &&
          !rawUrl.startsWith('/')) {
        rawUrl = `${collection.defaultBaseUrl}${rawUrl}`;
      }

      // 2. 变量解析
      const resolver = new StaticVariableResolver(envVariables);
      const resolved = resolveVariables(rawUrl, resolver);

      // 3. URL 规范化
      const normalized = normalizeUrl(resolved);

      // 4. 检查未解析变量
      const unresolved = extractUnresolvedVariables(normalized);
      if (unresolved.length > 0) {
        return {
          url: normalized,
          status: 'warning' as const,
          unresolvedVars: unresolved,
        };
      }

      // 5. 校验 URL 合法性
      if (!isValidUrl(normalized)) {
        return { url: normalized, status: 'error' as const };
      }

      return { url: normalized, status: 'valid' as const };
    } catch (e) {
      return {
        url: url,
        status: 'error' as const,
        error: (e as Error).message,
      };
    }
  }, [url, envVariables, collection?.defaultBaseUrl]);

  // 插入变量到 URL
  const insertVariable = useCallback((varName: string) => {
    const variable = `{{${varName}}}`;
    // 在光标位置插入或追加到末尾
    const input = document.querySelector('input[placeholder*="Enter URL"]') as HTMLInputElement;
    if (input) {
      const start = input.selectionStart || url.length;
      const end = input.selectionEnd || url.length;
      const newUrl = url.substring(0, start) + variable + url.substring(end);
      setUrl(newUrl);
      // 恢复焦点
      setTimeout(() => {
        input.focus();
        const newCursorPos = start + variable.length;
        input.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    } else {
      setUrl(url + variable);
    }
  }, [url]);

  // 构建变量菜单项
  const variableMenuItems: MenuProps['items'] = useMemo(() => {
    const enabledVars = envVariables.filter(v => v.enabled);
    if (enabledVars.length === 0) {
      return [{ key: 'empty', label: '无可用变量', disabled: true }];
    }
    return enabledVars.map(v => ({
      key: v.key,
      label: `{{${v.key}}}`,
      onClick: () => insertVariable(v.key),
    }));
  }, [envVariables, insertVariable]);

  // 更新初始请求
  useEffect(() => {
    if (initialRequest) {
      setMethod(initialRequest.method);
      setUrl(initialRequest.url);
      setHeaders(initialRequest.headers);
      setParams(initialRequest.params);
      setBody(initialRequest.body);
      setRequestName(initialRequest.name);
    }
  }, [initialRequest]);

  // 发送请求
  const handleSend = useCallback(async () => {
    if (!url.trim()) {
      message.error('Please enter a URL');
      return;
    }

    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      // 获取当前环境变量
      const currentEnv = getCurrentEnvironment();
      const variables = currentEnv?.variables || [];

      // 构建请求对象
      const request: HttpRequest = {
        id: initialRequest?.id || '',
        name: requestName,
        method,
        url,
        headers,
        params,
        body,
      };

      // 应用环境变量
      const processedRequest: HttpRequest = {
        ...request,
        url: applyEnvToUrl(request.url, variables),
        headers: Object.entries(applyEnvToHeaders(
          Object.fromEntries(request.headers.filter(h => h.enabled).map(h => [h.key, h.value])),
          variables
        )).map(([key, value]) => ({ key, value, enabled: true })),
        body: request.body ? {
          ...request.body,
          content: applyEnvToBody(request.body.content, variables),
        } : undefined,
      };

      const res = await sendRequest(processedRequest);
      setResponse(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  }, [method, url, headers, params, body, requestName, initialRequest?.id]);

  // 保存请求
  const handleSave = () => {
    const request: HttpRequest = {
      id: initialRequest?.id || '',
      name: requestName,
      method,
      url,
      headers,
      params,
      body,
    };
    onSave?.(request);
  };

  // 添加 Header
  const addHeader = () => {
    setHeaders([...headers, { key: '', value: '', enabled: true }]);
  };

  // 更新 Header
  const updateHeader = (index: number, field: keyof Header, value: unknown) => {
    const newHeaders = [...headers];
    newHeaders[index] = { ...newHeaders[index], [field]: value };
    setHeaders(newHeaders);
  };

  // 删除 Header
  const deleteHeader = (index: number) => {
    setHeaders(headers.filter((_, i) => i !== index));
  };

  // 添加 Param
  const addParam = () => {
    setParams([...params, { key: '', value: '', enabled: true }]);
  };

  // 更新 Param
  const updateParam = (index: number, field: keyof Param, value: unknown) => {
    const newParams = [...params];
    newParams[index] = { ...newParams[index], [field]: value };
    setParams(newParams);
  };

  // 删除 Param
  const deleteParam = (index: number) => {
    setParams(params.filter((_, i) => i !== index));
  };

  // 复制响应
  const copyResponse = () => {
    if (response?.data) {
      const text = typeof response.data === 'string'
        ? response.data
        : JSON.stringify(response.data, null, 2);
      navigator.clipboard.writeText(text);
      message.success('Copied to clipboard');
    }
  };

  // Header 表格列
  const headerColumns = [
    {
      title: 'Enabled',
      dataIndex: 'enabled',
      width: 80,
      render: (_record: unknown, _index: unknown, index: number) => (
        <Switch
          size="small"
          checked={headers[index].enabled}
          onChange={(checked) => updateHeader(index, 'enabled', checked)}
        />
      ),
    },
    {
      title: 'Key',
      dataIndex: 'key',
      render: (_record: unknown, _index: unknown, index: number) => (
        <Input
          placeholder="Header name"
          value={headers[index].key}
          onChange={(e) => updateHeader(index, 'key', e.target.value)}
          size="small"
        />
      ),
    },
    {
      title: 'Value',
      dataIndex: 'value',
      render: (_record: unknown, _index: unknown, index: number) => (
        <Input
          placeholder="Header value"
          value={headers[index].value}
          onChange={(e) => updateHeader(index, 'value', e.target.value)}
          size="small"
        />
      ),
    },
    {
      title: '',
      width: 50,
      render: (_record: unknown, _index: unknown, index: number) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          size="small"
          onClick={() => deleteHeader(index)}
        />
      ),
    },
  ];

  // Param 表格列
  const paramColumns = [
    {
      title: 'Enabled',
      dataIndex: 'enabled',
      width: 80,
      render: (_record: unknown, _index: unknown, index: number) => (
        <Switch
          size="small"
          checked={params[index].enabled}
          onChange={(checked) => updateParam(index, 'enabled', checked)}
        />
      ),
    },
    {
      title: 'Key',
      dataIndex: 'key',
      render: (_record: unknown, _index: unknown, index: number) => (
        <Input
          placeholder="Parameter name"
          value={params[index].key}
          onChange={(e) => updateParam(index, 'key', e.target.value)}
          size="small"
        />
      ),
    },
    {
      title: 'Value',
      dataIndex: 'value',
      render: (_record: unknown, _index: unknown, index: number) => (
        <Input
          placeholder="Parameter value"
          value={params[index].value}
          onChange={(e) => updateParam(index, 'value', e.target.value)}
          size="small"
        />
      ),
    },
    {
      title: '',
      width: 50,
      render: (_record: unknown, _index: unknown, index: number) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          size="small"
          onClick={() => deleteParam(index)}
        />
      ),
    },
  ];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 请求名称和保存按钮 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col flex="auto">
          <Input
            value={requestName}
            onChange={(e) => setRequestName(e.target.value)}
            placeholder="Request name"
            style={{ fontWeight: 'bold' }}
          />
        </Col>
        <Col>
          <Button icon={<SaveOutlined />} onClick={handleSave}>
            Save
          </Button>
        </Col>
      </Row>

      {/* URL 和方法栏 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[8, 8]} style={{ marginBottom: 8 }}>
          <Col>
            <Select
              value={method}
              onChange={setMethod}
              style={{ width: 120 }}
            >
              {HTTP_METHODS.map((m) => (
                <Option key={m} value={m}>
                  <Tag color={METHOD_COLORS[m]} style={{ marginRight: 0 }}>
                    {m}
                  </Tag>
                </Option>
              ))}
            </Select>
          </Col>
          <Col flex="auto">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Enter URL or paste cURL command (e.g., {{baseURL}}/api/users)"
              onPressEnter={handleSend}
            />
          </Col>
          <Col>
            <Dropdown menu={{ items: variableMenuItems }} placement="bottomRight">
              <Button icon={<DownOutlined />}>
                插入变量
              </Button>
            </Dropdown>
          </Col>
          <Col>
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={handleSend}
              loading={loading}
            >
              Send
            </Button>
          </Col>
        </Row>

        {/* URL 预览区域 */}
        <div style={{ padding: '8px 0', borderTop: '1px solid #f0f0f0' }}>
          <Space orientation="vertical" style={{ width: '100%' }} size={4}>
            <Space>
              <Text type="secondary" style={{ fontSize: 12 }}>实际请求 URL:</Text>
              {urlPreview.status === 'valid' && (
                <Tag icon={<CheckCircleOutlined />} color="success" style={{ fontSize: 11 }}>
                  有效
                </Tag>
              )}
              {urlPreview.status === 'warning' && (
                <Tag icon={<WarningOutlined />} color="warning" style={{ fontSize: 11 }}>
                  未解析变量
                </Tag>
              )}
              {urlPreview.status === 'error' && (
                <Tag icon={<WarningOutlined />} color="error" style={{ fontSize: 11 }}>
                  无效 URL
                </Tag>
              )}
            </Space>
            <Text
              code
              style={{
                fontSize: 12,
                color: urlPreview.status === 'error' ? '#ff4d4f' :
                       urlPreview.status === 'warning' ? '#faad14' : '#52c41a',
                wordBreak: 'break-all',
                display: 'block',
                padding: 4,
                background: '#f6ffed',
                borderRadius: 4,
              }}
            >
              {urlPreview.url || '等待输入...'}
            </Text>
            {urlPreview.status === 'warning' && urlPreview.unresolvedVars && (
              <Text type="warning" style={{ fontSize: 11 }}>
                未定义变量: {urlPreview.unresolvedVars.join(', ')} - 请先在环境管理中添加
              </Text>
            )}
            {urlPreview.error && (
              <Text type="danger" style={{ fontSize: 11 }}>
                {urlPreview.error}
              </Text>
            )}
            {collection?.defaultBaseUrl && (
              <Space>
                <GlobalOutlined style={{ color: '#52c41a', fontSize: 12 }} />
                <Text type="secondary" style={{ fontSize: 11 }}>
                  使用 Collection 默认 Base URL: {collection.defaultBaseUrl}
                </Text>
              </Space>
            )}
          </Space>
        </div>
      </Card>

      {/* 请求配置标签页 */}
      <Card style={{ marginBottom: 16, flex: 1, minHeight: 200 }}>
        <Tabs
          defaultActiveKey="params"
          items={[
            {
              key: 'params',
              label: `Params (${params.filter(p => p.enabled && p.key).length})`,
              children: (
                <Table
                  dataSource={params.map((p, i) => ({ ...p, key: i }))}
                  columns={paramColumns}
                  pagination={false}
                  size="small"
                  footer={() => (
                    <Button
                      type="dashed"
                      block
                      icon={<PlusOutlined />}
                      onClick={addParam}
                      size="small"
                    >
                      Add Parameter
                    </Button>
                  )}
                />
              ),
            },
            {
              key: 'headers',
              label: `Headers (${headers.filter(h => h.enabled && h.key).length})`,
              children: (
                <Table
                  dataSource={headers.map((h, i) => ({ ...h, key: i }))}
                  columns={headerColumns}
                  pagination={false}
                  size="small"
                  footer={() => (
                    <Button
                      type="dashed"
                      block
                      icon={<PlusOutlined />}
                      onClick={addHeader}
                      size="small"
                    >
                      Add Header
                    </Button>
                  )}
                />
              ),
            },
            {
              key: 'body',
              label: 'Body',
              children: (
                <Row gutter={[16, 16]}>
                  <Col span={24}>
                    <Select
                      value={body?.mode || 'none'}
                      onChange={(mode) => setBody(mode === 'none' ? undefined : { mode, content: body?.content || '' })}
                      style={{ width: 150, marginBottom: 16 }}
                    >
                      <Option value="none">None</Option>
                      <Option value="json">JSON</Option>
                      <Option value="text">Text</Option>
                      <Option value="urlencoded">x-www-form-urlencoded</Option>
                    </Select>
                  </Col>
                  {body?.mode && body.mode !== 'none' && (
                    <Col span={24}>
                      <JsonEditor
                        value={body.content || ''}
                        onChange={(value) => setBody({ ...body, content: value })}
                        language={body.mode === 'json' ? 'json' : 'text'}
                      />
                    </Col>
                  )}
                </Row>
              ),
            },
          ]}
        />
      </Card>

      {/* 响应区域 */}
      <Card
        title={
          <Space>
            <Text strong>Response</Text>
            {response && (
              <>
                <Tag color={response.status >= 200 && response.status < 300 ? 'success' : 'error'}>
                  {response.status} {response.statusText}
                </Tag>
                <Text type="secondary">{response.time}ms</Text>
                <Text type="secondary">{response.size}B</Text>
              </>
            )}
          </Space>
        }
        extra={
          response && (
            <Button icon={<CopyOutlined />} size="small" onClick={copyResponse}>
              Copy
            </Button>
          )
        }
        style={{ flex: 1, minHeight: 200 }}
      >
        {loading && (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin size="large" />
            <p>Sending request...</p>
          </div>
        )}

        {error && (
          <Alert
            message="Request Error"
            description={error}
            type="error"
            showIcon
          />
        )}

        {!loading && !error && !response && (
          <Empty description="Send a request to see the response" />
        )}

        {response && (
          <Tabs
            defaultActiveKey="body"
            items={[
              {
                key: 'body',
                label: 'Body',
                children: (
                  <JsonEditor
                    value={typeof response.data === 'string'
                      ? response.data
                      : JSON.stringify(response.data, null, 2)}
                    language="json"
                    readOnly
                  />
                ),
              },
              {
                key: 'headers',
                label: 'Headers',
                children: (
                  <Table
                    dataSource={Object.entries(response.headers).map(([key, value]) => ({
                      key,
                      value,
                    }))}
                    columns={[
                      { title: 'Name', dataIndex: 'key', width: '40%' },
                      { title: 'Value', dataIndex: 'value' },
                    ]}
                    pagination={false}
                    size="small"
                  />
                ),
              },
            ]}
          />
        )}
      </Card>
    </div>
  );
};
