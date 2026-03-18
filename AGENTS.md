# Postlite - AGENTS.md

## 项目概述

**Postlite** 是一个受 Postman 启发的轻量级 API 测试工具，采用 React + TypeScript + Vite 构建。

### 核心技术栈

- **前端框架**: React 19 + TypeScript 5.9
- **构建工具**: Vite 8
- **UI 组件库**: Ant Design 6
- **HTTP 客户端**: Axios
- **测试框架**: Vitest + @testing-library/react
- **数据存储**: LocalStorage (浏览器本地存储)
- **CLI 服务器**: Node.js 内置 http 模块

### 架构特点

- **单页应用 (SPA)**: 客户端路由，Service Worker 支持
- **模块化设计**: 清晰的分层架构 (components / services / store / utils / types)
- **类型安全**: 完整的 TypeScript 类型定义
- **测试覆盖**: 387+ 单元测试，覆盖核心功能

---

## 项目结构

```
/root/postlite/
├── bin/postlite.js              # CLI 启动脚本 (Node.js HTTP 服务器)
├── src/
│   ├── App.tsx                  # 主应用组件 (三栏布局)
│   ├── components/              # React 组件
│   │   ├── CollectionTree.tsx   # 左侧集合树形组件
│   │   ├── RequestBuilder.tsx   # 中间请求构建器
│   │   ├── EnvironmentManager.tsx # 右侧环境管理器
│   │   └── JsonEditor.tsx       # JSON 编辑器组件
│   ├── services/                # 业务逻辑服务层
│   │   ├── collection.ts        # Collection CRUD 操作
│   │   ├── environment.ts       # 环境变量管理
│   │   └── http.ts              # HTTP 请求发送
│   ├── store/                   # 数据持久化层
│   │   └── storage.ts           # LocalStorage 操作
│   ├── utils/                   # 工具函数
│   │   ├── environment.ts       # 环境变量替换逻辑
│   │   ├── importers.ts         # 导入 (Postman/Swagger/YApi)
│   │   └── exporters.ts         # 导出功能
│   ├── types/                   # TypeScript 类型定义
│   │   └── index.ts             # 核心类型 (Request/Response/Collection)
│   └── test/                    # 测试配置和工厂函数
│       ├── setup.ts             # Vitest 测试配置
│       └── factories.ts         # 测试数据工厂
├── public/sw.js                 # Service Worker (离线支持)
├── vite.config.ts               # Vite 配置
├── vitest.config.ts             # Vitest 测试配置
└── package.json                 # 项目依赖和脚本
```

---

## 开发命令

```bash
# 开发服务器 (端口 5173)
npm run dev

# 构建生产版本 (输出到 dist/)
npm run build

# 预览生产构建
npm run preview

# 运行测试 ( watch 模式)
npm run test

# 运行测试 (单次)
npm run test:run

# 测试覆盖率报告
npm run test:coverage

# 测试 UI 界面
npm run test:ui

# ESLint 代码检查
npm run lint
```

---

## CLI 使用方法

Postlite 可以作为全局 CLI 工具使用：

```bash
# 本地开发模式启动
node bin/postlite.js [port]

# 通过 npx 使用 (需先构建)
npx postlite [port]

# 默认端口 3456
npx postlite

# 指定端口
npx postlite 8080
```

**注意**: 使用 CLI 前必须先运行 `npm run build` 生成 `dist/` 目录。

---

## 核心功能模块

### 1. Collection 管理
- 创建/编辑/删除 Collection
- 支持嵌套 Folder 结构
- 请求可以在 Collection 和 Folder 间移动
- 支持从 Postman、Swagger/OpenAPI、YApi 导入

### 2. 请求构建器
- 支持 HTTP 方法: GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS
- Headers 和 Query 参数管理 (支持启用/禁用)
- Body 支持: none, JSON, text, x-www-form-urlencoded
- 环境变量替换 ({{variableName}} 语法)

### 3. 环境管理
- 多环境配置 (开发、测试、生产等)
- 环境变量支持字符串和密钥类型
- 当前环境变量自动应用到请求中

### 4. 数据持久化
- 所有数据存储在浏览器 LocalStorage
- 支持导出/导入完整数据 (JSON 格式)
- 历史记录保存最近 100 条

---

## 开发约定

### 代码风格
- **TypeScript**: 严格类型检查，避免使用 `any`
- **组件**: 使用函数组件 + React Hooks
- **样式**: 使用 Ant Design 组件 + 内联样式 (style prop)
- **图标**: 使用 @ant-design/icons

### 测试规范
- **测试文件**: 与源码文件同级，命名 `[name].test.ts`
- **测试工具**: Vitest + @testing-library/react + jsdom
- **覆盖率**: 核心服务层要求 100% 覆盖
- **Mock**: LocalStorage 和 Axios 在测试中已配置 mock

### 命名规范
- **组件**: PascalCase (如 `RequestBuilder.tsx`)
- **工具函数**: camelCase (如 `sendRequest`)
- **类型/接口**: PascalCase (如 `HttpRequest`)
- **常量**: SCREAMING_SNAKE_CASE (如 `STORAGE_KEYS`)

---

## 关键类型定义

```typescript
// 核心请求类型
interface HttpRequest {
  id: string;
  name: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
  url: string;
  headers: { key: string; value: string; enabled: boolean }[];
  params: { key: string; value: string; enabled: boolean }[];
  body?: { mode: 'none' | 'json' | 'text' | 'formdata' | 'urlencoded'; content?: string };
}

// 集合类型
interface Collection {
  id: string;
  name: string;
  description?: string;
  folders: Folder[];
  requests: HttpRequest[];
  createdAt: number;
  updatedAt: number;
}

// 环境类型
interface Environment {
  id: string;
  name: string;
  variables: { key: string; value: string; type: 'string' | 'secret'; enabled: boolean }[];
  isDefault?: boolean;
}
```

---

## 扩展开发指南

### 添加新的导入格式
1. 在 `src/types/index.ts` 中定义格式类型
2. 在 `src/utils/importers.ts` 中添加解析逻辑
3. 更新 `CollectionTree` 组件的导入菜单

### 添加新的 HTTP 功能
1. 在 `src/services/http.ts` 中实现请求逻辑
2. 更新 `HttpRequest` 类型以支持新选项
3. 在 `RequestBuilder` 组件中添加 UI 控件

### 添加新的存储后端
1. 实现与 `src/store/storage.ts` 相同的接口
2. 通过依赖注入替换存储层

---

## 注意事项

1. **浏览器限制**: 由于使用 LocalStorage，数据有 5MB 大小限制
2. **CORS**: 实际 API 请求受浏览器 CORS 策略限制
3. **Service Worker**: 开发模式下可能缓存静态资源，需要手动清除
4. **环境变量**: 密钥类型变量在 UI 中显示为掩码，但仍以明文存储

---

## 相关文件索引

| 功能领域 | 关键文件 |
|---------|---------|
| 入口 | `src/main.tsx`, `index.html` |
| 主布局 | `src/App.tsx` |
| 请求逻辑 | `src/services/http.ts` |
| 集合管理 | `src/services/collection.ts` |
| 环境管理 | `src/services/environment.ts` |
| 存储层 | `src/store/storage.ts` |
| 类型定义 | `src/types/index.ts` |
| 导入导出 | `src/utils/importers.ts`, `src/utils/exporters.ts` |
| 测试配置 | `vitest.config.ts`, `src/test/setup.ts` |
| CLI 脚本 | `bin/postlite.js` |
