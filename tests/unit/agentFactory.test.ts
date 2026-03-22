import { describe, expect, it, vi } from 'vitest';
import { createConfiguredAgent, createDefaultToolRegistry, createFullToolRegistry } from '../../src/application/cli/agentFactory.js';
import { ConfigManager } from '../../src/infrastructure/config/ConfigManager.js';

describe('createDefaultToolRegistry', () => {
	it('registers tools dynamically based on user input', () => {
		// 测试空输入 - 只加载核心工具 + document
		const registry1 = createDefaultToolRegistry({ userInput: '' });
		const names1 = registry1.getAllDescriptions().map(tool => tool.name).sort();
		expect(names1).toContain('get_document_info');
		expect(names1).toContain('list_available_documents');

		// 测试图片相关输入 - 加载图片工具
		const registry2 = createDefaultToolRegistry({ userInput: '添加图片' });
		const names2 = registry2.getAllDescriptions().map(tool => tool.name).sort();
		expect(names2).toContain('add_image');
		expect(names2).toContain('list_images');

		// 测试目录相关输入 - 加载目录工具
		const registry3 = createDefaultToolRegistry({ userInput: '生成目录' });
		const names3 = registry3.getAllDescriptions().map(tool => tool.name).sort();
		expect(names3).toContain('generate_toc');
		expect(names3).toContain('update_toc');
	});

	it('createFullToolRegistry registers all tools', () => {
		const registry = createFullToolRegistry();
		const names = registry.getAllDescriptions().map(tool => tool.name).sort();

		expect(names).toEqual([
			'add_content',
			'add_footer',
			'add_header',
			'add_heading',
			'add_image',
			'add_numbering',
			'add_page_number',
			'add_table_column',
			'add_table_row',
			'apply_table_style',
			'bash',
			'create_document',
			'create_table',
			'delete_file',
			'delete_footer',
			'delete_header',
			'delete_image',
			'delete_page_number',
			'delete_table_column',
			'delete_table_row',
			'delete_toc',
			'edit_file',
			'format_paragraphs',
			'format_table_borders',
			'format_table_cells',
			'format_text',
			'generate_toc',
			'get_document_info',
			'get_document_outline',
			'get_document_text',
			'get_headers_footers',
			'get_numbering',
			'list_available_documents',
			'list_images',
			'merge_cells',
			'read_file',
			'remove_numbering',
			'replace_block_between_anchors',
			'replace_image',
			'resize_image',
			'search_and_replace',
			'set_header_footer_options',
			'unmerge_cells',
			'update_toc',
			'write_file',
		]);
	});

	it('keeps conversation stateless by default and enables it when requested', () => {
		vi.spyOn(ConfigManager, 'load').mockReturnValue({
			model: {
				apiKey: 'test-key',
				baseUrl: undefined,
				model: 'test-model',
				provider: 'anthropic',
			},
			agent: {
				temperature: 0,
				maxTokens: 1024,
			},
		} as any);

		const defaultAgent = createConfiguredAgent();
		const interactiveAgent = createConfiguredAgent({ persistConversation: true });

		expect((defaultAgent as any).config.persistConversation).toBe(false);
		expect((interactiveAgent as any).config.persistConversation).toBe(true);
	});
});