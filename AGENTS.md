# AGENTS

本文件面向后续在这个仓库里工作的工程师或智能体，目的是让改动更快落地，避免重复踩坑。

## 项目定位

这是一个 uTools 剪贴板插件，不是通用展示型面板。产品优先级是：

1. 键盘优先
2. 内容优先
3. 本地优先
4. 搜索优先
5. 收藏沉淀优先

任何改动如果让界面更花哨但降低内容密度、键盘效率或搜索效率，都不是正确方向。

## 当前产品约束

- 左侧是历史区，右侧是收藏区，固定双栏心智不要打破。
- 历史项不可编辑，只能复制、粘贴、删除、加入收藏。
- 收藏项可编辑，可归属多个 Tab。
- 单击复制，双击 `Enter` 粘贴回原窗口。
- 搜索入口必须继续使用 uTools 官方子输入框，不要退回普通页面输入框。
- 所有数据都应该本地处理，插件代码不主动联网。

## 关键实现位置

### 入口与生命周期

- `src/App.jsx`
  - 启动全局监听
  - 设置 uTools 子输入框
  - 控制 `clipboard / settings` 路由
- `src/app/plugin-lifecycle.js`
  - 处理插件进入行为

### 剪贴板能力

- `public/preload/services.js`
  - preload 和 Node/Electron 桥接层
  - 文本、图片、文件读取
  - 文件系统读写
  - 原生监听状态查询
- `src/services/clipboard/clipboard-monitor.js`
  - 监听 orchestrator
  - 原生事件优先，轮询兜底
- `src/services/clipboard/item-actions.js`
  - 复制与粘贴动作分发

### 数据层

- `src/stores/history-store.js`
  - 历史记录状态和写入入口
- `src/stores/favorite-store.js`
  - 收藏项、Tab 和多 Tab 删除语义
- `src/stores/settings-store.js`
  - 设置项
- `src/services/storage/history-repository.js`
  - 历史持久化和清理策略
- `src/services/storage/key-value-store.js`
  - `dbCryptoStorage / dbStorage` 封装

### 搜索层

- `src/services/search/use-search-results.js`
  - 搜索异步调度和按需加载
- `src/services/search/search-engine.js`
  - 匹配、评分、拼音和高亮逻辑

### UI

- `src/pages/clipboard/index.jsx`
  - 主工作台
  - 键盘快捷键主逻辑
- `src/pages/settings/index.jsx`
  - 设置页
- `src/components/clipboard-item`
  - 单条列表项渲染和高亮

## 已有重要决策

### 1. 历史记录不要用 `dbStorage` 整包存

历史记录已经迁移到 `utools.db` 按条存储。不要再回到“整包 JSON 存一个 key”的实现。

### 2. 图片走文件系统，不走大对象入库

图片原图落地到插件私有目录，数据库只保存索引和元数据。不要把大量 base64 直接塞进数据库。

### 3. 文件采集优先用 `utools.getCopyedFiles()`

Electron 的剪贴板格式解析只作为 fallback 或诊断逻辑。主路径优先走 uTools 官方接口。

### 4. 搜索是独立层，不要回退成页面里 `includes()` 过滤

如果要改搜索，应该在搜索服务层改，不要重新把过滤写回页面渲染逻辑里。

### 5. 不要使用浏览器原生弹窗

Electron/uTools 渲染环境下 `window.prompt()` 不可用，相关交互必须走页面内弹层。

## 修改时的优先顺序

优先做这些：

- 采集链路更稳
- 搜索更快更准
- 收藏工作流更闭环
- 键盘流更顺

谨慎做这些：

- 大幅改布局
- 引入重型依赖到首屏
- 重新设计交互心智

## 当前已知缺口

- 富文本 / HTML / Office / Excel 高保真采集与回填未完成
- 真正常驻的系统级监听未完成，当前仍依赖插件进程生命周期
- 自动化测试缺失
- 一些文案和清单文件可能还存在编码问题，改动时顺手清理即可

## 提交前最低验证

每次改动至少做下面这些：

1. 运行 `npm run build`
2. 在 uTools 里手动验证受影响链路

如果改动涉及采集或粘贴，至少回归：

- 文本复制
- 图片复制
- 资源管理器复制文件
- 键盘导航
- 搜索结果

如果改动涉及收藏，至少回归：

- 从历史加入收藏
- 跨 Tab 引用
- 删除时的多 Tab 语义

## 建议的下一阶段方向

如果没有更高优先级任务，建议按这个顺序推进：

1. 富文本 / HTML 采集与回填
2. 更稳定的监听方案
3. 搜索结果命中反馈增强
4. 设置页和插件清单的剩余编码清理
