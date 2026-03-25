可长期演进的完整架构蓝图（V3）。目标是：

> ✅ 存储彻底解耦
> ✅ 多格式导入导出统一
> ✅ 支持未来云同步 / 插件扩展
> ✅ 保持前端项目复杂度可控

---

# 一、整体架构（最终形态）

```text
┌──────────────────────────────┐
│           UI 层               │
└─────────────┬────────────────┘
              ↓
┌──────────────────────────────┐
│         Service 层            │  ← 业务逻辑（无存储细节）
└─────────────┬────────────────┘
              ↓
┌──────────────────────────────┐
│       Repository 层           │  ← 领域数据访问（核心 API）
└─────────────┬────────────────┘
              ↓
┌──────────────────────────────┐
│        Cache 层               │  ← 内存缓存（性能关键）
└─────────────┬────────────────┘
              ↓
┌──────────────────────────────┐
│   Storage Strategy 层         │  ← IndexedDB / Remote / Memory
└─────────────┬────────────────┘
              ↓
┌──────────────────────────────┐
│        Adapter 层             │  ← 多格式导入导出（独立）
└──────────────────────────────┘
```

---

# 二、核心分层职责

## 1. Service 层（业务层）

**职责：**

* 组合多个 Repository 完成业务逻辑
* 不关心存储实现
* 不关心数据来源（本地 / 远程）

**特点：**

* 面向“用户行为”
* 不直接操作 storage

---

## 2. Repository 层（数据访问核心）

**职责：**

* 提供统一的数据访问 API
* 封装数据结构（Collection / Item）
* 屏蔽 storage 差异

**关键点：**

> ❗Repository 是你真正对外的数据契约（比 Storage 更重要）

---

## 3. Cache 层（性能层）

**职责：**

* 减少 IndexedDB IO
* 提供热数据访问
* 支持读缓存 + 写透（write-through）

**策略：**

* Key-Value cache（按 id）
* 可选 LRU（后期优化）

---

## 4. Storage Strategy 层（存储抽象）

**职责：**

* 提供统一 CRUD / query / transaction 能力
* 不包含业务语义

**实现可插拔：**

```text
IndexedDBStrategy（默认）
MemoryStrategy（测试）
RemoteStrategy（未来）
```

---

## 5. Adapter 层（格式适配层 ⭐）

**职责：**

> ❗统一处理所有导入导出格式

* Postman
* Swagger / OpenAPI
* Apifox
* 未来扩展（curl / HAR）

---

# 三、数据模型设计（统一规范）

## 核心思想

> ❗“树结构 = 逻辑结构，扁平结构 = 存储结构”

---

## 1. 扁平存储模型（Storage Model）

### collections

* 元信息（名称、描述）
* 无嵌套

---

### items（核心）

```text
type: folder | request
parentId: 实现树结构
collectionId: 归属
```

👉 用一张表表达整个树

---

## 2. 领域模型（Repository 暴露）

Repository 可以：

* 返回扁平数据（高性能）
* 或组装树（UI 使用）

---

## 3. 中间模型 IR（Adapter 专用）

```text
CollectionIR
  └── ItemIR（树）
```

👉 用于：

* 导入转换
* 导出生成

---

# 四、三种模型分层（非常关键）

```text
外部格式（Postman / Swagger / Apifox）
        ↓
Intermediate Representation（IR）
        ↓
Storage Model（扁平 DB）
        ↓
Domain Model（Repository 输出）
```

---

## ❗原则总结

| 层       | 是否稳定   |
| ------- | ------ |
| 外部格式    | ❌ 不可控  |
| IR      | ✅ 可控   |
| Storage | ✅ 高性能  |
| Domain  | ✅ 面向业务 |

---

# 五、Adapter 插件架构（多格式核心）

## 1. 设计目标

* 可扩展
* 自动识别格式
* 解耦主流程

---

## 2. Adapter 分类

### Import Adapter

```text
输入 → IR
```

支持：

* Postman
* Swagger
* Apifox

---

### Export Adapter

```text
IR → 输出格式
```

---

## 3. Adapter 生命周期

```text
用户导入
   ↓
detect（识别格式）
   ↓
parse → IR
   ↓
IR → Repository（入库）
```

---

## 4. 关键设计点

### ❗1. detect 必须轻量

避免解析整个 JSON

---

### ❗2. IR 必须“最小但完整”

不要直接复用 Postman 结构

---

### ❗3. Adapter 不依赖 storage

完全独立模块

---

# 六、关键能力设计（保证未来扩展）

---

## 1. 事务（必须）

用于：

* 批量导入
* 拖拽排序
* 复杂操作

---

## 2. 批处理（性能）

避免频繁 IO

---

## 3. 索引策略

| 查询                  | 索引            |
| ------------------- | ------------- |
| collection 下所有 item | by-collection |
| 构建树                 | by-parent     |
| request 查询          | by-type       |
| 排序                  | by-updated    |

---

## 4. Mutation 模型（为未来做准备）

```text
操作日志，而不是状态快照
```

用途：

* undo/redo
* 云同步
* 冲突合并

---

## 5. 缓存策略

* read-through
* write-through
* 可选失效策略

---

# 七、导入导出完整流程

---

## ✅ 导入流程

```text
JSON / 文件
   ↓
Adapter.detect
   ↓
Adapter.parse → IR
   ↓
IR → Repository
   ↓
Storage（事务写入）
```

---

## ✅ 导出流程

```text
Repository
   ↓
构建 IR
   ↓
Adapter.export
   ↓
目标格式 JSON
```

---

# 八、目录结构（最终推荐）

```text
src/
├── core/
│   ├── models/           # Collection / Item
│   ├── repositories/     # 数据访问
│   ├── services/         # 业务逻辑
│   └── mutations/        # 可选
│
├── storage/
│   ├── types.ts
│   ├── storage.ts
│   └── strategies/
│       ├── indexeddb.ts
│       ├── memory.ts
│       └── remote.ts
│
├── cache/
│   └── cacheLayer.ts
│
├── adapters/
│   ├── core/             # IR 定义 + adapter 接口
│   ├── postman/
│   ├── swagger/
│   ├── apifox/
│   └── index.ts          # 注册中心
```

---

# 九、实施优先级（避免过度设计）

## Phase 1（必须）

* 扁平化数据模型（items）
* IndexedDBStrategy
* Item / Collection Repository

---

## Phase 2（关键）

* Adapter（至少 Postman + Swagger）
* IR 模型
* 导入导出流程

---

## Phase 3（性能）

* Cache 层
* batch / transaction

---

## Phase 4（增强）

* Mutation 模型
* Worker 化

---

# 十、最终你会得到什么能力

这套架构完成后：

---

## ✅ 短期

* 性能远超 localStorage
* 支持大规模数据
* 支持复杂查询

---

## ✅ 中期

* 支持多格式导入导出
* 可以替代 Postman 基础功能

---

## ✅ 长期（关键价值）

你已经具备：

> 👉 **构建“本地优先 API 平台”的基础设施能力**

包括：

* 云同步（加 RemoteStrategy）
* 多端（Web / Electron）
* 协同（基于 mutation）

---

# 最后一句关键建议

> ❗你这个项目的关键不是“选 IndexedDB”，而是：

> 👉 **是否建立了“IR + Repository + Adapter”这三层抽象**

只要这三层是干净的：

* 存储可以换
* 格式可以扩
* 功能可以长

---

如果你下一步要做实现，我建议优先：

👉 **先把 Adapter + IR 跑通（Postman + Swagger）**

因为这部分一旦设计错，后面全部要推翻。
