# linumsX

<p align="center">
  <strong>让 .docx 像代码一样可编排、可追踪、可自动化。</strong>
</p>

<p align="center">
  一个基于 TypeScript 的 AI Word 文档代理，理解自然语言指令，并通过工具链直接读取、编辑、格式化 <code>.docx</code> 文档。
</p>

<p align="center">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.x-1f6feb?style=for-the-badge&logo=typescript&logoColor=white">
  <img alt="Node.js" src="https://img.shields.io/badge/Node.js-CLI-111111?style=for-the-badge&logo=nodedotjs&logoColor=3c873a">
  <img alt="Ink" src="https://img.shields.io/badge/Ink-Interactive_TUI-0b7285?style=for-the-badge">
  <img alt="Vitest" src="https://img.shields.io/badge/Tested_with-Vitest-6f42c1?style=for-the-badge&logo=vitest&logoColor=white">
  <img alt="Docx" src="https://img.shields.io/badge/Target-.docx-c2410c?style=for-the-badge">
</p>

---

[English](./README.md) | [中文](./README.zh-CN.md)

---

## 为什么做这个项目

传统 Word 自动化通常卡在两个极端：

- **太底层**：只能直接改 XML 或脚本拼装。
- **太黑盒**：只能"让 AI 试试看"，很难约束行为。

linumsX 走的是第三条路：

- 用**自然语言**下达编辑指令。
- 用**显式工具**执行具体动作。
- 用**可测试、可扩展的 TypeScript 代码**管理整个过程。

它不是一个聊天机器人外壳，而是一套面向 `.docx` 的代理执行系统。

## 核心特性

| 特性 | 说明 |
| --- | --- |
| 文档理解 | 读取正文、元信息、标题大纲、表格结构 |
| 内容编辑 | 追加内容、添加标题、搜索替换、锚点块替换 |
| 格式控制 | 文本样式、段落样式、表格样式、表格边框 |
| 图像操作 | 添加、删除、调整尺寸、替换文档中的图像 |
| 目录生成 | 根据标题生成、更新、删除目录 |
| 页眉页脚 | 添加、删除、获取页眉页脚；页码设置 |
| 多级列表 | 预设样式的多级编号 |
| 表格增强 | 创建表格、增删行列、单元格合并/拆分、预设样式 |
| 交互模式 | 提供 Ink 终端 UI，适合连续多轮编辑 |
| 工具化执行 | 所有能力通过 Tool Registry 注册，便于扩展和测试 |
| 分层架构 | Domain / Application / Infrastructure 清晰分离 |

## 示例

### 交互模式

```bash
npm start
```

```text
> load D:\docs\proposal.docx
> 给表格0添加黑色单线边框
> 将所有三级标题设为蓝色加粗
> 在结尾追加"总结"标题和摘要
```

### 单次执行

```bash
npx linumsx edit "D:\docs\proposal.docx" "将所有三级标题设为蓝色加粗"
```

### 查看文档信息

```bash
npx linumsx info "D:\docs\proposal.docx"
```

## 功能列表

### 文档工具

| 工具 | 作用 |
| --- | --- |
| `get_document_info` | 获取段落数、表格数、标题数 |
| `get_document_text` | 读取文档全文 |
| `get_document_outline` | 读取标题结构 |
| `list_available_documents` | 列出工作区内可用文档 |
| `create_document` | 创建新文档 |
| `list_images` | 列出文档中所有图像 |
| `add_image` | 添加图像到文档 |
| `delete_image` | 删除文档中的图像 |
| `resize_image` | 修改图像尺寸 |
| `replace_image` | 替换文档中的图像 |
| `generate_toc` | 生成目录 |
| `update_toc` | 更新目录 |
| `delete_toc` | 删除目录 |
| `add_header` | 添加页眉 |
| `add_footer` | 添加页脚 |
| `get_headers_footers` | 获取页眉页脚信息 |
| `delete_header` | 删除页眉 |
| `delete_footer` | 删除页脚 |
| `add_page_number` | 添加页码 |
| `delete_page_number` | 删除页码 |
| `set_header_footer_options` | 设置页眉页脚选项（首页不同、奇偶页不同） |
| `add_numbering` | 添加多级列表编号 |
| `get_numbering` | 获取编号信息 |
| `remove_numbering` | 移除编号 |

