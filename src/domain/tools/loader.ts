import type { Tool } from './types.js';

// 工具分类配置
export const ToolCategory = {
	// 核心工具 - 始终加载
	CORE: 'core',
	// 文档读取
	DOCUMENT: 'document',
	// 内容编辑
	CONTENT: 'content',
	// 格式化
	FORMATTING: 'formatting',
	// 图片
	IMAGE: 'image',
	// 目录
	TOC: 'toc',
	// 编号
	NUMBERING: 'numbering',
	// 页眉页脚
	HEADER_FOOTER: 'headerFooter',
	// 运行时
	RUNTIME: 'runtime',
} as const;

export type ToolCategoryType = typeof ToolCategory[keyof typeof ToolCategory];

// 类型定义：工具加载器
type ToolLoader = () => Tool;

// 工具分类到关键词的映射
const categoryKeywords: Record<ToolCategoryType, string[]> = {
	[ToolCategory.CORE]: [
		// 核心工具始终加载，不需要关键词
	],
	[ToolCategory.DOCUMENT]: [
		'document', '文档', '信息', '内容', '文本', '大纲', '结构',
		'查看', '读取', '打开', '获取', '列出', '创建', '新建',
		'get', 'info', 'text', 'outline', 'read', 'list', 'create',
		'技术分析', '报告', '总结', '文章', '写作', '编写', '撰写',
	],
	[ToolCategory.CONTENT]: [
		'content', '内容', '添加', '插入', '删除', '修改', '编辑', '写',
		'replace', 'search', '替换', '搜索', 'heading', '标题', '段落',
		'add', 'insert', 'delete', 'remove', 'anchor', '锚点',
	],
	[ToolCategory.FORMATTING]: [
		'format', '格式化', '样式', '风格', '字体', '颜色', '对齐',
		'table', '表格', '边框', '单元格', '行', '列', '合并',
		'bold', 'italic', 'underline', 'size', 'background', '背景',
		'style', 'align', 'indent', 'spacing', '行距', '缩进',
	],
	[ToolCategory.IMAGE]: [
		'image', '图片', '图像', '照片', '图形',
		'picture', 'photo', '添加图片', '删除图片', '修改图片',
		'replace', 'resize', '尺寸', '大小',
	],
	[ToolCategory.TOC]: [
		'toc', '目录', 'table of contents', '大纲',
		'generate', 'update', 'delete', '生成', '更新', '删除',
	],
	[ToolCategory.NUMBERING]: [
		'numbering', '编号', '列表', '序号',
		'number', 'list', 'bullet', '有序', '无序',
		'add', 'remove', 'get', '添加', '移除', '获取',
	],
	[ToolCategory.HEADER_FOOTER]: [
		'header', '页眉', 'footer', '页脚',
		'page number', '页码', 'pagination',
		'add', 'delete', 'remove', 'set', '设置',
	],
	[ToolCategory.RUNTIME]: [
		'file', '文件', 'read', 'write', 'read file', 'write file',
		'bash', 'command', 'shell', '终端', '命令行',
		'edit', 'delete', '删除文件', '读取文件', '写入文件',
		'项目', '目录', '文件夹', '路径', '查看', '浏览',
		'分析', '了解', '扫描', '检查', '当前',
	],
};

// 意图识别函数
export function detectRequiredCategories(userInput: string): Set<ToolCategoryType> {
	const input = userInput.toLowerCase();
	const matchedCategories = new Set<ToolCategoryType>();

	// 始终包含核心工具
	matchedCategories.add(ToolCategory.CORE);

	// 遍历所有类别，检测关键词匹配
	for (const [category, keywords] of Object.entries(categoryKeywords)) {
		if (category === ToolCategory.CORE) continue;

		for (const keyword of keywords) {
			// 对中文关键词不做 toLowerCase 处理
			const searchKeyword = /[\u4e00-\u9fa5]/.test(keyword) ? keyword : keyword.toLowerCase();
			if (input.includes(searchKeyword)) {
				matchedCategories.add(category as ToolCategoryType);
				break;
			}
		}
	}

	// CONTENT 和 RUNTIME 通常需要一起加载（编辑内容时可能需要文件操作）
	if (matchedCategories.has(ToolCategory.CONTENT)) {
		matchedCategories.add(ToolCategory.RUNTIME);
	}

	// 如果没有匹配到任何类别，默认加载文档类工具
	if (matchedCategories.size <= 1) {
		matchedCategories.add(ToolCategory.DOCUMENT);
		matchedCategories.add(ToolCategory.RUNTIME); // 也加载 runtime 工具
	}

	return matchedCategories;
}

// 工具分类映射 - 存储各类别的工具加载器
const categoryToolLoaders: Record<ToolCategoryType, ToolLoader[]> = {
	[ToolCategory.CORE]: [],
	[ToolCategory.DOCUMENT]: [],
	[ToolCategory.CONTENT]: [],
	[ToolCategory.FORMATTING]: [],
	[ToolCategory.IMAGE]: [],
	[ToolCategory.TOC]: [],
	[ToolCategory.NUMBERING]: [],
	[ToolCategory.HEADER_FOOTER]: [],
	[ToolCategory.RUNTIME]: [],
};

// 注册工具到分类
export function registerToolForCategory(category: ToolCategoryType, loader: ToolLoader): void {
	if (!categoryToolLoaders[category]) {
		categoryToolLoaders[category] = [];
	}
	categoryToolLoaders[category].push(loader);
}

// 根据类别加载工具（自动去重）
export function loadToolsForCategories(categories: Set<ToolCategoryType>): Tool[] {
	const toolMap = new Map<string, Tool>();
	const addedNames = new Set<string>();

	// 按优先级加载：core -> 其他类别（后面的会覆盖前面的同名工具）
	const categoryOrder: ToolCategoryType[] = [
		ToolCategory.CORE,
		ToolCategory.DOCUMENT,
		ToolCategory.CONTENT,
		ToolCategory.FORMATTING,
		ToolCategory.IMAGE,
		ToolCategory.TOC,
		ToolCategory.NUMBERING,
		ToolCategory.HEADER_FOOTER,
		ToolCategory.RUNTIME,
	];

	for (const category of categoryOrder) {
		if (!categories.has(category)) continue;

		const loaders = categoryToolLoaders[category];
		if (loaders) {
			for (const loader of loaders) {
				const tool = loader();
				// 只添加尚未注册的同名工具
				if (!addedNames.has(tool.name)) {
					toolMap.set(tool.name, tool);
					addedNames.add(tool.name);
				}
			}
		}
	}

	return Array.from(toolMap.values());
}

// 获取所有可用的类别
export function getAvailableCategories(): ToolCategoryType[] {
	return Object.values(ToolCategory);
}
