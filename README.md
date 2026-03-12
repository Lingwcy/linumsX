<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>linumsX</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            line-height: 1.6;
            max-width: 900px;
            margin: 0 auto;
            padding: 20px;
            color: #333;
        }
        .lang-switch {
            position: fixed;
            top: 20px;
            right: 20px;
            background: #f5f5f5;
            border: 1px solid #ddd;
            border-radius: 4px;
            padding: 8px 16px;
            cursor: pointer;
            font-size: 14px;
            z-index: 1000;
        }
        .lang-switch:hover {
            background: #eee;
        }
        [lang="zh"] { display: none; }
        :lang(zh) [lang="en"] { display: none; }
        :lang(zh) [lang="zh"] { display: block; }
        h1 { color: #1a1a1a; border-bottom: 2px solid #eee; padding-bottom: 10px; }
        h2 { color: #2a2a2a; margin-top: 30px; }
        h3 { color: #3a3a3a; }
        code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; font-size: 0.9em; }
        pre { background: #f4f4f4; padding: 15px; border-radius: 6px; overflow-x: auto; }
        table { border-collapse: collapse; width: 100%; margin: 15px 0; }
        th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
        th { background: #f5f5f5; }
        .highlight { background: #fff3cd; padding: 2px 4px; border-radius: 2px; }
        .mermaid { background: #f9f9f9; padding: 15px; border-radius: 6px; text-align: center; }
    </style>
</head>
<body>
    <button class="lang-switch" onclick="toggleLang()">中文 / English</button>

    <div lang="en">
        <h1>linumsX</h1>

        <p><strong>Make .docx documents programmable, trackable, and automatable.</strong></p>

        <p>An AI-powered Word document agent built in TypeScript. It understands natural language instructions and reads, edits, and formats `.docx` documents through a tool chain.</p>

        <p>
            <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.x-1f6feb?style=for-the-badge&logo=typescript&logoColor=white">
            <img alt="Node.js" src="https://img.shields.io/badge/Node.js-CLI-111111?style=for-the-badge&logo=nodedotjs&logoColor=3c873a">
            <img alt="Ink" src="https://img.shields.io/badge/Ink-Interactive_TUI-0b7285?style=for-the-badge">
            <img alt="Vitest" src="https://img.shields.io/badge/Tested_with-Vitest-6f42c1?style=for-the-badge&logo=vitest&logoColor=white">
            <img alt="Docx" src="https://img.shields.io/badge/Target-.docx-c2410c?style=for-the-badge">
        </p>

        ---

        ## Why This Project

        Traditional Word automation usually gets stuck at two extremes:

        - Too low-level: directly manipulating XML or scripting.
        - Too black-box: "let AI try" with hard-to-constrain behavior.

        linumsX takes the third path:

        - Give editing instructions in natural language.
        - Execute specific actions with explicit tools.
        - Manage the entire process with testable, extensible TypeScript code.

        It's not a chatbot wrapper—it's a `.docx`-oriented agent execution system.

        ## Highlights

        | Feature | Description |
        | --- | --- |
        | Document Understanding | Read paragraphs, metadata, heading outline, table structure |
        | Content Editing | Append content, add headings, search & replace, anchor-based block replacement |
        | Format Control | Text style, paragraph style, table style, table borders |
        | Table Enhancement | Create tables, add/delete rows/columns, cell merge/split, preset styles |
        | Interactive Mode | Ink-based terminal UI for continuous multi-turn editing |
        | Tool-Based Execution | All capabilities registered via Tool Registry for easy extension |
        | Layered Architecture | Clear separation: Domain / Application / Infrastructure |

        ## Demo

        ### Interactive Mode

        ```bash
        npm start
        ```

        ```text
        > load D:\docs\proposal.docx
        > Add a single-line black border to table 0, top 2pt, bottom 2pt, left/right 1pt, internal lines 0.5pt
        > Change table 0 border color to red, line style to double line
        > Append "Format Complete" heading and summary at the end
        ```

        ### One-Time Execution

        ```bash
        npx linumsx edit "D:\docs\proposal.docx" "Change all level-3 headings to blue and bold"
        ```

        ### View Document Info

        ```bash
        npx linumsx info "D:\docs\proposal.docx"
        ```

        ## Feature Surface

        ### Document Tools

        | Tool | Purpose |
        | --- | --- |
        | `get_document_info` | Get paragraph count, table count, heading count, etc. |
        | `get_document_text` | Read full document text |
        | `get_document_outline` | Read heading structure |
        | `list_available_documents` | List available Word documents in workspace |
        | `create_document` | Create a new document |
        | `list_images` | List all images in document |
        | `add_image` | Add image to document |
        | `delete_image` | Delete image from document |
        | `resize_image` | Resize image |
        | `replace_image` | Replace existing image |
        | `generate_toc` | Generate table of contents from headings |
        | `update_toc` | Update existing table of contents |
        | `delete_toc` | Delete table of contents |

        ### Content Tools

        | Tool | Purpose |
        | --- | --- |
        | `add_content` | Add paragraphs or other content |
        | `add_heading` | Add a heading |
        | `search_and_replace` | Search and replace text |
        | `replace_block_between_anchors` | Locate anchors and replace content between them |

        ### Formatting Tools

        | Tool | Purpose |
        | --- | --- |
        | `format_text` | Font, size, color, bold, italic, underline |
        | `format_paragraphs` | Alignment, indent, line spacing, etc. |
        | `format_table_cells` | Table cell formatting |
        | `create_table` | Create a table |
        | `format_table_borders` | Fine-grained table border settings |
        | `add_table_row` / `delete_table_row` | Table row management |
        | `add_table_column` / `delete_table_column` | Table column management |
        | `merge_cells` / `unmerge_cells` | Cell merge and split |
        | `apply_table_style` | Preset styles like three-line table, code block |

        ### Runtime Tools

        | Tool | Purpose |
        | --- | --- |
        | `read_file` | Read workspace file |
        | `write_file` | Write file |
        | `edit_file` | Exact text replacement |
        | `delete_file` | Delete file or directory |
        | `bash` | Execute command in workspace |

        ## Quick Start

        ### 1. Install Dependencies

        ```bash
        npm install
        ```

        ### 2. Configure Environment Variables

        ```bash
        copy .env.example .env
        ```

        Configure at least the following in `.env`:

        ```env
        ANTHROPIC_API_KEY=your-api-key-here
        ```

        Optional configurations:

        ```env
        MODEL_ID=claude-3-5-sonnet-20241022
        MAX_TOKENS=4096
        TEMPERATURE=0.7
        ```

        ### 3. Start Interactive UI

        ```bash
        npm start
        ```

        ## CLI Commands

        | Command | Description |
        | --- | --- |
        | `npm start` | Compile and start Ink interactive mode |
        | `npx linumsx ink` | Start Ink terminal UI |
        | `npx linumsx i` | Short for `ink` |
        | `npx linumsx interactive` | Start simple REPL mode |
        | `npx linumsx info <doc>` | View document metadata |
        | `npx linumsx edit <doc> <instruction>` | Execute one-time edit on document |
        | `npx agent-doc ...` | Legacy command alias, still works for compatibility |

        ## Example Workflows

        ### Unified Heading Style

        ```text
        Set all level-2 headings to dark blue, bold, 16pt, while keeping body text unchanged.
        ```

        ### Document Knowledge Base Organization

        ```text
        Organize this meeting minutes into a knowledge base structure: first create level-1 headings, then divide into level-2 headings by topic, finally add a summary.
        ```

        ### Table Beautification

        ```text
        Apply three-line table style to table 0, remove internal vertical lines, keep bottom border of header, and bold the header.
        ```

        ### Programmatic Replacement

        ```text
        Replace content between "Project Risks" and "Next Steps" anchors with the latest version, while preserving heading levels.
        ```

        ## Architecture

        The project uses a domain-driven layered design:

        ```text
        src/
        ├─ application/      CLI, Ink UI, command entry
        ├─ domain/          Agent orchestration, Document entities, tool system
        ├─ infrastructure/  AI client, configuration management
        └─ shared/          Common errors and shared capabilities
        ```

        ### Core Design

        | Layer | Responsibility |
        | --- | --- |
        | `domain/agent` | Manage conversation loop, tool invocation, context refresh |
        | `domain/document` | Load `.docx`, extract paragraph/table/heading info |
        | `domain/tools` | Define and register all document and runtime tools |
        | `infrastructure/ai` | Connect to model API |
        | `infrastructure/config` | Read and validate config from `.env` |

        ### Execution Flow

        ```mermaid
        flowchart LR
            A[User Instruction] --> B[Agent]
            B --> C[Tool Selection]
            C --> D[Document Tools]
            C --> E[Content Tools]
            C --> F[Formatting Tools]
            C --> G[Runtime Tools]
            D --> H[Docx XML Update]
            E --> H
            F --> H
            G --> I[Workspace Files]
            H --> J[Saved .docx]
            J --> B
        ```

        ## Development

        ```bash
        npm run build
        npm run test
        npm run test:watch
        npm run lint
        npm run format
        ```

        Unit test example:

        ```bash
        npx vitest run tests/unit/agent.test.ts
        ```

        ## Tech Stack

        | Technology | Usage |
        | --- | --- |
        | TypeScript | Core language |
        | Commander | CLI command parsing |
        | Ink + React | Terminal interactive UI |
        | adm-zip | Read and write `.docx` ZIP package |
        | xmldom | Manipulate Word XML |
        | Zod | Configuration validation |
        | Vitest | Unit testing |

        ## Project Goals

        - Let Word automation move beyond macro scripts and manual operations.
        - Give AI document editing controllable, extensible, testable engineering structure.
        - Let complex `.docx` processing capabilities be accumulated as tools, not scattered in prompts.

        ## Roadmap Direction

        - Richer table layouts and style strategies
        - More stable context continuation and multi-turn task orchestration
        - Finer control for paragraphs, numbering, headers and footers
        - Better regression testing and sample document collection
    </div>

    <div lang="zh">
        <h1>linumsX</h1>

        <p><strong>让 .docx 像代码一样可编排、可追踪、可自动化。</strong></p>

        <p>一个基于 TypeScript 的 AI Word 文档代理，理解自然语言指令，并通过工具链直接读取、编辑、格式化 `.docx` 文档。</p>

        <p>
            <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.x-1f6feb?style=for-the-badge&logo=typescript&logoColor=white">
            <img alt="Node.js" src="https://img.shields.io/badge/Node.js-CLI-111111?style=for-the-badge&logo=nodedotjs&logoColor=3c873a">
            <img alt="Ink" src="https://img.shields.io/badge/Ink-Interactive_TUI-0b7285?style=for-the-badge">
            <img alt="Vitest" src="https://img.shields.io/badge/Tested_with-Vitest-6f42c1?style=for-the-badge&logo=vitest&logoColor=white">
            <img alt="Docx" src="https://img.shields.io/badge/Target-.docx-c2410c?style=for-the-badge">
        </p>

        ---

        ## Why This Project

        传统 Word 自动化通常卡在两个极端：

        - 太底层，只能直接改 XML 或脚本拼装。
        - 太黑盒，只能"让 AI 试试看"，很难约束行为。

        linumsX 走的是第三条路：

        - 用自然语言下达编辑指令。
        - 用显式工具执行具体动作。
        - 用可测试、可扩展的 TypeScript 代码管理整个过程。

        它不是一个聊天机器人外壳，而是一套面向 `.docx` 的代理执行系统。

        ## Highlights

        | 能力 | 说明 |
        | --- | --- |
        | 文档理解 | 读取正文，元信息、标题大纲、表格结构 |
        | 内容编辑 | 追加内容、添加标题、搜索替换、锚点块替换 |
        | 格式控制 | 文本样式、段落样式、表格样式、表格边框 |
        | 表格增强 | 创建表格、增删行列、单元格合并/拆分、预设样式 |
        | 交互模式 | 提供 Ink 终端 UI，适合连续多轮编辑 |
        | 工具化执行 | 所有能力通过 Tool Registry 注册，便于扩展和测试 |
        | 分层架构 | Domain / Application / Infrastructure 清晰分离 |

        ## Demo

        ### 交互模式

        ```bash
        npm start
        ```

        ```text
        > load D:\docs\proposal.docx
        > 给表格0添加黑色单线边框，顶边2pt，底边2pt，左右1pt，内部线0.5pt
        > 把表格0边框颜色改成红色，线型设为双线
        > 在结尾追加"已完成格式整理"标题和一段总结
        ```

        ### 单次执行

        ```bash
        npx linumsx edit "D:\docs\proposal.docx" "将文档中的所有三级标题统一为蓝色并加粗"
        ```

        ### 查看文档信息

        ```bash
        npx linumsx info "D:\docs\proposal.docx"
        ```

        ## Feature Surface

        ### 文档工具

        | 工具 | 作用 |
        | --- | --- |
        | `get_document_info` | 获取段落数、表格数、标题数等信息 |
        | `get_document_text` | 读取文档全文 |
        | `get_document_outline` | 读取标题结构 |
        | `list_available_documents` | 列出工作区内可用 Word 文档 |
        | `create_document` | 创建新的文档 |
        | `list_images` | 列出文档中所有图像 |
        | `add_image` | 添加图像到文档 |
        | `delete_image` | 删除文档中的图像 |
        | `resize_image` | 修改图像尺寸 |
        | `replace_image` | 替换文档中的图像 |
        | `generate_toc` | 根据标题生成目录 |
        | `update_toc` | 更新目录 |
        | `delete_toc` | 删除目录 |

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
        | `format_text` | 字体、字号、颜色，粗体、斜体、下划线 |
        | `format_paragraphs` | 对齐、缩进、行距等段落格式 |
        | `format_table_cells` | 表格单元格格式化 |
        | `create_table` | 创建表格 |
        | `format_table_borders` | 细粒度设置表格边框 |
        | `add_table_row` / `delete_table_row` | 表格行管理 |
        | `add_table_column` / `delete_table_column` | 表格列管理 |
        | `merge_cells` / `unmerge_cells` | 单元格合并与拆分 |
        | `apply_table_style` | 三线表、代码块风格等预设样式 |

        ### Runtime 工具

        | 工具 | 作用 |
        | --- | --- |
        | `read_file` | 读取工作区文件 |
        | `write_file` | 写入文件 |
        | `edit_file` | 精确替换文本 |
        | `delete_file` | 删除文件或目录 |
        | `bash` | 在工作区内执行命令 |

        ## Quick Start

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

        ## CLI Commands

        | 命令 | 说明 |
        | --- | --- |
        | `npm start` | 编译并启动 Ink 交互模式 |
        | `npx linumsx ink` | 启动 Ink 终端 UI |
        | `npx linumsx i` | `ink` 的简写 |
        | `npx linumsx interactive` | 启动简易 REPL 模式 |
        | `npx linumsx info <doc>` | 查看文档元信息 |
        | `npx linumsx edit <doc> <instruction>` | 对文档执行一次性编辑 |
        | `npx agent-doc ...` | 旧命令别名，仍可用以兼容已有脚本 |

        ## Example Workflows

        ### 统一标题样式

        ```text
        把所有二级标题设置为深蓝色，加粗、16pt，并保持正文不变。
        ```

        ### 文档知识库整理

        ```text
        将这份会议纪要整理成知识库结构：先生成一级标题，再按主题分成二级标题，最后补充一段摘要。
        ```

        ### 表格美化

        ```text
        给表格0应用三线表样式，去掉内部竖线，保留表头底边，并把表头加粗。
        ```

        ### 程序化替换

        ```text
        把"项目风险"与"下一步计划"两个锚点之间的内容替换为最新版本，并保持原有标题层级。
        ```

        ## Architecture

        项目采用偏领域驱动的分层设计：

        ```text
        src/
        ├─ application/      CLI、Ink UI、命令入口
        ├─ domain/           Agent 编排、Document 实体、工具系统
        ├─ infrastructure/   AI 客户端、配置管理
        └─ shared/           通用错误与共享能力
        ```

        ### 核心设计思路

        | 层 | 职责 |
        | --- | --- |
        | `domain/agent` | 管理对话循环、工具调用、上下文刷新 |
        | `domain/document` | 加载 `.docx`、抽取段落/表格/标题信息 |
        | `domain/tools` | 定义并注册所有文档与运行时工具 |
        | `infrastructure/ai` | 对接模型 API |
        | `infrastructure/config` | 从 `.env` 读取并校验配置 |

        ### 执行流

        ```mermaid
        flowchart LR
            A[User Instruction] --> B[Agent]
            B --> C[Tool Selection]
            C --> D[Document Tools]
            C --> E[Content Tools]
            C --> F[Formatting Tools]
            C --> G[Runtime Tools]
            D --> H[Docx XML Update]
            E --> H
            F --> H
            G --> I[Workspace Files]
            H --> J[Saved .docx]
            J --> B
        ```

        ## Development

        ```bash
        npm run build
        npm run test
        npm run test:watch
        npm run lint
        npm run format
        ```

        单测示例：

        ```bash
        npx vitest run tests/unit/agent.test.ts
        ```

        ## Tech Stack

        | 技术 | 用途 |
        | --- | --- |
        | TypeScript | 核心语言 |
        | Commander | CLI 命令解析 |
        | Ink + React | 终端交互 UI |
        | adm-zip | 读取和写回 `.docx` ZIP 包 |
        | xmldom | 操作 Word XML |
        | Zod | 配置校验 |
        | Vitest | 单元测试 |

        ## Project Goals

        - 让 Word 自动化不再停留在宏脚本和手工操作之间。
        - 让 AI 编辑文档的行为具备可控、可扩展、可测试的工程结构。
        - 让复杂的 `.docx` 处理能力以工具形式沉淀，而不是散落在 prompt 里。

        ## Roadmap Direction

        - 更丰富的表格布局与样式策略
        - 更稳定的上下文延续与多轮任务编排
        - 更细粒度的段落、编号、页眉页脚控制
        - 更完善的回归测试与样例文档集
    </div>

    <script>
        function toggleLang() {
            const html = document.documentElement;
            if (html.getAttribute('lang') === 'en') {
                html.setAttribute('lang', 'zh');
                localStorage.setItem('lang', 'zh');
            } else {
                html.setAttribute('lang', 'en');
                localStorage.setItem('lang', 'en');
            }
        }

        // Load saved language preference
        const savedLang = localStorage.getItem('lang') || 'en';
        document.documentElement.setAttribute('lang', savedLang);
    </script>
</body>
</html>