### 内容工具

| 工具 | 作用 |
| --- | --- |
| `add_content` | 添加段落或其他内容 |
| `add_heading` | 添加标题 |
| `search_and_replace` | 搜索并替换文本 |
| `replace_block_between_anchors` | 定位锚点并替换片段 |

### 格式工具

| 工具 | 作用 |
| --- | --- |
| `format_text` | 字体、字号、颜色、粗体、斜体、下划线 |
| `format_paragraphs` | 对齐、缩进、行距 |
| `format_table_cells` | 表格单元格格式化 |
| `create_table` | 创建表格 |
| `format_table_borders` | 细粒度设置表格边框 |
| `add_table_row` / `delete_table_row` | 表格行管理 |
| `add_table_column` / `delete_table_column` | 表格列管理 |
| `merge_cells` / `unmerge_cells` | 单元格合并与拆分 |
| `apply_table_style` | 预设样式（三线表、代码块风格） |

### 运行时工具

| 工具 | 作用 |
| --- | --- |
| `read_file` | 读取工作区文件 |
| `write_file` | 写入文件 |
| `edit_file` | 精确替换文本 |
| `delete_file` | 删除文件或目录 |
| `bash` | 在工作区内执行命令 |

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

```bash
copy .env.example .env
```

在 `.env` 中至少配置：

```env
ANTHROPIC_API_KEY=your-api-key-here
```

可选配置：

```env
MODEL_ID=claude-3-5-sonnet-20241022
MAX_TOKENS=4096
TEMPERATURE=0.7
```

### 3. 启动交互 UI

```bash
npm start
```

## CLI 命令

| 命令 | 说明 |
| --- | --- |
| `npm start` | 编译并启动 Ink 交互模式 |
| `npx linumsx ink` | 启动 Ink 终端 UI |
| `npx linumsx i` | `ink` 的简写 |
| `npx linumsx interactive` | 启动简易 REPL 模式 |
| `npx linumsx info <doc>` | 查看文档元信息 |
| `npx linumsx edit <doc> <instruction>` | 对文档执行一次性编辑 |
| `npx agent-doc ...` | 旧命令别名，仍可用 |

## 架构设计

项目采用偏领域驱动的分层设计：

```
src/
├─ application/      CLI、Ink UI、命令入口
├─ domain/           Agent 编排、Document 实体、工具系统
├─ infrastructure/  AI 客户端、配置管理
└─ shared/         通用错误与共享能力
```

### 核心设计

| 层 | 职责 |
| --- | --- |
| `domain/agent` | 管理对话循环、工具调用、上下文刷新 |
| `domain/document` | 加载 `.docx`、抽取段落/表格/标题信息 |
| `domain/tools` | 定义并注册所有工具 |
| `infrastructure/ai` | 对接模型 API |
| `infrastructure/config` | 从 `.env` 读取并校验配置 |

## 开发

```bash
npm run build        # 编译 TypeScript
npm run test        # 运行所有测试
npm run test:watch  # 测试 watch 模式
npm run lint        # 代码检查
npm run format      # 代码格式化
```

运行单个测试文件：

```bash
npx vitest run tests/unit/agent.test.ts
```

## 技术栈

| 技术 | 用途 |
| --- | --- |
| TypeScript | 核心语言 |
| Commander | CLI 命令解析 |
| Ink + React | 终端交互 UI |
| adm-zip | 读取和写回 `.docx` ZIP 包 |
| xmldom | 操作 Word XML |
| Zod | 配置校验 |
| Vitest | 单元测试 |

## 项目目标

- 让 Word 自动化不再停留在宏脚本和手工操作之间。
- 让 AI 编辑文档的行为具备可控、可扩展、可测试的工程结构。
- 让复杂的 `.docx` 处理能力以工具形式沉淀，而不是散落在 prompt 里。

## 规划方向

- 更丰富的表格布局与样式策略
- 更稳定的上下文延续与多轮任务编排
- 脚注与尾注支持
- 文档属性（元数据）
- 页面设置（页边距、纸张大小、方向）
- 更完善的回归测试与样例文档集
