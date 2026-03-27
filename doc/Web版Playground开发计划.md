# Web版 Playground 开发计划

## 1. 背景与目标

当前项目是一个基于 Tauri v2 的桌面应用，核心能力已经覆盖：

- Markdown 简历编辑
- A4 预览与分页
- 模板切换与样式调节
- PDF 导出
- 本地工作区与文件管理

本次目标不是替换桌面版，而是在同一仓库内新增一个 Web 版本，作为在线 Playground 使用。

Web 版目标：

- 保留 Markdown 编辑与实时预览能力
- 保留模板切换与样式调节能力
- 删除工作区、文件列表、PDF 列表、图片库等桌面专属能力
- 使用 `localStorage` 保存用户当前草稿
- 支持导入 Markdown、导出 Markdown、浏览器打印为 PDF
- 保持与当前桌面版相近的视觉风格和编辑体验

Web 版非目标：

- 不实现桌面版文件管理能力
- 不接入服务端存储
- 不支持多用户协作
- 不在第一阶段实现账户系统、云同步、历史版本

## 2. 总体原则

- 同仓并行开发，不直接推翻当前桌面版结构
- 桌面能力与 Web 能力分层，避免在同一套组件里大量堆积 `if (isWeb)` / `if (isTauri)`
- 优先抽离纯前端共享能力，减少复制代码，保持 DRY
- 先完成可用的 Web MVP，再逐步提高共享比例
- 保持改动最小化，不做无关重构

## 3. 当前代码现状分析

适合复用的现有模块：

- `src/components/EditorPane.vue`
- `src/components/PreviewPane.vue`
- `src/components/editor/*`
- `src/components/preview/*`
- `src/utils/markdownRender.ts`
- `src/utils/manualPageBreak.ts`
- `src/utils/resumeParser.ts`
- `src/utils/templateStyle.ts`
- `src/utils/exportStyles.ts`
- `src/utils/fontAssets.ts`
- `src/assets/templates/*`

与桌面能力强耦合、不能直接搬进 Web 的模块：

- `src/stores/resume.ts`
- `src/components/Sidebar.vue`
- `src/components/sidebar/ResumeLibraryPanel.vue`
- `src/components/TopNavBar.vue`
- `src-tauri/src/lib.rs`

核心问题：

- 当前 `resume.ts` 同时承担了文档状态、模板状态、工作区状态、文件列表、监听、导出、图片管理等多种职责，职责过重
- 当前顶栏和侧边栏默认围绕“工作区 + 文件管理”设计，不适合 Web Playground
- 当前 PDF 导出依赖 Tauri Rust 命令，Web 环境不可直接复用

结论：

- Web 版不能直接复制当前 `src` 后简单删按钮
- 应新增独立 Web 应用，并抽离共享的纯前端核心模块

## 4. 目标架构

推荐采用“单仓多应用 + 共享包”结构。

### 4.1 推荐目录结构

```text
max-md2cv/
  src/                          # 现有桌面版前端，短期保留
  src-tauri/                    # 现有桌面版后端
  apps/
    web/                        # 新增 Web Playground
      index.html
      package.json
      tsconfig.json
      vite.config.ts
      src/
        App.vue
        main.ts
        stores/
        components/
        pages/
  packages/
    resume-core/                # 共享的纯前端能力
      package.json
      src/
        types/
        constants/
        utils/
        templates/
        preview/
```

### 4.2 渐进式落地策略

为降低风险，不建议一开始就把当前桌面版整体迁到 `apps/desktop`。推荐分两步：

第一步：

- 保留桌面版在仓库根目录运行
- 仅新增 `apps/web`
- 抽 `packages/resume-core`

第二步：

- Web 版稳定后，再视情况把桌面版逐步接入共享包

这样可以避免同时搬迁桌面版和开发 Web 版，降低耦合风险。

## 5. 模块拆分方案

### 5.1 新增共享包 `packages/resume-core`

职责：

- 提供纯前端、与运行平台无关的能力
- 不依赖 Tauri API
- 不依赖工作区、文件系统、系统对话框

