import { useState, useEffect, useCallback, useRef } from 'react';
import {
  FileText,
  Settings,
  FolderOpen,
  Sparkles,
  X,
  Send,
  Copy,
  Lightbulb,
  Minus,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './components/ui/dropdown-menu';
import { ScrollArea } from './components/ui/scroll-area';
import { TooltipProvider } from './components/ui/tooltip';
import { DocxViewer } from './components/DocxViewer';
import { MessageContent } from './components/MessageContent';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './components/ui/dialog';

// Types
interface DocumentData {
  path: string;
  arrayBuffer?: ArrayBuffer;
  paragraphs: Array<{ index: number; text: string; style?: string }>;
  tables: Array<{ rows: number; columns: number }>;
  headings: Array<{ level: number; text: string }>;
  formulas: Array<{ index: number; type: string; latex: string; paragraphIndex: number }>;
}

interface ChatMessage {
  type: 'user' | 'ai';
  content: string;
}

interface ModelConfigState {
  provider: string;
  apiKey: string;
  baseUrl: string;
  model: string;
}

function App() {
  // State
  const [documentData, setDocumentData] = useState<DocumentData | null>(null);
  const [arrayBuffer, setArrayBuffer] = useState<ArrayBuffer | null>(null);
  const [selectedParagraphs, setSelectedParagraphs] = useState<number[]>([]);
  const [selectedText, setSelectedText] = useState<string>('');
  const [showChat, setShowChat] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [modelConfig, setModelConfig] = useState<ModelConfigState>({
    provider: 'anthropic',
    apiKey: '',
    baseUrl: '',
    model: 'claude-3-5-sonnet-20241022',
  });
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    paragraphIndex?: number;
    text: string;
    isFormula: boolean;
    isFreeSelection?: boolean;
  } | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [aiPhase, setAiPhase] = useState<'idle' | 'thinking' | 'tool_use' | 'responding'>('idle');
  const [aiSummary, setAiSummary] = useState('');
  const [activeTools, setActiveTools] = useState<Array<{
    name: string;
    summary: string;
    status: 'running' | 'completed' | 'failed';
  }>>([]);
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Listen for document loaded event
  useEffect(() => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      const cleanup = window.electronAPI.onDocumentLoaded((data: DocumentData) => {
        setDocumentData(data);
        setArrayBuffer(data.arrayBuffer || null);
        setSelectedParagraphs([]);
        setSelectedText('');
      });

      return cleanup;
    }
  }, []);

  // Listen for document error event
  useEffect(() => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      const cleanup = window.electronAPI.onDocumentError((error: { message: string }) => {
        alert('加载文档失败: ' + error.message);
      });

      return cleanup;
    }
  }, []);

  // Listen for AI streaming chunks
  useEffect(() => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      const cleanup = window.electronAPI.onAIChunk((data) => {
        if (data.type === 'chunk') {
          setStreamingContent(prev => prev + data.content);
        } else if (data.type === 'done') {
          // Final content, update the messages
          setChatMessages(prev => {
            const newMessages = [...prev];
            const lastIndex = newMessages.length - 1;
            if (lastIndex >= 0 && newMessages[lastIndex].type === 'ai') {
              newMessages[lastIndex] = { ...newMessages[lastIndex], content: data.content };
            }
            return newMessages;
          });
          setStreamingContent('');
          setAiPhase('idle');
          setAiSummary('');
          setActiveTools([]);
          setIsLoading(false);
        } else if (data.type === 'error') {
          setChatMessages(prev => [...prev, {
            type: 'ai',
            content: 'Error: ' + data.content
          }]);
          setStreamingContent('');
          setAiPhase('idle');
          setAiSummary('');
          setActiveTools([]);
          setIsLoading(false);
        } else if (data.type === 'start') {
          // Start of streaming, add a placeholder message
          setChatMessages(prev => [...prev, { type: 'ai', content: '' }]);
          setAiPhase('thinking');
          setAiSummary('正在思考...');
        } else if (data.type === 'state') {
          // State change: thinking, tool_use, responding
          try {
            const stateData = JSON.parse(data.content);
            setAiPhase(stateData.state);
            setAiSummary(stateData.summary || '');
          } catch (e) {
            console.error('Failed to parse state:', e);
          }
        } else if (data.type === 'tool_start') {
          // Tool start event
          try {
            const toolData = JSON.parse(data.content);
            setActiveTools(prev => [...prev, {
              name: toolData.name,
              summary: toolData.summary,
              status: 'running'
            }]);
            setAiPhase('tool_use');
            setAiSummary(`正在执行工具: ${toolData.name}`);
          } catch (e) {
            console.error('Failed to parse tool_start:', e);
          }
        } else if (data.type === 'tool_result') {
          // Tool result event
          try {
            const toolData = JSON.parse(data.content);
            setActiveTools(prev => prev.map(t =>
              t.name === toolData.name
                ? { ...t, summary: toolData.summary, status: toolData.success ? 'completed' : 'failed' }
                : t
            ));
          } catch (e) {
            console.error('Failed to parse tool_result:', e);
          }
        }
      });

      return cleanup;
    }
  }, []);

  // Handle click outside context menu
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  // Check initial maximized state
  useEffect(() => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.isMaximized().then(result => {
        setIsMaximized(result.isMaximized);
      });
    }
  }, []);

  // Load config on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.getConfig().then(result => {
        if (result.success && result.data?.model) {
          setModelConfig({
            provider: result.data.model.provider || 'anthropic',
            apiKey: result.data.model.apiKey || '',
            baseUrl: result.data.model.baseUrl || '',
            model: result.data.model.model || 'claude-3-5-sonnet-20241022',
          });
        }
      });
    }
  }, []);

  const handleMinimize = () => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.minimizeWindow();
    }
  };

  const handleMaximize = async () => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      const result = await window.electronAPI.maximizeWindow();
      setIsMaximized(result.isMaximized || false);
    }
  };

  const handleClose = () => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.closeWindow();
    }
  };

  // Sidebar resize handlers
  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const stopResize = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback((e: MouseEvent) => {
    if (isResizing && sidebarRef.current) {
      const containerRect = sidebarRef.current.parentElement?.getBoundingClientRect();
      if (containerRect) {
        const newWidth = containerRect.right - e.clientX;
        setSidebarWidth(Math.max(200, Math.min(600, newWidth)));
      }
    }
  }, [isResizing]);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', resize);
      window.addEventListener('mouseup', stopResize);
    }
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResize);
    };
  }, [isResizing, resize, stopResize]);

  const handleOpenDocument = async () => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      await window.electronAPI.openDocument();
    }
  };

  const handleParagraphClick = (index: number, e: React.MouseEvent) => {
    if (e.shiftKey) {
      setSelectedParagraphs(prev => {
        if (prev.includes(index)) {
          return prev.filter(i => i !== index);
        }
        return [...prev, index].sort((a, b) => a - b);
      });
    } else {
      setSelectedParagraphs([index]);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, paragraphIndex: number) => {
    e.preventDefault();
    const text = documentData?.paragraphs[paragraphIndex]?.text || '';
    const formula = documentData?.formulas.find(f => f.paragraphIndex === paragraphIndex);

    setSelectedParagraphs([paragraphIndex]);
    setSelectedText('');
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      paragraphIndex,
      text,
      isFormula: !!formula,
      isFreeSelection: false,
    });
  };

  // Handle free text selection from DocxViewer
  const handleSelectionChange = useCallback((text: string, _isFormula: boolean) => {
    setSelectedText(text);
    setSelectedParagraphs([]);
  }, []);

  // Handle right-click on free selection
  const handleFreeSelectionContextMenu = useCallback((e: React.MouseEvent) => {
    if (!selectedText) return;

    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      text: selectedText,
      isFormula: false, // Will be detected by context menu handler
      isFreeSelection: true,
    });
  }, [selectedText]);

  const handleExplain = async () => {
    if (!contextMenu) return;

    setShowChat(true);
    const text = contextMenu.text;
    const isFormula = contextMenu.isFormula;

    setChatMessages(prev => [...prev, {
      type: 'user',
      content: isFormula ? `解释公式: ${text}` : `解释: ${text}`,
    }]);

    setContextMenu(null);
    await sendToAI(isFormula ? `解释以下公式: ${text}` : `解释以下选中内容: ${text}`);
  };

  const handleCopyAsLatex = async () => {
    if (!contextMenu || !window.electronAPI) return;

    setIsLoading(true);
    try {
      const result = await window.electronAPI.copyAsLatex(contextMenu.text);
      if (result.success) {
        setShowChat(true);
        setChatMessages(prev => [...prev, {
          type: 'ai',
          content: `LaTeX 格式:\n${result.data}`,
        }]);
      } else {
        alert('转换失败: ' + result.error);
      }
    } catch (error) {
      alert('转换失败: ' + (error as Error).message);
    }
    setIsLoading(false);
    setContextMenu(null);
  };

  const sendToAI = async (message: string) => {
    if (!window.electronAPI) return;

    // Clear any previous streaming content
    setStreamingContent('');
    setIsLoading(true);

    try {
      // Call chat API - streaming will be handled by the onAIChunk listener
      const result = await window.electronAPI.chat(message);

      // This should rarely be reached since streaming handles most cases
      if (!result.success) {
        setChatMessages(prev => [...prev, { type: 'ai', content: '错误: ' + result.error }]);
        setIsLoading(false);
      }
    } catch (error) {
      setChatMessages(prev => [...prev, { type: 'ai', content: '错误: ' + (error as Error).message }]);
      setIsLoading(false);
    }
  };

  const handleChatSend = async () => {
    if (!chatInput.trim() || isLoading) return;

    const userMessage = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { type: 'user', content: userMessage }]);

    await sendToAI(userMessage);
  };

  const handleSaveSettings = async () => {
    if (!window.electronAPI) {
      return;
    }

    const payload = {
      model: {
        provider: modelConfig.provider.trim(),
        apiKey: modelConfig.apiKey.trim() || undefined,
        baseUrl: modelConfig.baseUrl.trim() || undefined,
        model: modelConfig.model.trim(),
      },
    };

    const result = await window.electronAPI.setConfig(payload);
    if (!result.success) {
      alert(`保存设置失败: ${result.error || '未知错误'}`);
      return;
    }

    setShowSettings(false);
  };

  const getParagraphStyle = (style?: string) => {
    if (!style) return '';
    if (style.startsWith('Heading')) {
      return `heading${style.replace('Heading', '')}`;
    }
    return '';
  };

  const isFormula = (paragraphIndex: number) => {
    return documentData?.formulas?.some(f => f.paragraphIndex === paragraphIndex);
  };

  // Render paragraph
  const renderParagraph = (para: { index: number; text: string; style?: string }, idx: number) => {
    const isSelected = selectedParagraphs.includes(idx);
    const isFormulaPara = isFormula(idx);
    const styleClass = getParagraphStyle(para.style);

    return (
      <div
        key={idx}
        className={`paragraph ${styleClass} ${isSelected ? 'selected' : ''} ${isFormulaPara ? 'formula' : ''}`}
        onClick={(e) => handleParagraphClick(idx, e)}
        onContextMenu={(e) => handleContextMenu(e, idx)}
        data-paragraph-index={idx}
      >
        {para.text || '\u00A0'}
      </div>
    );
  };

  // Empty state
  const renderEmptyState = () => (
    <div className="flex flex-col items-center justify-center h-full text-center p-8">
      <FileText size={64} className="text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold mb-2">未加载文档</h3>
      <p className="text-muted-foreground mb-4">点击"打开文档"按钮选择 Word 文档</p>
      <Button onClick={handleOpenDocument} className="gap-2">
        <FolderOpen size={18} />
        打开文档
      </Button>
    </div>
  );

  return (
    <TooltipProvider>
      <div className="flex h-screen bg-background overflow-hidden">
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Custom Title Bar */}
          <header
            className="h-12 border-b flex items-center justify-between px-4 bg-gradient-to-r from-slate-900 to-slate-800 text-white"
            style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
          >
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <span className="text-white font-bold text-sm">L</span>
              </div>
              <span className="text-sm font-medium">linumsX</span>
              {documentData && (
                <span className="text-xs text-slate-400 ml-2">
                  {documentData.path.split(/[/\\]/).pop()}
                </span>
              )}
            </div>

            {/* Draggable title bar area - no buttons here to avoid drag issues */}

            {/* Window Control Buttons */}
            <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
              {documentData && (
                <span className="text-xs text-slate-400 mr-4">
                  {documentData.paragraphs.length} 段落 | {documentData.formulas.length} 公式
                </span>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleOpenDocument}
                className="text-slate-300 hover:text-white hover:bg-slate-700 gap-1 h-8"
              >
                <FolderOpen size={14} />
                <span className="text-xs">打开文档</span>
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setShowChat(prev => !prev);
                }}
                className={`gap-1 h-8 ${showChat ? 'bg-blue-600 text-white' : 'text-slate-300 hover:text-white hover:bg-slate-700'}`}
              >
                <Sparkles size={14} />
                <span className="text-xs">AI 助手</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-slate-300 hover:text-white hover:bg-slate-700 gap-1 h-8"
                onClick={() => setShowSettings(true)}
              >
                <Settings size={14} />
              </Button>

              {/* Window controls */}
              <button
                onClick={handleMinimize}
                className="ml-4 w-8 h-8 flex items-center justify-center rounded hover:bg-slate-700 transition-colors"
                title="最小化"
              >
                <Minus size={14} />
              </button>
              <button
                onClick={handleMaximize}
                className="w-8 h-8 flex items-center justify-center rounded hover:bg-slate-700 transition-colors"
                title={isMaximized ? "还原" : "最大化"}
              >
                {isMaximized ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
              </button>
              <button
                onClick={handleClose}
                className="w-8 h-8 flex items-center justify-center rounded hover:bg-red-600 transition-colors"
                title="关闭"
              >
                <X size={14} />
              </button>
            </div>
          </header>

          {/* Content */}
          <div className="flex-1 flex overflow-hidden">
            {/* Document Panel */}
            <div
              className="flex-1 overflow-auto min-w-0"
              onContextMenu={handleFreeSelectionContextMenu}
            >
              {documentData ? (
                arrayBuffer ? (
                  <DocxViewer
                    arrayBuffer={arrayBuffer}
                    onSelectionChange={handleSelectionChange}
                  />
                ) : (
                  <div className="document-content py-2">
                    {documentData.paragraphs.map((para, idx) => renderParagraph(para, idx))}
                  </div>
                )
              ) : (
                renderEmptyState()
              )}
            </div>

            {/* Chat Panel with Resize Handle */}
            {showChat && (
              <>
                <div
                  className="w-1 hover:w-1.5 bg-transparent hover:bg-blue-400 cursor-col-resize transition-all shrink-0"
                  onMouseDown={startResize}
                  onClick={(e) => e.preventDefault()}
                />
                <div
                  ref={sidebarRef}
                  style={{ width: sidebarWidth }}
                  className="shrink-0 border-l flex flex-col bg-gradient-to-b from-card to-background"
                >
                  {/* Messages */}
                  <ScrollArea className="flex-1">
                  <div className="p-3 space-y-3">
                    {chatMessages.length === 0 ? (
                      <div className="text-center text-muted-foreground py-8">
                        <p className="text-sm">可以帮你解释文档内容、转换公式</p>
                      </div>
                    ) : (
                      chatMessages.map((msg, idx) => (
                        <div
                          key={idx}
                          className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}
                        >
                          <div
                            className={`max-w-[90%] rounded-lg px-3 py-2 ${
                              msg.type === 'user'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                            }`}
                          >
                            {msg.type === 'ai' && idx === chatMessages.length - 1 && isLoading && (
                              <div className="flex items-center gap-1 mb-1">
                                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                              </div>
                            )}
                            {msg.type === 'ai' ? (
                              <MessageContent
                                content={idx === chatMessages.length - 1 && streamingContent ? streamingContent : msg.content}
                                isStreaming={isLoading && idx === chatMessages.length - 1}
                              />
                            ) : (
                              <p className="text-sm whitespace-pre-wrap leading-relaxed">
                                {msg.content}
                              </p>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>

                {/* AI Status Panel */}
                {isLoading && (
                  <div className="px-3 py-2 border-t bg-blue-50 dark:bg-blue-900/20">
                    {/* Phase indicator */}
                    <div className="flex items-center gap-2 mb-2">
                      {aiPhase === 'thinking' && (
                        <>
                          <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                          <span className="text-sm text-yellow-600 dark:text-yellow-400">思考中</span>
                        </>
                      )}
                      {aiPhase === 'tool_use' && (
                        <>
                          <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
                          <span className="text-sm text-purple-600 dark:text-purple-400">工具调用</span>
                        </>
                      )}
                      {aiPhase === 'responding' && (
                        <>
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                          <span className="text-sm text-green-600 dark:text-green-400">回答中</span>
                        </>
                      )}
                      {aiSummary && (
                        <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {aiSummary}
                        </span>
                      )}
                    </div>
                    {/* Active tools */}
                    {activeTools.length > 0 && (
                      <div className="space-y-1">
                        {activeTools.map((tool, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-xs">
                            {tool.status === 'running' && (
                              <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-spin" style={{ animationDuration: '1s' }} />
                            )}
                            {tool.status === 'completed' && (
                              <span className="text-green-500">✓</span>
                            )}
                            {tool.status === 'failed' && (
                              <span className="text-red-500">✗</span>
                            )}
                            <span className="text-gray-600 dark:text-gray-300">{tool.name}</span>
                            <span className="text-gray-400 dark:text-gray-500 truncate">{tool.summary}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Input Area */}
                <div className="p-3 border-t">
                  <div className="flex gap-2">
                    <Input
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey && chatInput.trim() && !isLoading) {
                          e.preventDefault();
                          handleChatSend();
                        }
                      }}
                      placeholder="输入消息..."
                      disabled={isLoading}
                      className="h-9"
                    />
                    <Button
                      onClick={handleChatSend}
                      disabled={isLoading || !chatInput.trim()}
                      size="sm"
                      className="h-9"
                    >
                      {isLoading ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Send size={16} />
                      )}
                    </Button>
                  </div>

                  {/* Quick Actions */}
                  {!isLoading && chatMessages.length > 0 && (
                    <div className="flex gap-2 mt-2 overflow-x-auto">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-6 px-2"
                        onClick={() => {
                          setChatInput('总结当前文档内容');
                          handleChatSend();
                        }}
                      >
                        总结文档
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs rounded-lg h-7 px-3 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:border-purple-300 dark:hover:border-purple-700"
                        onClick={() => {
                          setChatInput('列出文档中的所有公式');
                          handleChatSend();
                        }}
                      >
                        查看公式
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs rounded-lg h-7 px-3 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-green-50 dark:hover:bg-green-900/20 hover:border-green-300 dark:hover:border-green-700"
                        onClick={() => {
                          setChatInput('提取文档中的表格数据');
                          handleChatSend();
                        }}
                      >
                        提取表格
                      </Button>
                    </div>
                  )}
                </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Context Menu */}
        {contextMenu && (
          <DropdownMenu open onOpenChange={(open) => !open && setContextMenu(null)}>
            <DropdownMenuTrigger asChild>
              <button
                style={{ position: 'fixed', left: contextMenu.x, top: contextMenu.y }}
                className="hidden"
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-48" style={{ position: 'fixed', left: contextMenu.x, top: contextMenu.y }}>
              <DropdownMenuItem onClick={handleExplain} className="gap-2">
                <Lightbulb size={16} />
                解释选中内容
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleCopyAsLatex} className="gap-2">
                <Copy size={16} />
                复制为 LaTeX
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  if (contextMenu.text) {
                    navigator.clipboard.writeText(contextMenu.text);
                  }
                  setContextMenu(null);
                }}
                className="gap-2"
              >
                <Copy size={16} />
                复制
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <Dialog open={showSettings} onOpenChange={setShowSettings}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>模型设置</DialogTitle>
              <DialogDescription>
                可输入任意 provider，不需要在开发环境预定义。保存后会持久化到本地配置文件。
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-3 py-2">
              <div className="grid gap-1">
                <label className="text-sm text-muted-foreground">Provider</label>
                <Input
                  value={modelConfig.provider}
                  onChange={(e) =>
                    setModelConfig((prev) => ({ ...prev, provider: e.target.value }))
                  }
                  placeholder="例如: anthropic / openai / minimax / custom"
                />
              </div>

              <div className="grid gap-1">
                <label className="text-sm text-muted-foreground">Model</label>
                <Input
                  value={modelConfig.model}
                  onChange={(e) =>
                    setModelConfig((prev) => ({ ...prev, model: e.target.value }))
                  }
                  placeholder="例如: claude-3-5-sonnet-20241022"
                />
              </div>

              <div className="grid gap-1">
                <label className="text-sm text-muted-foreground">API Key</label>
                <Input
                  type="password"
                  value={modelConfig.apiKey}
                  onChange={(e) =>
                    setModelConfig((prev) => ({ ...prev, apiKey: e.target.value }))
                  }
                  placeholder="可选；为空则继续使用环境变量"
                />
              </div>

              <div className="grid gap-1">
                <label className="text-sm text-muted-foreground">Base URL</label>
                <Input
                  value={modelConfig.baseUrl}
                  onChange={(e) =>
                    setModelConfig((prev) => ({ ...prev, baseUrl: e.target.value }))
                  }
                  placeholder="可选；例如 https://api.example.com"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSettings(false)}>取消</Button>
              <Button onClick={handleSaveSettings}>保存</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

export default App;
