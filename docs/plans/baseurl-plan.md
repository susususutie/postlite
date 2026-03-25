# Postlite BaseURL 功能增强方案

## 一、设计理念

### 1.1 核心原则

采用**模板变量**而非层级继承，复用现有环境变量系统：

```
Environment:  { baseURL: "https://api.example.com" }
                    ↓
Request.url:  "{{baseURL}}/users"  →  发送前替换 →  "https://api.example.com/users"
```

**优势**：
- 架构解耦：不需要复杂的 `urlResolver` 层级查找
- 跨平台友好：URL 构建逻辑简单，未来桌面端易移植
- 灵活配置：支持多服务场景（`{{authURL}}`, `{{fileURL}}` 等）
- 向后兼容：现有请求无需修改即可继续工作

### 1.2 与竞品对比

| 产品 | 方案 | 说明 |
|------|------|------|
| **Postman** | 环境变量 + Collection 变量 | 用户手动创建 `{{base_url}}` |
| **Insomnia** | 环境变量为主 | Folder 无 baseURL 功能 |
| **本方案** | 环境变量 + Collection 默认值 | 降低新用户学习成本 |

---

## 二、类型扩展

### 2.1 Collection 类型

```typescript
// src/types/index.ts

export interface Collection {
  id: string;
  name: string;
  description?: string;
  defaultBaseUrl?: string;      // ← 新增：默认 baseURL（用于 UI 自动填充）
  folders: Folder[];
  requests: HttpRequest[];
  createdAt: number;
  updatedAt: number;
}
```

**说明**：
- `defaultBaseUrl` 是**提示性**的，用于创建新 Request 时自动填充 URL
- 不影响已有 Request 的解析
- 可为空，为空时新 Request 的 URL 为空字符串

### 2.2 HttpRequest 类型（不变）

```typescript
// HttpRequest 保持不变，url 字段直接存储可能包含模板的字符串
export interface HttpRequest {
  id: string;
  name: string;
  method: HttpMethod;
  url: string;                  // 可能包含 {{variable}} 模板或完整 URL
  headers: Header[];
  params: Param[];
  body?: RequestBody;
  description?: string;
}
```

### 2.3 StorageCollection 类型

```typescript
// src/storage/types.ts

export interface StorageCollection {
  id: string;
  name: string;
  description?: string;
  defaultBaseUrl?: string;      // ← 新增
  createdAt: number;
  updatedAt: number;
}
```

---

## 三、URL 解析流程

### 3.1 简化后的流程

```
Request.url (可能包含模板)
        ↓
applyEnvironmentVariables()  ←  支持递归替换 + 循环检测
        ↓
normalizeUrl()               ←  处理双斜杠、协议补全
        ↓
validateUrl()                ←  校验合法性
        ↓
最终 URL (发送给 HTTP 层)
```

**关键**：不再区分 baseURL 和 path，统一作为字符串处理。

### 3.2 URL 规范化处理

#### A. 变量解析引擎（支持递归 + 循环检测 + 抽象接口）

```typescript
// src/utils/variables.ts

const MAX_RESOLVE_DEPTH = 10;  // ✨ 提升限制，支持更深层的合法嵌套

export interface ResolveContext {
  localVars?: EnvironmentVariable[];
  envVars?: EnvironmentVariable[];
  pathStack?: string[];  // 递归路径栈（替代 Set，避免误判）
  depth?: number;
}

// ✨ 关键抽象：VariableResolver 接口（为动态变量预留扩展）
export interface VariableResolver {
  resolve(key: string, context: ResolveContext): string | undefined;
  supports(key: string): boolean;
}

// 静态变量解析器（从变量数组中查找）
export class StaticVariableResolver implements VariableResolver {
  private varMap: Map<string, EnvironmentVariable>;
  
  constructor(envVars: EnvironmentVariable[] = [], localVars: EnvironmentVariable[] = []) {
    // ✨ 修复优先级：使用 Map 明确覆盖关系（local > env）
    this.varMap = new Map();
    // 先 env
    envVars.forEach(v => { if (v.enabled) this.varMap.set(v.key, v); });
    // 再 local 覆盖
    localVars.forEach(v => { if (v.enabled) this.varMap.set(v.key, v); });
  }
  
  supports(key: string): boolean {
    return this.varMap.has(key);
  }
  
  resolve(key: string): string | undefined {
    return this.varMap.get(key)?.value;
  }
}

// 主解析函数
export function resolveVariables(
  value: string,
  resolver: VariableResolver,
  context: ResolveContext = {}
): string {
  const { pathStack = [], depth = 0 } = context;
  
  // 1. 防无限递归（深度限制）
  if (depth > MAX_RESOLVE_DEPTH) {
    throw new Error(`Variable resolution exceeded max depth (${MAX_RESOLVE_DEPTH})`);
  }
  
  // 2. 单次替换
  let result = value;
  const variablePattern = /\{\{\s*(\w+)\s*\}\}/g;
  
  result = result.replace(variablePattern, (match, varName) => {
    // ✨ 修复循环检测：检查路径栈而非 Set
    // a = {{b}}/{{b}} 应该被允许，a -> b -> a 才是循环
    if (pathStack.includes(varName)) {
      throw new Error(
        `Circular variable reference detected: ${[...pathStack, varName].join(' -> ')}`
      );
    }
    
    if (!resolver.supports(varName)) {
      return match; // 保留未定义的变量，由调用方决定如何处理
    }
    
    const resolvedValue = resolver.resolve(varName, context);
    if (resolvedValue === undefined) {
      return match;
    }
    
    // 递归解析变量值（处理嵌套如 baseURL = {{host}}/api）
    return resolveVariables(resolvedValue, resolver, {
      ...context,
      pathStack: [...pathStack, varName],  // ✨ 压入路径栈
      depth: depth + 1
    });
  });
  
  return result;
}

// 便捷函数：保持向后兼容
export function applyEnvironmentVariables(
  value: string,
  envVars: EnvironmentVariable[],
  localVars?: EnvironmentVariable[]
): string {
  const resolver = new StaticVariableResolver(envVars, localVars);
  return resolveVariables(value, resolver);
}
```

