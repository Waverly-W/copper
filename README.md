# copper

`copper` 是一个基于 uTools 的个人剪贴板工作台，目标是替代官方剪贴板插件，围绕「历史记录 + 收藏沉淀 + 键盘优先 + 本地优先」构建更高频的个人工作流。

当前项目已经实现了文本、图片、文件的基础采集和回填链路，支持左右分栏的历史区与收藏区，支持收藏 Tab、键盘导航，以及基于拼音与模糊匹配的本地搜索。

## 当前能力

- 历史记录采集
  - 文本去重累计 `copyCount` 和 `lastCopiedAt`
  - 图片原图落地到插件私有目录
  - 文件/多文件复制通过 `utools.getCopyedFiles()` 优先采集
- 收藏工作流
  - 从历史加入当前收藏 Tab
  - 收藏项独立编辑
  - 同一收藏项可归属于多个 Tab
  - 删除时遵循多 Tab 语义
- 搜索
  - 使用 uTools 官方子输入框作为搜索入口
  - 历史和收藏分别异步返回结果
  - 支持中文拼音、首字母、前缀、包含和子序列模糊匹配
  - 按匹配度和时间排序
- 操作
  - 单击复制
  - `Space` 粘贴回插件打开前的窗口
  - `Ctrl/Cmd + S` 收藏或取消收藏
  - `Ctrl/Cmd + D` 删除
  - `Ctrl/Cmd + 1~9` 切换收藏 Tab
- 存储
  - 历史记录使用 `utools.db` 按条存储
  - 设置和收藏优先使用 `dbCryptoStorage`
  - 图片资源落地到 `userData/clipboard-plugin/assets/images`

## 技术栈

- React 19
- Vite 6
- uTools Plugin API
- Electron clipboard
- `pinyin-pro` 用于拼音搜索

## 目录结构

```text
public/
  plugin.json                         uTools 插件清单
  preload/services.js                preload 桥接层
  clipboard-event-handler-win32.ps1  Windows 原生剪贴板监听脚本

src/
  App.jsx                            应用入口，负责路由、监听和 uTools 子输入框
  pages/clipboard                    主工作台页面
  pages/settings                     设置页
  components/                        UI 组件
  stores/                            外部 store
  services/clipboard                 采集、复制、粘贴和监听
  services/storage                   本地存储层
  services/search                    搜索索引与异步搜索
  services/history                   历史项装饰与元数据
  app/plugin-lifecycle.js            uTools 进入行为与页面路由

docs/
  clipboard-plugin-prd.md
  clipboard-plugin-technical-design.md
```

## 开发方式

### 1. 安装依赖

```bash
npm install
```

### 2. 启动开发服务器

```bash
npm run dev
```

`public/plugin.json` 已配置：

- 开发模式入口：`http://localhost:5173`
- 生产模式入口：`index.html`

### 3. 在 uTools 中调试

1. 打开 uTools 开发者工具或插件开发模式。
2. 将项目目录作为开发插件加载。
3. 使用 `clipboard` 或 `clip` 指令打开插件。

### 4. 构建

```bash
npm run build
```

## 主要快捷键

- `Ctrl/Cmd + F`：聚焦 uTools 子输入框
- `Tab`：切换历史区 / 收藏区
- `↑ / ↓`：移动选中项
- `→`：从历史区快速切到收藏区
- `Enter`：复制当前项
- `Space`：粘贴当前项并关闭插件
- `Ctrl/Cmd + S`：加入或移出当前收藏 Tab
- `Ctrl/Cmd + D`：删除当前项
- `Ctrl/Cmd + E`：编辑当前收藏项
- `Ctrl/Cmd + N`：新建收藏项
- `Ctrl/Cmd + Shift + T`：新建收藏 Tab
- `Ctrl/Cmd + 1~9`：切换收藏 Tab
- `Ctrl/Cmd + ,`：打开设置页

## 实现说明

### 剪贴板监听

- 应用层监听由 [src/App.jsx](src/App.jsx) 启动。
- 监听封装位于 [src/services/clipboard/clipboard-monitor.js](src/services/clipboard/clipboard-monitor.js)。
- preload 会优先尝试原生事件监听，回退到轮询模式。
- Windows 当前使用 [public/clipboard-event-handler-win32.ps1](public/clipboard-event-handler-win32.ps1) 作为原生监听路径。

### 搜索

- 搜索输入来自 uTools `setSubInput`，不使用页面内原生输入框。
- 搜索引擎按需加载，避免把拼音依赖全部塞进首屏主包。
- 搜索实现见：
  - [src/services/search/use-search-results.js](src/services/search/use-search-results.js)
  - [src/services/search/search-engine.js](src/services/search/search-engine.js)

### 存储

- 历史记录：`utools.db`
- 设置与收藏：`dbCryptoStorage`，必要时回退到 `dbStorage`
- 图片资源：文件系统私有目录

## 当前已知边界

- 富文本 / HTML / Excel / WPS 的高保真采集和回填还没有完成。
- 监听仍然依赖插件进程生命周期，不是严格意义上的系统级常驻服务。
- 目前没有自动化测试，主要依赖 `npm run build` 和 uTools 手动回归。

## 手动回归建议

- 文本复制是否去重累计
- 图片复制后是否能再次复制和粘贴
- 资源管理器复制文件 / 多文件是否能进历史
- 历史与收藏是否各自独立滚动
- 拼音搜索、文件名搜索、英文模糊搜索是否返回正确结果
- 收藏加入、跨 Tab 引用、删除语义是否符合预期

## 参考文档

- 产品需求：[docs/clipboard-plugin-prd.md](docs/clipboard-plugin-prd.md)
- 技术设计：[docs/clipboard-plugin-technical-design.md](docs/clipboard-plugin-technical-design.md)
- uTools 文档：[https://www.u-tools.cn/docs/developer/basic/getting-started.html](https://www.u-tools.cn/docs/developer/basic/getting-started.html)
