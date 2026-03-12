# linumsX

<p align="center">
  <strong>Make .docx documents programmable, trackable, and automatable.</strong>
</p>

<p align="center">
  An AI-powered Word document agent built in TypeScript. It understands natural language instructions and reads, edits, and formats <code>.docx</code> documents through a tool chain.
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

## Why This Project

Traditional Word automation usually gets stuck at two extremes:

- **Too low-level**: directly manipulating XML or scripting.
- **Too black-box**: "let AI try" with hard-to-constrain behavior.

linumsX takes the third path:

- Give editing instructions in **natural language**.
- Execute specific actions with **explicit tools**.
- Manage the entire process with **testable, extensible TypeScript code**.

It's not a chatbot wrapper—it's a `.docx`-oriented agent execution system.

## Highlights

| Feature | Description |
| --- | --- |
| Document Understanding | Read paragraphs, metadata, heading outline, table structure |
| Content Editing | Append content, add headings, search & replace, anchor-based block replacement |
| Format Control | Text style, paragraph style, table style, table borders |
| Image Operations | Add, delete, resize, replace images in documents |
| Table of Contents | Generate, update, delete TOC from headings |
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
> Add a single-line black border to table 0
> Change all level-3 headings to blue and bold
> Append "Summary" heading and summary at the end
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
| `get_document_info` | Get paragraph count, table count, heading count |
| `get_document_text` | Read full document text |
| `get_document_outline` | Read heading structure |
| `list_available_documents` | List available Word documents in workspace |
| `create_document` | Create a new document |
| `list_images` | List all images in document |
| `add_image` | Add image to document |
| `delete_image` | Delete image from document |
| `resize_image` | Resize image |
| `replace_image` | Replace existing image |
| `generate_toc` | Generate table of contents |
| `update_toc` | Update existing TOC |
| `delete_toc` | Delete TOC |

### Content Tools

| Tool | Purpose |
| --- | --- |
| `add_content` | Add paragraphs or other content |
| `add_heading` | Add a heading |
| `search_and_replace` | Search and replace text |
| `replace_block_between_anchors` | Locate anchors and replace content |

### Formatting Tools

| Tool | Purpose |
| --- | --- |
| `format_text` | Font, size, color, bold, italic, underline |
| `format_paragraphs` | Alignment, indent, line spacing |
| `format_table_cells` | Table cell formatting |
| `create_table` | Create a table |
| `format_table_borders` | Fine-grained table border settings |
| `add_table_row` / `delete_table_row` | Table row management |
| `add_table_column` / `delete_table_column` | Table column management |
| `merge_cells` / `unmerge_cells` | Cell merge and split |
| `apply_table_style` | Preset styles (three-line table, code block) |

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
| `npx linumsx edit <doc> <instruction>` | Execute one-time edit |
| `npx agent-doc ...` | Legacy command alias |

## Architecture

The project uses a domain-driven layered design:

```
src/
├─ application/      CLI, Ink UI, command entry
├─ domain/           Agent orchestration, Document entities, tool system
├─ infrastructure/  AI client, configuration management
└─ shared/          Common errors and shared capabilities
```

### Core Design

| Layer | Responsibility |
| --- | --- |
| `domain/agent` | Manage conversation loop, tool invocation, context refresh |
| `domain/document` | Load `.docx`, extract paragraph/table/heading info |
| `domain/tools` | Define and register all tools |
| `infrastructure/ai` | Connect to model API |
| `infrastructure/config` | Read and validate config from `.env` |

## Development

```bash
npm run build        # Compile TypeScript
npm run test         # Run all tests
npm run test:watch   # Run tests in watch mode
npm run lint         # Lint source files
npm run format       # Format source files
```

Run a single test file:

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
- Let complex `.docx` processing capabilities accumulate as tools, not scattered in prompts.

## Roadmap Direction

- Richer table layouts and style strategies
- More stable context continuation and multi-turn task orchestration
- Finer control for paragraphs, numbering, headers and footers
- Better regression testing and sample document collection