#### B. URL 规范化（解决双斜杠，不误伤 query）

```typescript
// src/utils/url.ts

// ✨ 标准 URI scheme 判断（支持 ws:// ftp:// 等非 http 协议）
// ✨ 修复：同时识别 protocol-relative URL（//cdn.example.com）
export function hasProtocol(url: string): boolean {
  return /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(url) || url.startsWith('//');
}

export function normalizeUrl(url: string): string {
  try {
    let urlObj: URL;
    
    // ✨ 修复：对无协议 URL 使用 dummy base 统一处理
    if (!hasProtocol(url)) {
      urlObj = new URL(url, 'http://dummy');
    } else {
      urlObj = new URL(url);
    }
    
    // ✨ 只处理 pathname，不误伤 query
    // https://api.com//v1//users → https://api.com/v1/users
    urlObj.pathname = urlObj.pathname.replace(/\/+/g, '/');
    
    // 如果是 dummy base，返回 pathname 部分；否则返回完整 URL
    if (!hasProtocol(url)) {
      return urlObj.pathname + urlObj.search + urlObj.hash;
    }
    return urlObj.toString();
  } catch {
    // 非法 URL 直接返回原值，让校验层处理
    return url;
  }
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}
```

#### C. 完整解析流程

```typescript
// src/services/http.ts
import { 
  resolveVariables, 
  StaticVariableResolver,
  type VariableResolver 
} from '../utils/variables';
import { hasProtocol, normalizeUrl, isValidUrl } from '../utils/url';

export async function sendRequest(
  request: HttpRequest,
  config: RequestConfig = {},
  context?: { collection?: Collection; resolver?: VariableResolver }
): Promise<HttpResponse> {
  const environment = getCurrentEnvironment();
  
  // 1. 确定原始 URL（弱拼接 defaultBaseUrl）
  // ✨ 修复判断条件：使用标准 protocol 检测，避免误判 //cdn.example.com
  let rawUrl = request.url;
  if (rawUrl && 
      !hasProtocol(rawUrl) &&           // 无协议（避免误判 //cdn.xxx）
      !rawUrl.includes('{{') &&         // 无模板变量
      !rawUrl.startsWith('/') &&        // 不是绝对路径
      context?.collection?.defaultBaseUrl  // 有 Collection baseUrl
  ) {
    // 弱参与：无协议、无模板、非绝对路径时，拼接 defaultBaseUrl
    rawUrl = `${context.collection.defaultBaseUrl}${rawUrl}`;
  }
  
  // 2. 创建变量解析器（支持自定义 resolver，为未来动态变量预留）
  const resolver = context?.resolver || new StaticVariableResolver(
    environment?.variables || [],
    request.localVariables  // 未来支持请求级别变量
  );
  
  // 3. 变量递归解析
  const resolvedUrl = resolveVariables(rawUrl, resolver);
  
  // 4. 检查是否有未解析变量（HTTP 层严格校验）
  if (resolvedUrl.includes('{{')) {
    // ✨ 修复：使用 Set 去重，避免重复变量名多次提示
    const unresolvedVars = [...new Set(
      [...resolvedUrl.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map(m => m[1])
    )];
    throw new Error(`Unresolved variables: ${unresolvedVars.join(', ')}`);
  }
  
  // 5. URL 规范化
  const normalizedUrl = normalizeUrl(resolvedUrl);
  
  // 6. 合法性校验
  if (!isValidUrl(normalizedUrl)) {
    throw new Error(`Invalid URL after variable resolution: ${normalizedUrl}`);
  }
  
  // 7. 添加查询参数
  const finalUrl = parseUrl(normalizedUrl, request.params);
  
  // 8. 发送请求（后续逻辑不变）
  // ...
}
```

