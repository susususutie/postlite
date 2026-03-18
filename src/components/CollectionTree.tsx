import React, { useState, useCallback } from 'react';
import {
  Tree,
  Button,
  Input,
  Modal,
  Form,
  Dropdown,
  Space,
  Tooltip,
  message,
} from 'antd';
import type { MenuProps } from 'antd';
import {
  FolderOutlined,
  FileOutlined,
  PlusOutlined,
  MoreOutlined,
  EditOutlined,
  DeleteOutlined,
  ImportOutlined,
  ExportOutlined,
  FolderAddOutlined,
} from '@ant-design/icons';
import type { Collection, Folder, HttpRequest } from '../types';
import {
  getCollections,
  createCollection,
  updateCollection,
  deleteCollection,
  createFolder,
  deleteFolder,
  deleteRequest,
  importCollection,
} from '../services/collection';
import { autoImport } from '../utils/importers';
import { exportCollection, downloadFile } from '../utils/exporters';

const { DirectoryTree } = Tree;

interface TreeNode {
  title: string;
  key: string;
  icon?: React.ReactNode;
  children?: TreeNode[];
  isLeaf?: boolean;
  data?: Collection | Folder | HttpRequest;
  type: 'collection' | 'folder' | 'request';
}

interface CollectionTreeProps {
  onSelectRequest?: (request: HttpRequest, collectionId: string, folderId?: string) => void;
  onCreateRequest?: (collectionId: string, folderId?: string) => void;
  refreshKey?: number;
}

