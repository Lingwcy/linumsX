import { Agent } from '../../domain/agent/Agent.js';
import { ToolRegistry } from '../../domain/tools/registry.js';
import { ToolCategory, detectRequiredCategories, registerToolForCategory, loadToolsForCategories } from '../../domain/tools/loader.js';

// 文档类工具
import { getDocumentInfoTool } from '../../domain/tools/document/getInfo.js';
import { getDocumentTextTool } from '../../domain/tools/document/getText.js';
import { getDocumentOutlineTool } from '../../domain/tools/document/getOutline.js';
import { listAvailableDocumentsTool } from '../../domain/tools/document/listAvailableDocuments.js';
import { createDocumentTool } from '../../domain/tools/document/createDocument.js';

// 格式化类工具
import { formatTextTool } from '../../domain/tools/formatting/formatText.js';
import { formatParagraphTool } from '../../domain/tools/formatting/formatParagraph.js';
import { formatTableTool } from '../../domain/tools/formatting/formatTable.js';
import { createTableTool, formatTableBordersTool, tableRowColTools, tableMergeTools, applyTableStyleTool } from '../../domain/tools/formatting/index.js';

// 内容编辑类工具
import { searchReplaceTool } from '../../domain/tools/content/searchReplace.js';
import { addContentTool } from '../../domain/tools/content/addContent.js';
import { addHeadingTool } from '../../domain/tools/content/addHeading.js';
import { replaceBlockBetweenAnchorsTool } from '../../domain/tools/content/replaceBlockBetweenAnchors.js';

// 运行时类工具
import { bashTool, deleteFileTool, editFileTool, readFileTool, writeFileTool } from '../../domain/tools/runtime/index.js';

// 图片类工具
import { getListImagesTool, getAddImageTool, getDeleteImageTool, getResizeImageTool, getReplaceImageTool } from '../../domain/tools/image/index.js';

// 目录类工具
import { getGenerateTocTool, getUpdateTocTool, getDeleteTocTool } from '../../domain/tools/toc/index.js';

// 编号类工具
import { getAddNumberingTool, getGetNumberingTool, getRemoveNumberingTool } from '../../domain/tools/numbering/index.js';

// 页眉页脚类工具
import {
	getAddHeaderTool,
	getAddFooterTool,
	getGetHeadersFootersTool,
	getDeleteHeaderTool,
	getDeleteFooterTool,
	getAddPageNumberTool,
	getDeletePageNumberTool,
	getSetHeaderFooterOptionsTool,
} from '../../domain/tools/headerFooter/index.js';

// 公式类工具
import { getListFormulasTool, getGetFormulaTool, getAddFormulaTool, getEditFormulaTool, getDeleteFormulaTool } from '../../domain/tools/formula/index.js';

import { ConfigManager } from '../../infrastructure/config/ConfigManager.js';

interface CreateAgentOptions {
	persistConversation?: boolean;
	userInput?: string; // 用于意图识别
}

// 初始化工具分类映射
function initializeToolLoaders(): void {
	// 核心工具 - 始终加载
	registerToolForCategory(ToolCategory.CORE, () => getDocumentInfoTool);
	registerToolForCategory(ToolCategory.CORE, () => getDocumentTextTool);
	registerToolForCategory(ToolCategory.CORE, () => getDocumentOutlineTool);
	registerToolForCategory(ToolCategory.CORE, () => listAvailableDocumentsTool);

	// 文档类
	registerToolForCategory(ToolCategory.DOCUMENT, () => getDocumentInfoTool);
	registerToolForCategory(ToolCategory.DOCUMENT, () => getDocumentTextTool);
	registerToolForCategory(ToolCategory.DOCUMENT, () => getDocumentOutlineTool);
	registerToolForCategory(ToolCategory.DOCUMENT, () => listAvailableDocumentsTool);
	registerToolForCategory(ToolCategory.DOCUMENT, () => createDocumentTool);

	// 内容编辑类
	registerToolForCategory(ToolCategory.CONTENT, () => searchReplaceTool);
	registerToolForCategory(ToolCategory.CONTENT, () => addContentTool);
	registerToolForCategory(ToolCategory.CONTENT, () => addHeadingTool);
	registerToolForCategory(ToolCategory.CONTENT, () => replaceBlockBetweenAnchorsTool);

	// 格式化类
	registerToolForCategory(ToolCategory.FORMATTING, () => formatTextTool);
	registerToolForCategory(ToolCategory.FORMATTING, () => formatParagraphTool);
	registerToolForCategory(ToolCategory.FORMATTING, () => formatTableTool);
	registerToolForCategory(ToolCategory.FORMATTING, () => createTableTool);
	registerToolForCategory(ToolCategory.FORMATTING, () => formatTableBordersTool);
	for (const tool of tableRowColTools) {
		registerToolForCategory(ToolCategory.FORMATTING, () => tool);
	}
	for (const tool of tableMergeTools) {
		registerToolForCategory(ToolCategory.FORMATTING, () => tool);
	}
	registerToolForCategory(ToolCategory.FORMATTING, () => applyTableStyleTool);

	// 运行时类
	registerToolForCategory(ToolCategory.RUNTIME, () => readFileTool);
	registerToolForCategory(ToolCategory.RUNTIME, () => writeFileTool);
	registerToolForCategory(ToolCategory.RUNTIME, () => editFileTool);
	registerToolForCategory(ToolCategory.RUNTIME, () => deleteFileTool);
	registerToolForCategory(ToolCategory.RUNTIME, () => bashTool);

	// 图片类
	registerToolForCategory(ToolCategory.IMAGE, () => getListImagesTool());
	registerToolForCategory(ToolCategory.IMAGE, () => getAddImageTool());
	registerToolForCategory(ToolCategory.IMAGE, () => getDeleteImageTool());
	registerToolForCategory(ToolCategory.IMAGE, () => getResizeImageTool());
	registerToolForCategory(ToolCategory.IMAGE, () => getReplaceImageTool());

	// 目录类
	registerToolForCategory(ToolCategory.TOC, () => getGenerateTocTool());
	registerToolForCategory(ToolCategory.TOC, () => getUpdateTocTool());
	registerToolForCategory(ToolCategory.TOC, () => getDeleteTocTool());

	// 编号类
	registerToolForCategory(ToolCategory.NUMBERING, () => getAddNumberingTool());
	registerToolForCategory(ToolCategory.NUMBERING, () => getGetNumberingTool());
	registerToolForCategory(ToolCategory.NUMBERING, () => getRemoveNumberingTool());

	// 页眉页脚类
	registerToolForCategory(ToolCategory.HEADER_FOOTER, () => getAddHeaderTool());
	registerToolForCategory(ToolCategory.HEADER_FOOTER, () => getAddFooterTool());
	registerToolForCategory(ToolCategory.HEADER_FOOTER, () => getGetHeadersFootersTool());
	registerToolForCategory(ToolCategory.HEADER_FOOTER, () => getDeleteHeaderTool());
	registerToolForCategory(ToolCategory.HEADER_FOOTER, () => getDeleteFooterTool());
	registerToolForCategory(ToolCategory.HEADER_FOOTER, () => getAddPageNumberTool());
	registerToolForCategory(ToolCategory.HEADER_FOOTER, () => getDeletePageNumberTool());
	registerToolForCategory(ToolCategory.HEADER_FOOTER, () => getSetHeaderFooterOptionsTool());

	// 公式类工具
	registerToolForCategory(ToolCategory.FORMULA, () => getListFormulasTool());
	registerToolForCategory(ToolCategory.FORMULA, () => getGetFormulaTool());
	registerToolForCategory(ToolCategory.FORMULA, () => getAddFormulaTool());
	registerToolForCategory(ToolCategory.FORMULA, () => getEditFormulaTool());
	registerToolForCategory(ToolCategory.FORMULA, () => getDeleteFormulaTool());
}