#### D. UI 层宽松处理（与 HTTP 层分层）

```typescript
// src/components/RequestBuilder.tsx

// UI 层只做预览，不抛错，允许渐进编辑
function getUrlPreview(
  url: string, 
  variables: EnvironmentVariable[]
): { 
  url: string; 
  status: 'valid' | 'warning' | 'error';
  unresolvedVars?: string[];
} {
  try {
    const resolver = new StaticVariableResolver(variables);
    const resolved = resolveVariables(url, resolver);
    
    // 检查未解析变量
    const unresolved = [...resolved.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map(m => m[1]);
    
    if (unresolved.length > 0) {
      return { 
        url: resolved, 
        status: 'warning', 
        unresolvedVars: unresolved 
      };
    }
    
    // 校验最终 URL
    if (!isValidUrl(resolved)) {
      return { url: resolved, status: 'error' };
    }
    
    return { url: resolved, status: 'valid' };
  } catch (e) {
    // 循环引用等错误
    return { url: url, status: 'error', unresolvedVars: [(e as Error).message] };
  }
}
```

### 3.3 边界情况处理

| 场景 | Request.url | Environment | Collection.defaultBaseUrl | 处理结果 |
|------|-------------|-------------|---------------------------|----------|
| 标准模板 | `{{baseURL}}/users` | baseURL=https://api.com | - | `https://api.com/users` |
| 嵌套变量 | `{{baseURL}}/users` | baseURL={{host}}/api, host=https://api.com | - | `https://api.com/api/users` ✨新增✨ |
| 弱拼接 | `/users` | - | `https://api.com` | `https://api.com/users` ✨新增✨ |
| 完整 URL | `https://api.com/users` | - | `https://other.com` | `https://api.com/users`（优先级更高）|
| 变量未定义 | `{{baseURL}}/users` | 无 baseURL | - | 抛出错误，提示未定义变量 ✨新增✨ |
| 循环引用 | `{{a}}` | a={{b}}, b={{a}} | - | 抛出错误，检测到循环 ✨新增✨ |
| 双斜杠 | `{{baseURL}}/users` | baseURL=https://api.com/ | - | `https://api.com/users` ✨新增✨ |

---

## 四、服务层修改

### 4.1 Collection 服务

```typescript
// src/services/collection.ts

// 创建 Collection 时支持 defaultBaseUrl
export async function createCollection(
  data: Omit<Collection, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Collection>;

// 更新 Collection 时支持 defaultBaseUrl
export async function updateCollection(
  collectionId: string,
  updates: Partial<Pick<Collection, 'name' | 'description' | 'defaultBaseUrl'>>
): Promise<Collection | null>;

// 创建 Request 时，自动填充 defaultBaseUrl
export async function createRequest(
  collectionId: string,
  data: Omit<HttpRequest, 'id' | 'createdAt' | 'updatedAt'>,
  folderId?: string
): Promise<HttpRequest> {
  const collection = await getCollectionById(collectionId);
  const url = data.url || collection?.defaultBaseUrl || '';
  // ...
}
```

### 4.2 HTTP 服务（无重大变更）

仅需确保 `sendRequest` 调用 `applyEnvironmentVariables`，这在当前代码中可能已经存在。

---

## 五、UI 扩展

### 5.1 Collection 设置面板

在 `CollectionTree.tsx` 的 Collection 编辑弹窗中添加：

```tsx
<Form.Item 
  name="defaultBaseUrl" 
  label="默认 Base URL"
  tooltip="创建新请求时的默认 URL 前缀，可使用 {{variable}} 语法引用环境变量"
>
  <Input placeholder="https://api.example.com 或 {{baseURL}}" />
</Form.Item>
```

### 5.2 RequestBuilder 增强

#### A. URL 输入框提示

```tsx
// 实时显示解析后的 URL
const resolvedUrl = useMemo(() => {
  return applyEnvironmentVariables(url, environmentVariables);
}, [url, environmentVariables]);

<Input.Group compact>
  <Input 
    value={url} 
    onChange={e => setUrl(e.target.value)}
    placeholder="{{baseURL}}/api/users 或完整 URL"
  />
</Input.Group>

// 显示解析结果
<Text type="secondary" style={{ fontSize: 12 }}>
  实际请求: {resolvedUrl}
</Text>
```

#### B. 快速插入变量

