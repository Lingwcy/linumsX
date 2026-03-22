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
  onAIChunk: (callback: (data: { type: string; content: string }) => void) => () => void;
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