建议迁移内容：

- `ResumeStyle` 等类型定义
- 默认样式工厂
- 模板解析与样式解析
- Markdown 渲染
- 手动分页相关工具
- 预览样式构建逻辑
- 模板资源加载工具

建议目录：

```text
packages/resume-core/src/
  types/
    resume.ts
  constants/
    storage.ts
  utils/
    markdownRender.ts
    manualPageBreak.ts
    resumeParser.ts
    templateStyle.ts
    fontAssets.ts
  templates/
    loader.ts
```

### 5.2 桌面版保留独立状态层

桌面版继续保留自己的 store，用于处理：

- 工作区路径
- 文件增删改查
- 本地监听
- PDF 文件列表
- 图片文件列表
- Tauri 命令调用

这部分先不主动重构，只在后续逐步替换为共享能力。

### 5.3 Web 版新增独立状态层

Web 版新建 `playground store`，职责仅限：

- 当前 Markdown 内容
- 当前模板
- 当前样式配置
- 当前头像 Base64
- 本地草稿保存与恢复
- UI 状态

不承担文件系统职责。

## 6. Web 版功能范围

### 6.1 首期必须完成

- Markdown 编辑器
- 实时 A4 预览
- 模板切换
- 样式调节
- 头像上传
- `localStorage` 自动保存
- 导入 Markdown 文件
- 导出 Markdown 文件
- 浏览器打印为 PDF

### 6.2 首期不做

- 多文档管理
- 云端持久化
- 登录系统
- 分享链接
- 模板在线市场
- 后端 API

### 6.3 二期可选功能

- 多草稿列表
- URL 参数导入示例模板
- 草稿导出为 JSON
- 一键复制 HTML
- 模板配置预设

## 7. Web 版页面与交互设计

### 7.1 页面结构

Web 版推荐保持单页 Playground 结构：

- 顶栏
- 左侧编辑器
- 右侧预览
- 可选大纲抽屉

建议布局：

```text
+------------------------------------------------------+
| Top Bar                                              |
| 模板 | 样式 | 导入 | 导出 | 打印 | 清空草稿           |
+--------------------------+---------------------------+
| Markdown Editor          | A4 Preview                |
|                          |                           |
|                          |                           |
+--------------------------+---------------------------+
```

### 7.2 顶栏功能

Web 顶栏建议包含：

- 模板选择
- 样式设置入口
- 导入 `.md`
- 导出 `.md`
- 打印 PDF
- 重置草稿
- 可选“恢复默认模板”

桌面版顶栏中与工作区相关的状态展示不复用。

### 7.3 侧边能力处理

桌面版左侧边栏的文件库、PDF 列表、图片列表在 Web 版全部移除。

大纲能力可保留，但改成：

- 顶栏按钮打开抽屉
- 或右侧可收起面板

不再占据左侧主栏。

## 8. 数据模型设计

### 8.1 本地存储结构

建议使用单对象持久化，避免散乱 key：

```ts
export interface WebPlaygroundDraft {
  version: 1
  markdown: string
  templateId: string
  resumeStyle: ResumeStyle
  photoBase64: string | null
  updatedAt: string
}
```

建议存储键：

```ts
const PLAYGROUND_STORAGE_KEY = "max-md2cv:web-playground:draft"
```

### 8.2 版本迁移策略

必须保留 `version` 字段。

后续如果字段有变化，统一通过 `migrateDraft()` 进行兼容处理，避免线上老草稿无法读取。

## 9. 技术方案细化

### 9.1 构建与包管理

建议使用 npm workspaces。

根目录 `package.json` 可调整为：

- 保持当前桌面版脚本
- 新增 Web 版脚本
- 新增 shared package 引用

建议新增脚本：

- `dev:web`
- `build:web`
- `preview:web`

### 9.2 Web 版依赖策略

Web 版优先复用当前前端依赖：

- Vue 3
- Pinia
- CodeMirror 6
- Paged.js
- marked
- Tailwind CSS