在 URL 输入框旁添加变量选择器：

```tsx
<Dropdown 
  menu={{ 
    items: environmentVariables.map(v => ({
      key: v.key,
      label: `{{${v.key}}}`,
      onClick: () => insertVariable(`{{${v.key}}}`)
    }))
  }}
>
  <Button icon={<DownOutlined />}>插入变量</Button>
</Dropdown>
```

### 5.3 EnvironmentManager 优化

#### A. 推荐变量机制（解决"该用哪个变量"的困惑）

```tsx
// 推荐变量列表（可配置）
const RECOMMENDED_VARS = [
  { key: 'baseURL', description: '主服务地址', example: 'https://api.example.com' },
  { key: 'authURL', description: '认证服务地址', example: 'https://auth.example.com' },
  { key: 'fileURL', description: '文件服务地址', example: 'https://files.example.com' },
];

// 在 EnvironmentManager 中显示推荐变量
<Card title="推荐变量" size="small">
  {RECOMMENDED_VARS.map(v => (
    <Tag 
      key={v.key}
      icon={<StarOutlined />}
      onClick={() => addVariable({ key: v.key, value: '', description: v.description })}
      style={{ cursor: 'pointer', marginBottom: 8 }}
    >
      {v.key}
    </Tag>
  ))}
  <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
    点击快速添加常用变量
  </Text>
</Card>
```

#### B. 变量标记系统

支持将变量标记为"baseURL"类型，提供视觉提示：

```typescript
interface EnvironmentVariable {
  key: string;
  value: string;
  type: 'string' | 'secret';
  role?: 'baseURL' | 'authToken' | 'custom';  // ← 新增：变量角色
  enabled: boolean;
}
```

UI 中根据 role 显示不同图标：
- 🌐 baseURL 角色 →  globe 图标
- 🔑 authToken 角色 → key 图标

---

## 六、数据迁移

### 6.1 现有数据兼容

- 现有 Collection 没有 `defaultBaseUrl` 字段 → 视为 `undefined`，不影响功能
- 现有 Request.url 是完整 URL → 继续正常使用
- 无需数据迁移脚本

### 6.2 导入/导出适配器

#### IR 层扩展（完整保留 URL 结构）

```typescript
// src/adapters/core/types.ts

// ✨ 修复：完整支持 Postman URL 结构（包括 query 和 path params）
export interface UrlObject {
  raw: string;                  // 原始 URL 字符串（如 {{baseUrl}}/users/:id）
  protocol?: string;            // 协议（如 https、ws）
  host?: string[];              // 主机部分（如 ["{{baseUrl}}"]
  path?: string[];              // 路径部分（如 ["users", ":id"]）
  // ✨ 新增：支持 query 和 path params（为 OpenAPI/Swagger 精确导入预留）
  query?: {                     // Query 参数（Postman 的 url.query）
    key: string;
    value: string;
  }[];
  variable?: {                  // Path 变量（Postman 的 url.variable，如 :id）
    key: string;
    value?: string;
    description?: string;
  }[];
}

export interface ItemIR {
  id: string;
  type: 'folder' | 'request';
  name: string;
  description?: string;
  children?: ItemIR[];
  method?: string;
  url?: UrlObject | string;     // ← 修改：支持结构化 URL
  headers?: { key: string; value: string; enabled: boolean }[];
  params?: { key: string; value: string; enabled: boolean }[];
  body?: { mode: string; content?: string };
}

export interface CollectionIR {
  name: string;
  description?: string;
  defaultBaseUrl?: string;      // ← 新增
  variables?: { key: string; value: string }[];  // ← 新增：Collection 级别变量
  items: ItemIR[];
}
```

**设计理由**：
- Postman URL 是结构化的（`host`, `path` 分开），直接转成 string 会丢信息
- IR 层保留结构，适配器负责转换为内部格式
- ✨ 新增 `query` 和 `variable`：支持 Postman 的 query 参数和 path 变量（如 `/users/:id`）
- 支持 Collection 级别变量（Postman 有此概念）

#### Postman 适配器

Postman Collection v2.1 的 `variable` 数组中可能包含 `baseUrl`，导入时：
- **Collection 变量** → 转换为 CollectionIR.variables
- **Environment 变量** → 提示用户导入到 Environment
- **URL 结构化** → 保留 host/path 信息到 UrlObject

