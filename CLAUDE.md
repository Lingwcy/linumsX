# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Agent Doc is an AI-powered Word document editing agent built in TypeScript. It uses an AI model (Anthropic) to understand user instructions and executes tool-based operations to read and edit .docx files.

## Commands

```bash
npm run build        # Compile TypeScript to JavaScript
npm start            # Build and run CLI with "ink" command
npm run test         # Run all tests with vitest
npm run test:watch   # Run tests in watch mode
npm run lint         # Lint source files with ESLint
npm run format       # Format source files with Prettier
```

Run a single test file:
```bash
npx vitest run tests/unit/agent.test.ts
```

## Architecture

The codebase follows **domain-driven design** with clear layer separation:

```
src/
├── domain/           # Core business logic (framework-agnostic)
│   ├── agent/        # AI agent orchestration
│   ├── document/     # Document entity
│   └── tools/        # Tool implementations (document, content, formatting, runtime)
├── application/      # Application layer
│   └── cli/          # CLI commands and Ink UI
├── infrastructure/   # External integrations
│   ├── ai/           # Anthropic API client
│   └── config/       # Configuration management
└── shared/           # Cross-cutting concerns
    └── errors/       # Error types
```

### Key Concepts

- **Agent**: Orchestrates AI conversation loop, tool execution, and document context. Uses Chinese system prompts by default.
- **ToolRegistry**: Manages available tools with name/description/schema registration
- **Tools**: Four categories - document (read operations), content (edit operations), formatting (style operations), runtime (file system)
- **Document Entity**: Loads .docx via adm-zip, parses XML to extract paragraphs, tables, and heading outlines
- **ConfigManager**: Loads settings from .env files, validates against Zod schema

### Tool Categories

| Category | Tools |
|----------|-------|
| document | get_info, get_text, get_outline, list_available_documents, create_document |
| content | add_content, add_heading, search_replace, replace_block_between_anchors |
| formatting | format_text, format_paragraphs, format_table |
| runtime | read_file, write_file, edit_file, delete_file, bash |

### CLI Commands

- `agent-doc edit <doc> <instruction>` - One-shot document editing
- `agent-doc info <doc>` - Show document metadata
- `agent-doc ink` / `agent-doc i` - Interactive mode with Ink UI
- `agent-doc interactive` - Legacy interactive mode (readline)

## Configuration

Environment variables (see `.env.example`):
- `ANTHROPIC_API_KEY` - Required API key
- `MODEL_ID` - Model identifier (default: claude-3-5-sonnet-20241022)
- `MAX_TOKENS` - Max response tokens (default: 4096)
- `TEMPERATURE` - Model temperature (default: 0.7)

## Testing

Tests use **vitest** with the Node environment. Test files are in `tests/unit/` and mirror the source structure.