不引入 Tauri 相关依赖到 Web 版运行时。

### 9.3 编辑器策略

推荐先复用当前 CodeMirror 编辑能力，但要做一层包装：

- 将编辑器组件需要的状态收敛成 props / emits 或轻量 store
- 删掉对 `activeFilePath`、`missing file`、`saveMissingFileAs` 之类的桌面状态依赖

目标是让编辑器变成“只操作当前文档”的组件。

### 9.4 预览策略

预览主体继续使用 Paged.js。

需要改造的点：

- 切断对桌面图片列表的依赖
- 将头像来源改为 `photoBase64`
- 将渲染状态持久化从“按文件保存”改为“按草稿保存”
- 打印导出改为浏览器 `window.print()`

### 9.5 模板资源策略

内置模板继续从仓库内静态资源加载。

建议做法：

- 将模板 CSS 与默认模板 Markdown 统一抽到 `resume-core`
- Web 版与桌面版共用同一套内置模板资源

第一阶段不支持“用户保存自定义模板到本地文件系统”。

## 10. 分阶段开发计划

## 阶段 A：项目基线搭建

目标：

- 在不影响桌面版的前提下建立 Web 子应用骨架

任务：

- 新增 `apps/web`
- 配置独立 `package.json`
- 配置独立 `vite.config.ts`
- 配置独立 `tsconfig.json`
- 增加根目录 workspace 配置
- 确保桌面版原有脚本仍能运行

交付物：

- `apps/web` 可独立启动
- Web 空白页可访问

验收标准：

- `npm run dev:web` 可启动
- `npm run tauri dev` 不受影响

## 阶段 B：抽离共享核心

目标：

- 将纯前端能力抽到共享包

任务：

- 抽 `ResumeStyle`、模板类型、草稿类型
- 抽 `markdownRender`
- 抽 `manualPageBreak`
- 抽 `resumeParser`
- 抽 `templateStyle`
- 抽模板资源加载器
- 将平台相关代码留在桌面端

交付物：

- `packages/resume-core`
- Web 与桌面都可引用共享工具

验收标准：

- 核心工具在 Web 环境无 Tauri 依赖
- 桌面版原有预览逻辑未被破坏

## 阶段 C：Web Store 与本地持久化

目标：

- 建立 Web Playground 的状态层

任务：

- 新建 `playground store`
- 实现默认草稿初始化
- 实现 `localStorage` 自动保存
- 实现 `localStorage` 恢复
- 实现版本迁移
- 实现“重置草稿”

交付物：

- Web 版基础状态可工作

验收标准：

- 刷新页面后内容可恢复
- 模板和样式可恢复
- 头像可恢复

## 阶段 D：接入编辑器

目标：

- Web 版可编辑 Markdown

任务：

- 复用或轻改当前编辑器组件
- 删掉桌面专属状态判断
- 接入 Web store
- 保留基础格式化工具栏
- 保留复制 Markdown 能力

交付物：

- Web 页面左侧编辑器可用

验收标准：

- 输入流畅
- 自动保存正常
- 格式化命令可用

## 阶段 E：接入预览

目标：

- Web 版可实时预览并分页

任务：

- 复用预览组件主链路
- 接入 Web store
- 保留模板切换
- 保留样式调节
- 头像上传改为浏览器文件读取
- 修复与桌面路径有关的逻辑

交付物：

- Web 页面右侧 A4 预览可用

验收标准：

- 编辑内容后预览可更新
- 模板切换后样式正确
- 头像上传后预览正确显示

## 阶段 F：导入导出能力

目标：

- 完成 Playground 基本闭环

任务：

- 支持导入 `.md`
- 支持导出 `.md`
- 支持导出当前草稿 JSON
- 支持浏览器打印 PDF
- 可选增加“复制 HTML”

交付物：

- Web 版具备分享和输出能力

验收标准：

- 导入 Markdown 后内容与预览同步
- 导出 Markdown 文件内容正确
- 打印页样式与预览基本一致

