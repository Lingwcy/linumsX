// src/application/desktop/main.ts
import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import log from 'electron-log';

// ESM __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import domain modules
import { Document } from '../../domain/document/entities/Document.js';
import { ToolRegistry } from '../../domain/tools/registry.js';
import { createDefaultToolRegistry } from '../cli/agentFactory.js';
import { Agent } from '../../domain/agent/Agent.js';
import { ConfigManager } from '../../infrastructure/config/ConfigManager.js';
import { loadDocxXml } from '../../domain/tools/shared/docxXml.js';
import { parseOleFormulas, parseImageFormulas, parseUnicodeMath } from '../../domain/tools/formula/listFormulas.js';
import { parseOmmlElements, ommlToLatex } from '../../domain/tools/formula/ommlToLatex.js';
import { SSEWriter } from '../../infrastructure/ai/SSEWriter.js';
import { StreamingHandler } from '../../infrastructure/ai/StreamingHandler.js';

// Configure logging
log.transports.file.level = 'info';
log.transports.console.level = 'debug';
log.info('Application starting...');

// Global exception handler
process.on('uncaughtException', (error) => {
  log.error('Uncaught Exception:', error);
  app.exit(1);
});

process.on('unhandledRejection', (reason) => {
  log.error('Unhandled Rejection:', reason);
});

let mainWindow: BrowserWindow | null = null;
let currentDocument: Document | null = null;
let currentAgent: Agent | null = null;

