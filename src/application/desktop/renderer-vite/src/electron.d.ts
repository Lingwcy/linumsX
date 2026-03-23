export interface DocumentData {
  path: string;
  arrayBuffer?: ArrayBuffer;
  paragraphs: Array<{
    index: number;
    text: string;
    style?: string;
  }>;
  tables: Array<{
    rows: number;
    columns: number;
  }>;
  headings: Array<{
    level: number;
    text: string;
  }>;
  formulas: Array<{
    index: number;
    type: string;
    latex: string;
    paragraphIndex: number;
    imageName?: string;
    olePath?: string;
  }>;
}

export type AIChunkType =
  | 'start'       // 开始
  | 'chunk'        // 文本片段
  | 'state'        // 状态变化 (thinking, tool_use, responding)
  | 'tool_start'   // 工具开始
  | 'tool_result'  // 工具结果
  | 'done'         // 完成
  | 'error';       // 错误

export interface AIStateUpdate {
  state: 'idle' | 'thinking' | 'tool_use' | 'responding';
  summary: string;
  iteration?: number;
}

export interface AIToolEvent {
  name: string;
  summary: string;
  input?: object;
  success?: boolean;
  result?: unknown;
}

export interface AIChunkData {
  type: AIChunkType;
  content: string;  // JSON string for state/tool events, text for chunk
}

export interface ElectronAPI {
  // Document operations
  loadDocument: (filePath: string) => Promise<{ success: boolean }>;
  loadDocumentBuffer: (filePath: string) => Promise<{ success: boolean; error?: string }>;
  openDocument: () => Promise<{ success: boolean }>;
  getDocumentInfo: () => Promise<{ success: boolean; data?: any; error?: string }>;
  onDocumentLoaded: (callback: (data: DocumentData) => void) => () => void;
  onDocumentError: (callback: (error: { message: string }) => void) => () => void;

  // Selection operations
  sendSelection: (data: { paragraphIndex: number; text: string; isFormula: boolean }) => Promise<{ success: boolean }>;

  // AI chat operations
  chat: (message: string) => Promise<{ success: boolean; data?: string; error?: string }>;
  onAIChunk: (callback: (data: AIChunkData) => void) => () => void;
  explain: (text: string, isFormula: boolean) => Promise<{ success: boolean; data?: string; error?: string }>;
  copyAsLatex: (text: string) => Promise<{ success: boolean; data?: string; error?: string }>;

  // Window controls
  minimizeWindow: () => Promise<{ success: boolean }>;
  maximizeWindow: () => Promise<{ success: boolean; isMaximized?: boolean }>;
  closeWindow: () => Promise<{ success: boolean }>;
  isMaximized: () => Promise<{ success: boolean; isMaximized: boolean }>;

  // Config
  getConfig: () => Promise<{ success: boolean; data?: any; error?: string }>;
  setConfig: (config: any) => Promise<{ success: boolean; error?: string }>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