export const CollectionTree: React.FC<CollectionTreeProps> = ({
  onSelectRequest,
  onCreateRequest,
  refreshKey = 0,
}) => {
  const [collections, setCollections] = useState<Collection[]>(getCollections());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'createFolder'>('create');
  const [modalTarget, setModalTarget] = useState<{ collectionId?: string; folderId?: string }>({});
  const [form] = Form.useForm();
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importContent, setImportContent] = useState('');

  // 刷新数据
  const refresh = useCallback(() => {
    setCollections(getCollections());
  }, []);

  // 监听刷新键变化
  React.useEffect(() => {
    refresh();
  }, [refreshKey, refresh]);

  // 构建树形数据
  const buildTreeData = (collections: Collection[]): TreeNode[] => {
    return collections.map((collection) => ({
      title: collection.name,
      key: `collection-${collection.id}`,
      icon: <FolderOutlined style={{ color: '#faad14' }} />,
      type: 'collection',
      data: collection,
      children: [
        ...buildFolderTree(collection.folders, collection.id),
        ...collection.requests.map((request): TreeNode => ({
          title: request.name,
          key: `request-${collection.id}-root-${request.id}`,
          icon: <FileOutlined style={{ color: '#1890ff' }} />,
          isLeaf: true,
          type: 'request' as const,
          data: request,
        })),
      ],
    }));
  };

  // 递归处理文件夹
  const buildFolderTree = (folders: Folder[], collectionId: string): TreeNode[] => {
    return folders.map((folder): TreeNode => ({
      title: folder.name,
      key: `folder-${collectionId}-${folder.id}`,
      icon: <FolderOutlined style={{ color: '#52c41a' }} />,
      type: 'folder',
      data: folder,
      children: [
        ...buildFolderTree(folder.folders, collectionId),
        ...folder.requests.map((request): TreeNode => ({
          title: request.name,
          key: `request-${collectionId}-${folder.id}-${request.id}`,
          icon: <FileOutlined style={{ color: '#1890ff' }} />,
          isLeaf: true,
          type: 'request' as const,
          data: request,
        })),
      ],
    }));
  };

  // 处理节点选择
  const handleSelect = (selectedKeys: React.Key[], info: { node: TreeNode }) => {
    const node = info.node as TreeNode;
    if (node.type === 'request' && node.data) {
      const request = node.data as HttpRequest;
      const keyStr = selectedKeys[0] as string;
      const parts = keyStr.split('-');
      const collectionId = parts[1];
      const folderId = parts[2] === 'root' ? undefined : parts[2];
      onSelectRequest?.(request, collectionId, folderId);
    }
  };

  // 打开创建 Collection 弹窗
  const openCreateModal = () => {
    setModalMode('create');
    setModalTarget({});
    form.resetFields();
    setIsModalOpen(true);
  };

  // 打开编辑弹窗
  const openEditModal = (collection: Collection) => {
    setModalMode('edit');
    setModalTarget({ collectionId: collection.id });
    form.setFieldsValue({ name: collection.name, description: collection.description });
    setIsModalOpen(true);
  };

  // 打开创建 Folder 弹窗
  const openCreateFolderModal = (collectionId: string, folderId?: string) => {
    setModalMode('createFolder');
    setModalTarget({ collectionId, folderId });
    form.resetFields();
    setIsModalOpen(true);
  };

  // 处理弹窗确认
  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();

      if (modalMode === 'create') {
        createCollection(values.name, values.description);
        message.success('Collection created');
      } else if (modalMode === 'edit' && modalTarget.collectionId) {
        updateCollection(modalTarget.collectionId, values);
        message.success('Collection updated');
      } else if (modalMode === 'createFolder' && modalTarget.collectionId) {
        createFolder(modalTarget.collectionId, values.name, modalTarget.folderId);
        message.success('Folder created');
      }

      setIsModalOpen(false);
      refresh();
    } catch {
      // Modal validation error - no action needed
    }
  };

  // 处理删除
  const handleDelete = (type: 'collection' | 'folder', collectionId: string, folderId?: string) => {
    if (type === 'collection') {
      deleteCollection(collectionId);
      message.success('Collection deleted');
    } else if (folderId) {
      deleteFolder(collectionId, folderId);
      message.success('Folder deleted');
    }
    refresh();
  };

  // 处理导入
  const handleImport = () => {
    try {
      const collection = autoImport(importContent);
      if (collection) {
        importCollection(collection);
        message.success('Collection imported successfully');
        setIsImportModalOpen(false);
        setImportContent('');
        refresh();
      } else {
        message.error('Failed to import: Invalid format');
      }
    } catch {
      message.error('Failed to import: Invalid JSON');
    }
  };

  // 处理导出
  const handleExport = (collection: Collection) => {
    const content = exportCollection(collection, 'postman');
    downloadFile(content, `${collection.name}.postman_collection.json`);
    message.success('Collection exported');
  };

  // 获取节点菜单
  const getNodeMenuItems = (node: TreeNode): MenuProps['items'] => {
    if (node.type === 'collection') {
      const collection = node.data as Collection;
      return [
        {
          key: 'addRequest',
          icon: <PlusOutlined />,
          label: 'Add Request',
          onClick: () => onCreateRequest?.(collection.id),
        },
        {
          key: 'addFolder',
          icon: <FolderAddOutlined />,
          label: 'Add Folder',
          onClick: () => openCreateFolderModal(collection.id),
        },
        {
          key: 'edit',
          icon: <EditOutlined />,
          label: 'Edit',
          onClick: () => openEditModal(collection),
        },
        {
          key: 'export',
          icon: <ExportOutlined />,
          label: 'Export',
          onClick: () => handleExport(collection),
        },
        {
          type: 'divider',
        },
        {
          key: 'delete',
          icon: <DeleteOutlined />,
          label: 'Delete',
          danger: true,
          onClick: () => handleDelete('collection', collection.id),
        },
      ];
    } else if (node.type === 'folder') {
      const keyParts = node.key.split('-');
      const collectionId = keyParts[1];
      const folderId = keyParts[2];
      return [
        {
          key: 'addRequest',
          icon: <PlusOutlined />,
          label: 'Add Request',
          onClick: () => onCreateRequest?.(collectionId, folderId),
        },
        {
          key: 'addFolder',
          icon: <FolderAddOutlined />,
          label: 'Add Subfolder',
          onClick: () => openCreateFolderModal(collectionId, folderId),
        },
        {
          type: 'divider',
        },
        {
          key: 'delete',
          icon: <DeleteOutlined />,
          label: 'Delete',
          danger: true,
          onClick: () => handleDelete('folder', collectionId, folderId),
        },
      ];
    } else if (node.type === 'request') {
      const keyParts = node.key.split('-');
      const collectionId = keyParts[1];
      const folderId = keyParts[2] === 'root' ? undefined : keyParts[2];
      const requestId = keyParts[keyParts.length - 1];

      return [
        {
          key: 'delete',
          icon: <DeleteOutlined />,
          label: 'Delete',
          danger: true,
          onClick: () => {
            deleteRequest(collectionId, requestId, folderId);
            message.success('Request deleted');
            refresh();
          },
        },
      ];
    }
    return [];
  };

  // 自定义标题渲染
  const titleRender = (nodeData: TreeNode) => {
    return (
      <Dropdown
        menu={{ items: getNodeMenuItems(nodeData) }}
        trigger={['contextMenu']}
      >
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <span>{nodeData.title}</span>
          <Dropdown
            menu={{ items: getNodeMenuItems(nodeData) }}
            trigger={['click']}
          >
            <Button
              type="text"
              size="small"
              icon={<MoreOutlined />}
              onClick={(e) => e.stopPropagation()}
            />
          </Dropdown>
        </Space>
      </Dropdown>
    );
  };

  const treeData = buildTreeData(collections);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Space style={{ marginBottom: 16, justifyContent: 'space-between', width: '100%' }}>
        <h3 style={{ margin: 0 }}>Collections</h3>
        <Space>
          <Tooltip title="Import">
            <Button
              icon={<ImportOutlined />}
              size="small"
              onClick={() => setIsImportModalOpen(true)}
            />
          </Tooltip>
          <Tooltip title="New Collection">
            <Button
              type="primary"
              icon={<PlusOutlined />}
              size="small"
              onClick={openCreateModal}
            />
          </Tooltip>
        </Space>
      </Space>

      <DirectoryTree
        treeData={treeData}
        onSelect={handleSelect}
        titleRender={titleRender}
        style={{ flex: 1, overflow: 'auto' }}
        showIcon
        blockNode
      />

      {/* Collection 编辑弹窗 */}
      <Modal
        title={modalMode === 'create' ? 'New Collection' : modalMode === 'edit' ? 'Edit Collection' : 'New Folder'}
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
          {modalMode !== 'createFolder' && (
            <Form.Item name="description" label="Description">
              <Input.TextArea rows={3} />
            </Form.Item>
          )}
        </Form>
      </Modal>

      {/* 导入弹窗 */}
      <Modal
        title="Import Collection"
        open={isImportModalOpen}
        onOk={handleImport}
        onCancel={() => {
          setIsImportModalOpen(false);
          setImportContent('');
        }}
        width={600}
      >
        <Input.TextArea
          value={importContent}
          onChange={(e) => setImportContent(e.target.value)}
          placeholder="Paste Postman, Swagger, or YApi collection JSON here..."
          rows={10}
        />
        <p style={{ marginTop: 8, color: '#999', fontSize: 12 }}>
          Supports: Postman Collection v2.1, Swagger/OpenAPI 2.0/3.0, YApi
        </p>
      </Modal>
    </div>
  );
};