function createWindow(): void {
  log.info('Creating main window...');

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
    backgroundColor: '#ffffff',
  });

  // Create application menu
  const menuTemplate: Electron.MenuItemConstructorOptions[] = [
    {
      label: '文件',
      submenu: [
        {
          label: '打开文档',
          accelerator: 'CmdOrCtrl+O',
          click: () => openDocument(),
        },
        { type: 'separator' },
        {
          label: '退出',
          accelerator: 'CmdOrCtrl+Q',
          click: () => app.quit(),
        },
      ],
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);

  // Load the Vite renderer HTML
  const htmlPath = path.join(__dirname, '..', '..', 'renderer-vite', 'index.html');
  log.info('Loading HTML from:', htmlPath);

  mainWindow.loadFile(htmlPath).then(() => {
    log.info('HTML loaded successfully');
  }).catch((error) => {
    log.error('Failed to load HTML:', error);
  });

  // Handle renderer errors
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    log.error('Failed to load:', errorCode, errorDescription);
  });

  // Preload script errors
  mainWindow.webContents.on('preload-error', (_event, preloadPath, error) => {
    log.error('Preload error:', preloadPath, error);
  });

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    log.error('Renderer process gone:', details);
  });

  mainWindow.webContents.on('crashed', () => {
    log.error('Renderer crashed');
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    log.info('Main window shown');
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function openDocument(): Promise<void> {
  if (!mainWindow) return;

  const result = await dialog.showOpenDialog(mainWindow, {
    title: '选择 Word 文档',
    filters: [
      { name: 'Word 文档', extensions: ['docx'] },
      { name: '所有文件', extensions: ['*'] },
    ],
    properties: ['openFile'],
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const filePath = result.filePaths[0];
    await loadDocument(filePath);
  }
}

async function loadDocument(filePath: string): Promise<void> {
  log.info('Loading document:', filePath);

  try {
    // Read file as Buffer and convert to ArrayBuffer
    const buffer = await fs.promises.readFile(filePath);
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

    // Load document using existing Document entity
    const doc = new Document(filePath);
    await doc.load();
    currentDocument = doc;

    // Get formula information
    const loaded = loadDocxXml(filePath);
    const formulas = getFormulas(loaded);

    // Send document data to renderer
    if (mainWindow) {
      mainWindow.webContents.send('doc:loaded', {
        path: filePath,
        arrayBuffer,
        paragraphs: doc.paragraphs.map((p, i) => ({
          index: i,
          text: p.text,
          style: p.style,
        })),
        tables: doc.tables,
        headings: doc.headingOutline,
        formulas,
      });
    }

    log.info('Document loaded successfully, paragraphs:', doc.paragraphs.length, 'formulas:', formulas.length);
  } catch (error) {
    log.error('Failed to load document:', error);
    if (mainWindow) {
      mainWindow.webContents.send('doc:error', {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

function getFormulas(loaded: ReturnType<typeof loadDocxXml>): any[] {
  const formulas: any[] = [];

  // Get all paragraphs to find formula positions
  const paragraphs = loaded.xmlDocument.getElementsByTagName('w:p');
  const paragraphMap = new Map<any, number>();
  for (let i = 0; i < paragraphs.length; i++) {
    paragraphMap.set(paragraphs[i], i);
  }

  // Parse OMML formulas
  const ommlElements = parseOmmlElements(loaded.xmlDocument);
  for (let i = 0; i < ommlElements.length; i++) {
    const omml = ommlElements[i];
    const latex = ommlToLatex(omml);

    let parent = omml.parentNode;
    let paragraphIndex = -1;
    while (parent) {
      if (paragraphMap.has(parent)) {
        paragraphIndex = paragraphMap.get(parent) || -1;
        break;
      }
      parent = parent.parentNode;
    }

    formulas.push({
      index: formulas.length,
      type: 'omml',
      latex,
      paragraphIndex,
    });
  }

  // Add MathType OLE formulas
  const oleFormulas = parseOleFormulas(loaded);
  for (const ole of oleFormulas) {
    formulas.push({
      index: formulas.length,
      ...ole,
    });
  }

  // Add image formulas
  const imageFormulas = parseImageFormulas(loaded);
  for (const img of imageFormulas) {
    formulas.push({
      index: formulas.length,
      ...img,
    });
  }

  // Add Unicode math symbols
  const unicodeFormulas = parseUnicodeMath(loaded);
  for (const uni of unicodeFormulas) {
    formulas.push({
      index: formulas.length,
      ...uni,
    });
  }

  return formulas;
}

// IPC Handlers
ipcMain.handle('doc:load', async (_event, filePath: string) => {
  await loadDocument(filePath);
  return { success: true };
});

ipcMain.handle('doc:loadBuffer', async (_event, filePath: string) => {
  log.info('Loading document buffer:', filePath);

  try {
    // Read file as Buffer and convert to ArrayBuffer
    const buffer = await fs.promises.readFile(filePath);
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

    // Also load document metadata
    const doc = new Document(filePath);
    await doc.load();
    currentDocument = doc;

    // Get formula information
    const loaded = loadDocxXml(filePath);
    const formulas = getFormulas(loaded);

    // Send document data and buffer to renderer
    if (mainWindow) {
      mainWindow.webContents.send('doc:loaded', {
        path: filePath,
        arrayBuffer,
        paragraphs: doc.paragraphs.map((p, i) => ({
          index: i,
          text: p.text,
          style: p.style,
        })),
        tables: doc.tables,
        headings: doc.headingOutline,
        formulas,
      });
    }

    log.info('Document buffer loaded successfully');
    return { success: true };
  } catch (error) {
    log.error('Failed to load document buffer:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('doc:open', async () => {
  await openDocument();
  return { success: true };
});

ipcMain.handle('doc:getInfo', async () => {
  if (!currentDocument) {
    return { success: false, error: 'No document loaded' };
  }

  return {
    success: true,
    data: {
      path: currentDocument.path,
      paragraphs: currentDocument.paragraphs.length,
      tables: currentDocument.tables.length,
      headings: currentDocument.headingOutline.length,
    },
  };
});

ipcMain.handle('selection:changed', async (_event, data: { paragraphIndex: number; text: string; isFormula: boolean }) => {
  log.info('Selection changed:', data);
  return { success: true };
});

ipcMain.handle('ai:chat', async (_event, message: string) => {
  log.info('AI chat request:', message);

  if (!currentDocument) {
    return { success: false, error: 'No document loaded' };
  }

  try {
    // Create agent if not exists
    if (!currentAgent) {
      const registry = createDefaultToolRegistry();
      currentAgent = new Agent(registry, {
        persistConversation: true,
      });
      await currentAgent.loadDocument(currentDocument.path);
    }

    // Create SSE writer and streaming handler
    const sseWriter = new SSEWriter(mainWindow);
    const streamingHandler = new StreamingHandler(sseWriter);

    // Send start event
    if (mainWindow) {
      mainWindow.webContents.send('ai:chunk', { type: 'start', content: '' });
    }

    // Run with streaming
    const result = await streamingHandler.runWithStreaming(currentAgent, message, {
      onAnswer: (text: string) => {
        // Text is already sent via SSE writer
      },
      onComplete: () => {
        // Already sent via SSE writer
      },
      onError: (error: string) => {
        // Already sent via SSE writer
      },
    });

    // Send done event (for compatibility)
    if (mainWindow) {
      mainWindow.webContents.send('ai:chunk', { type: 'done', content: result });
    }

    return { success: true, data: result };
  } catch (error) {
    log.error('AI chat error:', error);
    // Send error event
    if (mainWindow) {
      mainWindow.webContents.send('ai:chunk', {
        type: 'error',
        content: error instanceof Error ? error.message : String(error)
      });
    }
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('ai:explain', async (_event, text: string, isFormula: boolean) => {
  log.info('AI explain request:', { text, isFormula });

  if (!currentDocument) {
    return { success: false, error: 'No document loaded' };
  }

  try {
    const registry = createDefaultToolRegistry();
    const agent = new Agent(registry);

    await agent.loadDocument(currentDocument.path);

    const instruction = isFormula
      ? `解释以下公式: ${text}`
      : `解释以下选中内容: ${text}`;

    const result = await agent.run(instruction);

    return { success: true, data: result };
  } catch (error) {
    log.error('AI explain error:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('ai:copyAsLatex', async (_event, text: string) => {
  log.info('Copy as LaTeX request:', text);

  if (!currentDocument) {
    return { success: false, error: 'No document loaded' };
  }

  try {
    const registry = createDefaultToolRegistry();
    const agent = new Agent(registry);

    await agent.loadDocument(currentDocument.path);

    const result = await agent.run(`将以下内容转换为 LaTeX 格式: ${text}`);

    return { success: true, data: result };
  } catch (error) {
    log.error('Copy as LaTeX error:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
});

// Config handlers
ipcMain.handle('config:get', async () => {
  try {
    const config = ConfigManager.loadUserConfig();
    return { success: true, data: config };
  } catch (error) {
    log.error('Failed to get config:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('config:set', async (_event, config: any) => {
  try {
    ConfigManager.saveUserConfig(config);
    // Reload agent with new config
    currentAgent = null;
    return { success: true };
  } catch (error) {
    log.error('Failed to save config:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

// Window control handlers
ipcMain.handle('window:minimize', async () => {
  mainWindow?.minimize();
  return { success: true };
});

ipcMain.handle('window:maximize', async () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
  return { success: true, isMaximized: mainWindow?.isMaximized() };
});

ipcMain.handle('window:close', async () => {
  mainWindow?.close();
  return { success: true };
});

ipcMain.handle('window:isMaximized', async () => {
  return { success: true, isMaximized: mainWindow?.isMaximized() || false };
});

// App lifecycle
app.whenReady().then(() => {
  log.info('App ready, creating window...');
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  log.info('All windows closed');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  log.info('Application quitting...');
});