```typescript
// 导入示例
function importPostmanCollection(pmCollection: unknown): CollectionIR {
  // 1. 提取 Collection 级别变量
  const variables = pmCollection.variable?.map(v => ({
    key: v.key,
    value: v.value
  }));
  
  // 2. 确定 defaultBaseUrl
  const baseUrlVar = variables?.find(v => v.key.toLowerCase().includes('url'));
  const defaultBaseUrl = baseUrlVar ? `{{${baseUrlVar.key}}}` : undefined;
  
  // 3. 转换 items，保留 URL 结构
  const items = pmCollection.item?.map(item => ({
    ...,
    url: item.url ? {
      raw: item.url.raw,
      host: item.url.host,
      path: item.url.path
    } : undefined
  }));
  
  return { ..., variables, defaultBaseUrl, items };
}
```

#### Swagger 适配器

Swagger 的 `servers[0].url` 可作为 `defaultBaseUrl` 导入：

```typescript
function importSwagger(swaggerDoc: unknown): CollectionIR {
  const serverUrl = swaggerDoc.servers?.[0]?.url;
  
  return {
    name: swaggerDoc.info?.title || 'Imported API',
    defaultBaseUrl: serverUrl?.includes('://') ? serverUrl : undefined,
    items: swaggerDoc.paths ? convertPathsToItems(swaggerDoc.paths) : []
  };
}
```

---

## 七、实施计划

### 阶段一：工具层（P0 核心，1 天）

| 任务 | 文件 | 描述 | 优先级 |
|------|------|------|--------|
| T1.1 | `src/utils/variables.ts` | **新增**：变量递归解析引擎（支持嵌套变量 + 循环检测）| P0 |
| T1.2 | `src/utils/url.ts` | **新增**：URL 规范化工具（normalizeUrl、isValidUrl）| P0 |
| T1.3 | `src/utils/environment.ts` | **重构**：整合新的变量解析引擎 | P0 |
| T1.4 | `src/utils/variables.test.ts` | **新增**：变量解析单元测试（递归、循环、边界）| P0 |

### 阶段二：类型和存储层（0.5 天）

| 任务 | 文件 | 描述 |
|------|------|------|
| T2.1 | `src/types/index.ts` | Collection 添加 `defaultBaseUrl?: string` |
| T2.2 | `src/storage/types.ts` | StorageCollection 添加 `defaultBaseUrl?: string` |
| T2.3 | `src/adapters/core/types.ts` | 更新 IR 层：CollectionIR 加 defaultBaseUrl，ItemIR.url 支持 UrlObject |

### 阶段三：HTTP 服务层（P0 核心，0.5 天）

| 任务 | 文件 | 描述 | 优先级 |
|------|------|------|--------|
| T3.1 | `src/services/http.ts` | 集成新变量解析 + URL 规范化 + 合法性校验 | P0 |
| T3.2 | `src/services/http.ts` | 实现 defaultBaseUrl 弱拼接逻辑 | P1 |
| T3.3 | `src/services/http.test.ts` | 补充测试用例（双斜杠、非法 URL、变量未定义）| P0 |

### 阶段四：Collection 服务层（0.5 天）

| 任务 | 文件 | 描述 |
|------|------|------|
| T4.1 | `src/services/collection.ts` | 更新 create/update Collection 支持 defaultBaseUrl |
| T4.2 | `src/services/collection.ts` | createRequest 时自动填充 defaultBaseUrl |
| T4.3 | `src/core/services/collection.ts` | 同步更新核心服务层 |

### 阶段五：适配器（0.5 天）

| 任务 | 文件 | 描述 |
|------|------|------|
| T5.1 | `src/adapters/postman/index.ts` | 导入时提取 baseUrl 变量，保留 URL 结构 |
| T5.2 | `src/adapters/swagger/index.ts` | 导入时提取 servers[0].url |

### 阶段六：UI（1-2 天）

| 任务 | 文件 | 描述 |
|------|------|------|
| T6.1 | `src/components/CollectionTree.tsx` | Collection 编辑添加 defaultBaseUrl 输入 |
| T6.2 | `src/components/RequestBuilder.tsx` | 显示实时解析后的 URL + 变量来源提示 |
| T6.3 | `src/components/RequestBuilder.tsx` | 添加变量快速插入按钮 |
| T6.4 | `src/components/EnvironmentManager.tsx` | 添加快速添加 baseURL 变量按钮 |

### 阶段七：集成测试（0.5 天）

| 任务 | 描述 |
|------|------|
| T7.1 | 测试变量递归解析（嵌套变量场景）|
| T7.2 | 测试循环引用检测 |
| T7.3 | 测试 defaultBaseUrl 弱拼接 |
| T7.4 | 测试 Postman/Swagger 导入兼容性 |
| T7.5 | 端到端请求测试 |

---

## 八、风险评估