## 阶段 G：体验打磨与发布

目标：

- 达到可对外展示的 Playground 质量

任务：

- 响应式布局优化
- 空状态与引导文案
- 首屏默认示例文档
- 性能优化
- 错误提示优化
- 打包部署脚本

交付物：

- 可部署的静态 Web 应用

验收标准：

- 桌面和移动端浏览器可正常使用
- 核心流程无明显阻塞问题

## 11. 详细任务清单

### 11.1 目录与工程任务

- 建立 `apps/web`
- 建立 `packages/resume-core`
- 配置 workspace
- 配置路径别名
- 配置共享样式引用

### 11.2 共享层任务

- 提取类型定义
- 提取模板工具
- 提取 Markdown 渲染工具
- 提取分页辅助逻辑
- 提取预览相关纯函数

### 11.3 Web UI 任务

- 新建 `App.vue`
- 新建 `TopBar`
- 新建 `PlaygroundLayout`
- 新建 `TemplatePanel`
- 新建 `StylePanel`
- 新建 `ImportExportActions`
- 新建 `OutlineDrawer`

### 11.4 数据与持久化任务

- 设计草稿结构
- 封装读写 `localStorage`
- 编写草稿迁移函数
- 增加节流保存

### 11.5 导入导出任务

- 文件导入
- Markdown 下载
- JSON 下载
- 打印样式页

## 12. 验收标准

### 12.1 功能验收

- 打开网页后可直接编辑
- 刷新后草稿自动恢复
- 模板切换正常
- 样式调节正常
- 头像上传正常
- 导入导出正常
- 打印 PDF 基本可用

### 12.2 工程验收

- Web 版不依赖 Tauri API
- 桌面版原功能不回归
- 共享代码职责清晰
- 不出现明显重复实现

### 12.3 体验验收

- 首屏不空白
- 预览渲染延迟可接受
- 大文档编辑不卡顿
- 移动端至少可浏览和轻量编辑

## 13. 风险与对策

### 风险 1：共享层抽取过度，拖慢交付

对策：

- 第一阶段只抽纯函数和类型
- 组件层共享不要一次性做满

### 风险 2：编辑器与预览组件对桌面 store 绑定过深

对策：

- 先做 Web 专用包装层
- 再逐步把公共逻辑下沉

### 风险 3：Web 打印结果与桌面导出结果不完全一致

对策：

- 接受“近似一致”作为首期目标
- 将打印链路单独调优，不追求与桌面导出完全同构

### 风险 4：`localStorage` 容量限制

对策：

- 首期只存单份草稿
- 头像做大小限制
- 超限时给出降级提示

## 14. 建议开发顺序

建议严格按以下顺序推进：

1. 建 Web 工程骨架
2. 抽共享工具和类型
3. 建 Web store
4. 接编辑器
5. 接预览
6. 做导入导出
7. 做体验打磨

不要先复制整套桌面前端再删功能，否则后续会留下大量无用状态和分支逻辑。

## 15. MVP 定义

满足以下条件即可视为 Web MVP 完成：

- 用户打开网页即可开始编辑
- 内容会自动保存在本地
- 可以切换模板和调整样式
- 可以上传头像
- 可以导入与导出 Markdown
- 可以通过浏览器打印为 PDF

## 16. 后续演进建议

MVP 完成后，可按优先级继续演进：

第一优先级：

- 多草稿管理
- 默认示例模板
- 分享用 JSON 导出

第二优先级：

- URL 导入草稿
- 模板预设方案
- 更完善的移动端适配

第三优先级：

- 云同步
- 登录体系
- 模板市场

## 17. 最终建议

本项目适合采用“桌面版保留、Web 版并行新增、共享层逐步抽离”的路线。

推荐最终策略：

- 当前桌面版继续作为主应用稳定迭代
- Web 版作为独立 Playground 发布
- 共享层只承接纯前端能力
- 平台能力各自保留在对应应用层

这样既能控制风险，也能保证未来代码结构不会继续膨胀。
