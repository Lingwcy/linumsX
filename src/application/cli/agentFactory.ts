import { Agent } from '../../domain/agent/Agent.js';
import { ToolRegistry } from '../../domain/tools/registry.js';
import { getDocumentInfoTool } from '../../domain/tools/document/getInfo.js';
import { getDocumentTextTool } from '../../domain/tools/document/getText.js';
import { getDocumentOutlineTool } from '../../domain/tools/document/getOutline.js';
import { listAvailableDocumentsTool } from '../../domain/tools/document/listAvailableDocuments.js';
import { createDocumentTool } from '../../domain/tools/document/createDocument.js';
import { formatTextTool } from '../../domain/tools/formatting/formatText.js';
import { formatParagraphTool } from '../../domain/tools/formatting/formatParagraph.js';
import { formatTableTool } from '../../domain/tools/formatting/formatTable.js';
import { createTableTool, formatTableBordersTool, tableRowColTools, tableMergeTools, applyTableStyleTool } from '../../domain/tools/formatting/index.js';
import { searchReplaceTool } from '../../domain/tools/content/searchReplace.js';
import { addContentTool } from '../../domain/tools/content/addContent.js';
import { addHeadingTool } from '../../domain/tools/content/addHeading.js';
import { replaceBlockBetweenAnchorsTool } from '../../domain/tools/content/replaceBlockBetweenAnchors.js';
import { bashTool, deleteFileTool, editFileTool, readFileTool, writeFileTool } from '../../domain/tools/runtime/index.js';
import { getListImagesTool, getAddImageTool, getDeleteImageTool, getResizeImageTool, getReplaceImageTool } from '../../domain/tools/image/index.js';
import { ConfigManager } from '../../infrastructure/config/ConfigManager.js';

interface CreateAgentOptions {
	persistConversation?: boolean;
}

export function createDefaultToolRegistry(): ToolRegistry {
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

	return registry;
}

export function createConfiguredAgent(options: CreateAgentOptions = {}): Agent {
	const config = ConfigManager.load();
	const apiKey = config.model.apiKey || process.env.ANTHROPIC_API_KEY;

	if (!apiKey) {
		throw new Error('ANTHROPIC_API_KEY not set');
	}

	return new Agent(createDefaultToolRegistry(), {
		temperature: config.agent.temperature,
		maxTokens: config.agent.maxTokens,
		persistConversation: options.persistConversation ?? false,
	});
}