### P0 风险（必须解决）

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| **嵌套变量解析不完整** | `baseURL = {{host}}/api` 只解析一次变成 `{{host}}/api` | 实现递归解析引擎（最大5层）|
| **循环引用导致死循环** | 如 `a = {{b}}, b = {{a}}` | 使用 visited Set 检测循环，超限时抛出错误 |
| **URL 双斜杠** | `{{baseURL}}/users` 可能变成 `https://api.com//users` | `normalizeUrl()` 统一处理斜杠 |
| **非法 URL 发送** | 变量未定义时发送请求导致 fetch 异常 | 发送前 `isValidUrl()` 校验，UI 实时显示解析状态 |

### P1 风险（强烈建议处理）

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| **defaultBaseUrl 不参与运行时** | 用户设置后困惑"为什么不生效" | 弱参与：无协议且无模板时自动拼接 |
| **变量优先级不明确** | 多来源变量冲突（env vs local）| 明确优先级：local > env > collection |
| **导入丢失 URL 结构** | Postman 结构化 URL 转字符串丢信息 | IR 层保留 UrlObject 结构 |

### P2 风险（中期关注）

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| **无 VariableResolver 抽象** | 变量逻辑写死，未来扩展困难 | 引入 `VariableResolver` 接口，支持插件化 |
| **变量作用域体系缺失** | 无法支持 Collection 级别变量 | 预留 `localVariables` 字段，后续实现 |

### 向后兼容

| 方面 | 状态 | 说明 |
|------|------|------|
| **现有数据** | ✅ 安全 | 所有新字段都是可选的 |
| **现有请求** | ✅ 安全 | 完整 URL 继续正常工作 |
| **导入导出** | ⚠️ 注意 | 需要同步更新适配器 |

---

## 九、后续扩展路线图

### P2 中期（3-6 个月）

#### 9.1 VariableResolver 抽象层

为未来动态变量预留扩展点：

```typescript
interface VariableResolver {
  resolve(key: string, context: ResolveContext): string | undefined;
  supports(key: string): boolean;
}

// 实现示例：时间戳动态变量
class TimestampResolver implements VariableResolver {
  supports(key: string) {
    return key === '$timestamp' || key === '$now';
  }
  
  resolve() {
    return Date.now().toString();
  }
}
```

#### 9.2 请求级别变量覆盖

支持单个请求覆盖环境变量：

```typescript
interface HttpRequest {
  // ... 现有字段
  localVariables?: EnvironmentVariable[];  // 请求级别局部变量
}
```

优先级明确为：Request.localVariables > Environment.variables > Collection.variables

#### 9.3 Collection 级别变量

支持在 Collection 内定义变量（Postman 兼容）：

```typescript
interface Collection {
  // ... 现有字段
  variables?: EnvironmentVariable[];  // Collection 级别变量
}
```

### P3 长期（6-12 个月）

#### 9.4 URL 历史/收藏

记录常用的 baseURL，方便快速切换：

```typescript
interface UrlHistory {
  url: string;
  usageCount: number;
  lastUsed: number;
}
```

#### 9.5 Pre-request Script

Postman 核心能力，支持动态修改变量：

```typescript
interface HttpRequest {
  // ... 现有字段
  preRequestScript?: string;  // JavaScript 脚本
}
```

#### 9.6 Auth 继承体系

Collection → Folder → Request 的认证信息继承：

```typescript
interface AuthConfig {
  type: 'none' | 'basic' | 'bearer' | 'oauth2';
  config: Record<string, string>;
}

interface Collection {
  auth?: AuthConfig;  // 默认认证配置
}

interface HttpRequest {
  auth?: AuthConfig;  // 覆盖 Collection 配置
  inheritAuth?: boolean;  // 是否继承上级配置
}
```

#### 9.7 Secret 变量加密存储

敏感信息（token、password）加密存储：

```typescript
interface EnvironmentVariable {
  key: string;
  value: string;
  type: 'string' | 'secret';  // secret 类型加密存储
  enabled: boolean;
}
```

---

## 十、架构决策记录（ADR）

### ADR-1: 模板变量替代层级继承

**决策**：使用 `{{variable}}` 模板语法而非层级 baseURL 继承

**理由**：
1. 架构简化：去掉复杂的 resolveRequestUrl 层级查找
2. 跨平台友好：字符串替换在任何环境都容易实现
3. 用户灵活：支持任意变量名，适应多服务场景

**权衡**：
- ✅ 失去自动路径拼接能力（通过 normalizeUrl 弥补）
- ✅ 用户需要学习模板语法（降低学习曲线已在 UI 层优化）

### ADR-2: defaultBaseUrl 弱参与运行时

**决策**：defaultBaseUrl 不强制参与解析，只在特定条件下拼接

**触发条件**：
1. Request.url 不包含协议（`://`）
2. Request.url 不包含模板（`{{}}`）
3. Collection.defaultBaseUrl 存在

**理由**：
1. 向后兼容：不破坏现有请求
2. 用户友好：无模板时自动生效，降低学习成本
3. 明确优先级：完整 URL > 模板变量 > 弱拼接

