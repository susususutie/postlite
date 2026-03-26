import { useState, useCallback } from 'react';
import {
  Select,
  Button,
  Input,
  Switch,
  Space,
  Modal,
  Form,
  message,
  Card,
  Tag,
  Dropdown,
  Tooltip,
} from 'antd';
import type { MenuProps } from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  CopyOutlined,
  SettingOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  StarOutlined,
  GlobalOutlined,
  KeyOutlined,
} from '@ant-design/icons';
import type { Environment, EnvironmentVariable } from '../types';
import {
  getEnvironments,
  getCurrentEnvironmentId,
  setCurrentEnvironment,
  createEnvironment,
  updateEnvironment,
  deleteEnvironment,
  addEnvironmentVariable,
  deleteEnvironmentVariable,
  cloneEnvironment,
  setEnvironmentVariables,
} from '../services/environment';

// 设置当前环境ID的辅助函数
const setCurrentEnvironmentId = (envId: string | undefined) => {
  setCurrentEnvironment(envId);
};

const { Option } = Select;

interface EnvironmentManagerProps {
  onChange?: () => void;
}

export const EnvironmentManager: React.FC<EnvironmentManagerProps> = ({ onChange }) => {
  const [environments, setEnvironments] = useState<Environment[]>(getEnvironments());
  const [currentEnvId, setCurrentEnvId] = useState<string | undefined>(getCurrentEnvironmentId());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingEnv, setEditingEnv] = useState<Environment | null>(null);
  const [form] = Form.useForm();
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  // 推荐变量列表
  const recommendedVars = [
    { key: 'baseURL', description: '主服务地址', example: 'https://api.example.com', icon: <GlobalOutlined /> },
    { key: 'authURL', description: '认证服务地址', example: 'https://auth.example.com', icon: <GlobalOutlined /> },
    { key: 'fileURL', description: '文件服务地址', example: 'https://files.example.com', icon: <GlobalOutlined /> },
    { key: 'apiKey', description: 'API 密钥', example: 'your-api-key-here', icon: <KeyOutlined />, type: 'secret' as const },
    { key: 'authToken', description: '认证令牌', example: 'Bearer xxx', icon: <KeyOutlined />, type: 'secret' as const },
    { key: 'userId', description: '用户 ID', example: '12345', icon: <StarOutlined /> },
    { key: 'orgId', description: '组织 ID', example: 'org-xxx', icon: <StarOutlined /> },
  ];

  // 添加推荐变量
  const addRecommendedVariable = (varConfig: typeof recommendedVars[0]) => {
    if (!currentEnv) return;

    // 检查是否已存在
    const exists = currentEnv.variables.some(v => v.key === varConfig.key);
    if (exists) {
      message.warning(`变量 ${varConfig.key} 已存在`);
      return;
    }

    const newVar: EnvironmentVariable = {
      key: varConfig.key,
      value: '',
      type: varConfig.type || 'string',
      enabled: true,
    };

    addEnvironmentVariable(currentEnv.id, newVar);
    refresh();
    message.success(`已添加变量 ${varConfig.key}`);
  };

  // 刷新数据
  const refresh = useCallback(() => {
    setEnvironments(getEnvironments());
    onChange?.();
  }, [onChange]);

  // 切换当前环境
  const handleEnvChange = (envId: string) => {
    setCurrentEnvironmentId(envId);
    setCurrentEnvId(envId);
    onChange?.();
  };

  // 打开创建弹窗
  const openCreateModal = () => {
    setModalMode('create');
    setEditingEnv(null);
    form.resetFields();
    setIsModalOpen(true);
  };

  // 打开编辑弹窗
  const openEditModal = (env: Environment) => {
    setModalMode('edit');
    setEditingEnv(env);
    form.setFieldsValue({
      name: env.name,
      isDefault: env.isDefault,
    });
    setIsModalOpen(true);
  };

  // 处理弹窗确认
  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();

      if (modalMode === 'create') {
        createEnvironment(values.name, values.isDefault);
        message.success('Environment created');
      } else if (editingEnv) {
        updateEnvironment(editingEnv.id, values);
        message.success('Environment updated');
      }

      setIsModalOpen(false);
      refresh();
    } catch (error) {
      console.error('Modal error:', error);
    }
  };

  // 删除环境
  const handleDeleteEnv = (envId: string) => {
    deleteEnvironment(envId);
    if (currentEnvId === envId) {
      setCurrentEnvId(undefined);
      setCurrentEnvironment(undefined);
    }
    message.success('Environment deleted');
    refresh();
  };

  // 克隆环境
  const handleCloneEnv = (env: Environment) => {
    cloneEnvironment(env.id, `${env.name} (Copy)`);
    message.success('Environment cloned');
    refresh();
  };

  // 获取当前环境
  const currentEnv = environments.find(e => e.id === currentEnvId) || environments.find(e => e.isDefault);

  // 添加变量
  const addVariable = () => {
    if (!currentEnv) return;

    const newVar: EnvironmentVariable = {
      key: '',
      value: '',
      type: 'string',
      enabled: true,
    };

    addEnvironmentVariable(currentEnv.id, newVar);
    refresh();
  };

  // 更新变量
  const updateVariable = (index: number, field: keyof EnvironmentVariable, value: unknown) => {
    if (!currentEnv) return;

    const newVars = [...currentEnv.variables];
    newVars[index] = { ...newVars[index], [field]: value };
    setEnvironmentVariables(currentEnv.id, newVars);
    refresh();
  };

  // 删除变量
  const deleteVariable = (index: number) => {
    if (!currentEnv) return;

    const variable = currentEnv.variables[index];
    deleteEnvironmentVariable(currentEnv.id, variable.key);
    refresh();
  };

  // 切换密码显示
  const toggleSecretVisibility = (key: string) => {
    setShowSecrets(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // 环境菜单项
  const getEnvMenuItems = (env: Environment): MenuProps['items'] => [
    {
      key: 'edit',
      icon: <EditOutlined />,
      label: 'Edit',
      onClick: () => openEditModal(env),
    },
    {
      key: 'clone',
      icon: <CopyOutlined />,
      label: 'Clone',
      onClick: () => handleCloneEnv(env),
    },
    {
      type: 'divider',
    },
    {
      key: 'delete',
      icon: <DeleteOutlined />,
      label: 'Delete',
      danger: true,
      disabled: env.isDefault,
      onClick: () => handleDeleteEnv(env.id),
    },
  ];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Space style={{ marginBottom: 16, justifyContent: 'space-between', width: '100%' }}>
        <h3 style={{ margin: 0 }}>Environments</h3>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          size="small"
          onClick={openCreateModal}
        >
          New
        </Button>
      </Space>

      <Space style={{ marginBottom: 16, width: '100%' }}>
        <span>Active:</span>
        <Select
          value={currentEnvId}
          onChange={handleEnvChange}
          style={{ flex: 1 }}
          placeholder="Select environment"
        >
          {environments.map((env) => (
            <Option key={env.id} value={env.id}>
              <Space>
                {env.name}
                {env.isDefault && <Tag style={{ fontSize: '12px', padding: '0 4px' }}>Default</Tag>}
              </Space>
            </Option>
          ))}
        </Select>
        {currentEnv && (
          <Dropdown menu={{ items: getEnvMenuItems(currentEnv) }}>
            <Button icon={<SettingOutlined />} size="small" />
          </Dropdown>
        )}
      </Space>

      {currentEnv ? (
        <>
          {/* 推荐变量区域 */}
          <Card
            title={
              <Space>
                <StarOutlined style={{ color: '#faad14' }} />
                <span>推荐变量</span>
              </Space>
            }
            size="small"
            style={{ marginBottom: 16 }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {recommendedVars.map(varConfig => {
                const isAdded = currentEnv.variables.some(v => v.key === varConfig.key);
                return (
                  <Tooltip
                    key={varConfig.key}
                    title={`${varConfig.description}\n示例: ${varConfig.example}`}
                  >
                    <Tag
                      icon={varConfig.icon}
                      color={isAdded ? 'default' : 'blue'}
                      style={{
                        cursor: isAdded ? 'not-allowed' : 'pointer',
                        opacity: isAdded ? 0.5 : 1,
                      }}
                      onClick={() => !isAdded && addRecommendedVariable(varConfig)}
                    >
                      {varConfig.key}
                      {isAdded && ' ✓'}
                    </Tag>
                  </Tooltip>
                );
              })}
            </div>
            <p style={{ marginTop: 8, color: '#999', fontSize: 12 }}>
              点击快速添加常用变量，可在请求中使用 {'{{variableName}}'} 引用
            </p>
          </Card>

          <Card
            title={`Variables: ${currentEnv.name}`}
            size="small"
            style={{ flex: 1, overflow: 'auto' }}
          >
          {currentEnv.variables.map((variable, index) => {
            const isSecret = variable.type === 'secret';
            const showValue = showSecrets[variable.key] || !isSecret;

            return (
              <div
                key={variable.key || index}
                style={{
                  border: '1px solid #d9d9d9',
                  borderRadius: 6,
                  padding: 12,
                  marginBottom: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Switch
                    size="small"
                    checked={variable.enabled}
                    onChange={(checked) => updateVariable(index, 'enabled', checked)}
                    style={{ width: 40 }}
                  />
                  <Input
                    placeholder="Variable name"
                    value={variable.key}
                    onChange={(e) => updateVariable(index, 'key', e.target.value)}
                    size="small"
                    style={{ flex: 1, minWidth: 80 }}
                  />
                  <Select
                    size="small"
                    value={variable.type}
                    onChange={(value) => updateVariable(index, 'type', value)}
                    style={{ width: 90 }}
                  >
                    <Option value="string">String</Option>
                    <Option value="secret">Secret</Option>
                  </Select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Input
                    placeholder="Variable value"
                    value={showValue ? variable.value : '••••••••'}
                    onChange={(e) => updateVariable(index, 'value', e.target.value)}
                    size="small"
                    type={isSecret && !showSecrets[variable.key] ? 'password' : 'text'}
                    style={{ flex: 1, minWidth: 60 }}
                  />
                  <div style={{ width: 64, display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                    {isSecret && (
                      <Button
                        type="text"
                        size="small"
                        icon={showSecrets[variable.key] ? <EyeOutlined /> : <EyeInvisibleOutlined />}
                        onClick={() => toggleSecretVisibility(variable.key)}
                      />
                    )}
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      size="small"
                      onClick={() => deleteVariable(index)}
                    />
                  </div>
                </div>
              </div>
            );
          })}
          <Button
            type="dashed"
            block
            icon={<PlusOutlined />}
            onClick={addVariable}
            size="small"
          >
            Add Variable
          </Button>
          <p style={{ marginTop: 8, color: '#999', fontSize: 12 }}>
            Use {'{{variableName}}'} in requests to substitute values
          </p>
        </Card>
        </>
      ) : (
        <Card style={{ flex: 1, textAlign: 'center', padding: 40 }}>
          <p>No environment selected</p>
          <Button type="primary" onClick={openCreateModal}>
            Create Environment
          </Button>
        </Card>
      )}

      {/* 环境编辑弹窗 */}
      <Modal
        title={modalMode === 'create' ? 'New Environment' : 'Edit Environment'}
        open={isModalOpen}
        onOk={handleModalOk}
        onCancel={() => setIsModalOpen(false)}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="Name"
            rules={[{ required: true, message: 'Please enter a name' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="isDefault" valuePropName="checked">
            <Switch checkedChildren="Default" unCheckedChildren="Default" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
