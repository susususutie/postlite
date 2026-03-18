import { useState, useEffect, useCallback } from 'react';
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
} from 'antd';
import {
  SendOutlined,
  PlusOutlined,
  DeleteOutlined,
  SaveOutlined,
  CopyOutlined,
} from '@ant-design/icons';
import type { HttpRequest, HttpResponse, HttpMethod, Header, Param, RequestBody } from '../types';
import { sendRequest } from '../services/http';
import { getCurrentEnvironment } from '../services/environment';
import { applyEnvToUrl, applyEnvToHeaders, applyEnvToBody } from '../utils/environment';
import { JsonEditor } from './JsonEditor';

const { Option } = Select;
const { TabPane } = Tabs;
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
}

export const RequestBuilder: React.FC<RequestBuilderProps> = ({
  initialRequest,
  onSave,
}) => {
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
      <Row gutter={[8, 8]} style={{ marginBottom: 16 }}>
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
            placeholder="Enter URL or paste cURL command"
            onPressEnter={handleSend}
          />
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

      {/* 请求配置标签页 */}
      <Card style={{ marginBottom: 16, flex: 1, minHeight: 200 }}>
        <Tabs defaultActiveKey="params">
          <TabPane tab={`Params (${params.filter(p => p.enabled && p.key).length})`} key="params">
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
          </TabPane>
          <TabPane tab={`Headers (${headers.filter(h => h.enabled && h.key).length})`} key="headers">
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
          </TabPane>
          <TabPane tab="Body" key="body">
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
          </TabPane>
        </Tabs>
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
          <Tabs defaultActiveKey="body">
            <TabPane tab="Body" key="body">
              <JsonEditor
                value={typeof response.data === 'string'
                  ? response.data
                  : JSON.stringify(response.data, null, 2)}
                language="json"
                readOnly
              />
            </TabPane>
            <TabPane tab="Headers" key="headers">
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
            </TabPane>
          </Tabs>
        )}
      </Card>
    </div>
  );
};