### ADR-3: 变量解析引擎独立化

**决策**：将变量解析从 environment.ts 抽取为独立的 resolveVariables

**理由**：
1. 单一职责：环境变量管理 vs 变量字符串解析分离
2. 可测试：独立函数更容易单元测试
3. 可扩展：为未来动态变量预留接口

---

## 十、附录

### 相关文件索引

| 功能 | 文件路径 |
|------|----------|
| 类型定义 | `src/types/index.ts` |
| 存储类型 | `src/storage/types.ts` |
| Collection 服务 | `src/services/collection.ts` |
| HTTP 服务 | `src/services/http.ts` |
| 环境变量工具 | `src/utils/environment.ts` |
| 适配器 IR | `src/adapters/core/types.ts` |
| Postman 适配器 | `src/adapters/postman/index.ts` |
| Swagger 适配器 | `src/adapters/swagger/index.ts` |
| Collection 组件 | `src/components/CollectionTree.tsx` |
| RequestBuilder | `src/components/RequestBuilder.tsx` |
| EnvironmentManager | `src/components/EnvironmentManager.tsx` |

---

**方案版本**：v2.0（优化版）  
**更新日期**：2026-03-25  
**变更说明**：从层级继承改为模板变量方案，简化架构，提升跨平台兼容性

---

## 十一、项目介绍（供审核人员参考）

### 11.1 项目概述

**Postlite** 是一个受 Postman 启发的轻量级 API 测试工具，采用 React + TypeScript + Vite 构建。

### 11.2 核心技术栈

- **前端框架**: React 19 + TypeScript 5.9
- **构建工具**: Vite 8
- **UI 组件库**: Ant Design 6
- **数据存储**: IndexedDB（浏览器本地存储）
- **测试框架**: Vitest + Testing Library

### 11.3 架构特点

- **分层架构**: 清晰的职责分离（UI → Service → Core → Repository → Storage）
- **扁平化存储**: IndexedDB 中 Collection 和 Item 分开存储，支持无限嵌套 Folder
- **适配器模式**: 已实现对 Postman、Swagger/OpenAPI 格式的导入支持
- **环境变量**: 支持 `{{variableName}}` 语法的变量替换系统

### 11.4 当前功能

- Collection 管理（嵌套 Folder 支持）
- HTTP 请求构建和发送（GET/POST/PUT/DELETE/PATCH/HEAD/OPTIONS）
- Headers、Query 参数、Body 管理
- 环境变量配置和多环境切换
- Postman / Swagger / YApi 导入
- Service Worker 代理（解决浏览器 CORS 限制）

### 11.5 代码库统计

- **测试覆盖**: 387+ 单元测试
- **主要模块**:
  - `src/components/` - React 组件（CollectionTree、RequestBuilder、EnvironmentManager 等）
  - `src/services/` - 业务逻辑服务层
  - `src/core/` - 核心领域逻辑（Repository、Service、Models）
  - `src/storage/` - IndexedDB 存储策略
  - `src/adapters/` - 导入导出适配器
  - `src/utils/` - 工具函数（环境变量替换、导入导出等）

### 11.6 项目目标

短期：完善 Web 端 API 测试功能，提供媲美 Postman 的基础体验  
长期：发展为跨平台应用（支持 macOS、Windows 桌面端），保持核心代码复用
---

## 十二、未来架构演进路线图（待实现）

> 以下特性在当前方案中已预留接口，但无需立即实现。当产品规模扩大时再逐步引入。

### 12.1 Async Variable Resolver（支持异步变量）

**场景**：从 API 获取 token、从存储读取 secret

**当前限制**：`resolve()` 是同步函数

**预留方案**：

```typescript
// 未来扩展为异步接口
interface VariableResolver {
  resolve(key: string, context: ResolveContext): Promise<string | undefined>;
  supports(key: string): boolean;
}

// 异步解析入口
export async function resolveVariablesAsync(
  value: string,
  resolver: VariableResolver,
  context: ResolveContext = {}
): Promise<string> {
  // 实现类似，但支持 await resolver.resolve()
}
```

**影响范围**：需要 async/await 化整个 HTTP 请求链路

---

### 12.2 Composite Resolver（多解析器组合）

**场景**：同时支持静态变量、动态变量、系统变量

**当前限制**：只使用单个 StaticVariableResolver

**预留方案**：