// 标记是否已初始化
let toolLoadersInitialized = false;

export function createDefaultToolRegistry(options: CreateAgentOptions = {}): ToolRegistry {
	const registry = new ToolRegistry();

	// 确保工具加载器只初始化一次
	if (!toolLoadersInitialized) {
		initializeToolLoaders();
		toolLoadersInitialized = true;
	}

	// 根据用户输入意图识别需要加载的工具类别
	const userInput = options.userInput || '';
	const categories = detectRequiredCategories(userInput);

	// 加载对应类别的工具
	const tools = loadToolsForCategories(categories);
	for (const tool of tools) {
		registry.register(tool);
	}

	return registry;
}

// 保留完整加载函数，用于需要所有工具的场景
export function createFullToolRegistry(): ToolRegistry {
	const registry = new ToolRegistry();

	registry.register(getDocumentInfoTool);
	registry.register(getDocumentTextTool);
	registry.register(getDocumentOutlineTool);
	registry.register(readFileTool);
	registry.register(writeFileTool);
	registry.register(editFileTool);
	registry.register(deleteFileTool);
	registry.register(bashTool);
	registry.register(listAvailableDocumentsTool);
	registry.register(createDocumentTool);
	registry.register(formatTextTool);
	registry.register(formatParagraphTool);
	registry.register(formatTableTool);
	registry.register(createTableTool);
	registry.register(formatTableBordersTool);
	for (const tool of tableRowColTools) {
		registry.register(tool);
	}
	for (const tool of tableMergeTools) {
		registry.register(tool);
	}
	registry.register(applyTableStyleTool);
	registry.register(searchReplaceTool);
	registry.register(addContentTool);
	registry.register(addHeadingTool);
	registry.register(replaceBlockBetweenAnchorsTool);
	registry.register(getListImagesTool());
	registry.register(getAddImageTool());
	registry.register(getDeleteImageTool());
	registry.register(getResizeImageTool());
	registry.register(getReplaceImageTool());
	registry.register(getGenerateTocTool());
	registry.register(getUpdateTocTool());
	registry.register(getDeleteTocTool());
	registry.register(getAddNumberingTool());
	registry.register(getGetNumberingTool());
	registry.register(getRemoveNumberingTool());
	registry.register(getAddHeaderTool());
	registry.register(getAddFooterTool());
	registry.register(getGetHeadersFootersTool());
	registry.register(getDeleteHeaderTool());
	registry.register(getDeleteFooterTool());
	registry.register(getAddPageNumberTool());
	registry.register(getDeletePageNumberTool());
	registry.register(getSetHeaderFooterOptionsTool());

	return registry;
}

export function createConfiguredAgent(options: CreateAgentOptions = {}): Agent {
	const config = ConfigManager.load();
	const apiKey = config.model.apiKey || process.env.ANTHROPIC_API_KEY;

	if (!apiKey) {
		throw new Error('ANTHROPIC_API_KEY not set');
	}

	// 根据用户输入动态加载工具
	const registry = createDefaultToolRegistry({ userInput: options.userInput });

	return new Agent(registry, {
		temperature: config.agent.temperature,
		maxTokens: config.agent.maxTokens,
		persistConversation: options.persistConversation ?? false,
	});
}