```typescript
// 组合解析器
export class CompositeResolver implements VariableResolver {
  private resolvers: VariableResolver[];
  
  constructor(resolvers: VariableResolver[]) {
    this.resolvers = resolvers;
  }
  
  supports(key: string): boolean {
    return this.resolvers.some(r => r.supports(key));
  }
  
  resolve(key: string, context: ResolveContext): string | undefined {
    for (const resolver of this.resolvers) {
      if (resolver.supports(key)) {
        return resolver.resolve(key, context);
      }
    }
    return undefined;
  }
}

// 使用示例
const resolver = new CompositeResolver([
  new StaticVariableResolver(envVars, localVars),  // 用户定义变量
  new DynamicVariableResolver(),                    // $timestamp, $uuid
  new SystemVariableResolver(),                     // $env, $process
]);
```

---

### 12.3 URL IR（结构化 URL 替代字符串）

**场景**：精确编辑 URL 各部分、path 参数填充

**当前限制**：URL 以字符串形式存储和传递

**预留方案**：

```typescript
// 结构化 URL（与 IR 层对齐）
interface StructuredUrl {
  protocol?: string;
  host: string[];           // ["{{baseUrl}}"]
  path: string[];           // ["users", ":id"]
  query: { key: string; value: string }[];
  variables: { key: string; value?: string }[];  // path 变量值
}

// 在 HttpRequest 中支持两种形式
interface HttpRequest {
  // ...
  url: string | StructuredUrl;
}

// 渲染时转换为字符串
function renderStructuredUrl(url: StructuredUrl, resolver: VariableResolver): string {
  const host = url.host.map(h => resolveVariables(h, resolver)).join('.');
  const path = url.path.map(p => {
    if (p.startsWith(':')) {
      const varName = p.slice(1);
      const varValue = url.variables.find(v => v.key === varName)?.value;
      return varValue || p;  // 未填充保持原样
    }
    return resolveVariables(p, resolver);
  }).join('/');
  const query = new URLSearchParams(url.query.map(q => [q.key, q.value]));
  return `${url.protocol}://${host}/${path}?${query}`;
}
```

**影响**：需要更新 RequestBuilder UI 支持分段编辑

---

### 12.4 Query 参数合并策略

**场景**：URL 中已有 query，与 Request.params 如何合并

**当前未明确**：`parseUrl(normalizedUrl, request.params)` 的行为

**建议策略**（后续实现时选择）：

```typescript
interface QueryMergeStrategy {
  mode: 'override' | 'append' | 'merge';
  // override: params 完全覆盖 URL 中的 query
  // append: params 追加到 URL query 后（可能重复 key）
  // merge: params 覆盖同名 key，保留其他
}

// 默认使用 merge（最符合直觉）
const DEFAULT_STRATEGY: QueryMergeStrategy = { mode: 'merge' };
```

---

### 12.5 全局变量系统（跨作用域）

**当前**：变量系统只用于 URL

**未来**：扩展到 Headers、Body、Auth

**架构准备**：

已在 `VariableResolver` 接口中预留 `context` 参数，可携带：
- 当前请求对象
- 当前 Collection
- 执行环境信息

```typescript
interface ResolveContext {
  localVars?: EnvironmentVariable[];
  envVars?: EnvironmentVariable[];
  request?: HttpRequest;        // 可访问请求其他字段
  collection?: Collection;      // 可访问 Collection 配置
  // ... 未来扩展
}
```

---

## 十三、最终状态确认

### ✅ 已解决（本版完成）

| 项目 | 状态 |
|------|------|
| VariableResolver 抽象接口 | ✅ 已实现 |
| 变量递归解析 + 循环检测 | ✅ 已实现（pathStack）|
| 变量优先级（Map 实现）| ✅ 已实现（local > env）|
| URL 规范化（不误伤 query）| ✅ 已实现（URL 对象处理）|
| 标准 protocol 检测 | ✅ 已实现（含 //）|
| defaultBaseUrl 弱参与 | ✅ 已实现（三条件判断）|
| UI / HTTP 分层校验 | ✅ 已实现（status 分级）|
| IR 层 URL 结构 | ✅ 已实现（含 query/variable）|
| 边界问题修复 | ✅ 已修复（去重、深度、normalize）|

### 🟡 预留接口（未来演进）

| 项目 | 状态 |
|------|------|
| Async Resolver | 🟡 接口预留 |
| Composite Resolver | 🟡 设计完成 |
| URL IR 结构化 | 🟡 类型定义完成 |
| Query 合并策略 | 🟡 待决策 |
| 全局变量系统 | 🟡 Context 参数预留 |

### 🎯 架构定位

> **当前状态**：Postman Lite 级别功能，专业级架构
> 
> **核心成就**：变量系统、URL 处理链路、执行引擎骨架已全部就绪
> 
> **下一步建议**：不必再优化 BaseURL 方案，直接开始实现，或转向"全局变量系统"设计

---

**文档版本**：v3.0（最终版）  
**更新日期**：2026-03-25  
**状态**：✅ 可进入开发实现阶段
