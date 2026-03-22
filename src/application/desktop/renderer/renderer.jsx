// src/application/desktop/renderer/renderer.jsx
const { useState, useEffect, useCallback, useRef, createElement: h } = React;

// Types (defined as comments for documentation)
// interface DocumentData {
//   path: string;
//   paragraphs: Array<{ index: number; text: string; style?: string }>;
//   tables: Array<{ rows: number; columns: number }>;
//   headings: Array<{ level: number; text: string }>;
//   formulas: Array<{ index: number; type: string; latex: string; paragraphIndex: number }>;
// }

// Application Component
function App() {
  const [documentData, setDocumentData] = useState(null);
  const [selectedParagraphs, setSelectedParagraphs] = useState([]);
  const [showChat, setShowChat] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectionInfo, setSelectionInfo] = useState(null);

  // Listen for document loaded event
  useEffect(() => {
    const cleanup = window.electronAPI.onDocumentLoaded((data) => {
      setDocumentData(data);
      setSelectedParagraphs([]);
    });

    return cleanup;
  }, []);

  // Listen for document error event
  useEffect(() => {
    const cleanup = window.electronAPI.onDocumentError((error) => {
      alert('加载文档失败: ' + error.message);
    });

    return cleanup;
  }, []);

  // Handle click outside context menu
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const handleOpenDocument = () => {
    window.electronAPI.openDocument();
  };

  const handleParagraphClick = (index, e) => {
    if (e.shiftKey) {
      // Multi-select with shift
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

  const handleContextMenu = (e, paragraphIndex) => {
    e.preventDefault();
    const text = documentData.paragraphs[paragraphIndex]?.text || '';
    const formula = documentData.formulas.find(f => f.paragraphIndex === paragraphIndex);

    setSelectedParagraphs([paragraphIndex]);
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      paragraphIndex,
      text,
      isFormula: !!formula,
    });
  };

  const handleExplain = async () => {
    if (!contextMenu) return;

    setShowChat(true);
    const text = contextMenu.text;
    const isFormula = contextMenu.isFormula;

    // Add user message
    setChatMessages(prev => [...prev, {
      type: 'user',
      content: isFormula ? `解释公式: ${text}` : `解释: ${text}`,
    }]);

    setSelectionInfo({ text, isFormula });
    setContextMenu(null);
  };

  const handleCopyAsLatex = async () => {
    if (!contextMenu) return;

    setIsLoading(true);
    try {
      const result = await window.electronAPI.copyAsLatex(contextMenu.text);
      if (result.success) {
        // Show the LaTeX result in chat
        setShowChat(true);
        setChatMessages(prev => [...prev, {
          type: 'ai',
          content: `LaTeX 格式:\n${result.data}`,
        }]);
      } else {
        alert('转换失败: ' + result.error);
      }
    } catch (error) {
      alert('转换失败: ' + error.message);
    }
    setIsLoading(false);
    setContextMenu(null);
  };

  const handleChatSend = async () => {
    if (!chatInput.trim() || isLoading) return;

    const userMessage = chatInput.trim();
    setChatInput('');
    setIsLoading(true);

    // Add user message
    setChatMessages(prev => [...prev, { type: 'user', content: userMessage }]);

    try {
      const result = await window.electronAPI.chat(userMessage);
      if (result.success) {
        setChatMessages(prev => [...prev, { type: 'ai', content: result.data }]);
      } else {
        setChatMessages(prev => [...prev, { type: 'ai', content: '错误: ' + result.error }]);
      }
    } catch (error) {
      setChatMessages(prev => [...prev, { type: 'ai', content: '错误: ' + error.message }]);
    }

    setIsLoading(false);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleChatSend();
    }
  };

  const getParagraphStyle = (style) => {
    if (!style) return '';
    if (style.startsWith('Heading')) {
      return `heading${style.replace('Heading', '')}`;
    }
    return '';
  };

  const isFormula = (paragraphIndex) => {
    return documentData?.formulas?.some(f => f.paragraphIndex === paragraphIndex);
  };

  // Render paragraph with selection and formula highlighting
  const renderParagraph = (para, index) => {
    const isSelected = selectedParagraphs.includes(index);
    const isFormulaPara = isFormula(index);
    const styleClass = getParagraphStyle(para.style);

    return h('div', {
      key: index,
      className: `paragraph ${styleClass} ${isSelected ? 'selected' : ''} ${isFormulaPara ? 'formula' : ''}`,
      onClick: (e) => handleParagraphClick(index, e),
      onContextMenu: (e) => handleContextMenu(e, index),
      'data-paragraph-index': index,
    }, para.text || '\u00A0');
  };

  // Context Menu Component
  const renderContextMenu = () => {
    if (!contextMenu) return null;

    return h('div', {
      className: 'context-menu',
      style: { left: contextMenu.x, top: contextMenu.y },
      onClick: (e) => e.stopPropagation(),
    }, [
      h('div', {
        key: 'explain',
        className: 'context-menu-item',
        onClick: handleExplain,
      }, [
        h('span', { key: 'icon' }, '\u{1F4A1}'),
        '解释选中内容',
      ]),
      h('div', {
        key: 'latex',
        className: 'context-menu-item',
        onClick: handleCopyAsLatex,
      }, [
        h('span', { key: 'icon' }, '\u{1F4C4}'),
        '复制为 LaTeX',
      ]),
      h('div', { key: 'div1', className: 'context-menu-divider' }),
      h('div', {
        key: 'copy',
        className: 'context-menu-item',
        onClick: () => {
          if (contextMenu.text) {
            navigator.clipboard.writeText(contextMenu.text);
          }
          setContextMenu(null);
        },
      }, [
        h('span', { key: 'icon' }, '\u{1F4CB}'),
        '复制',
      ]),
    ]);
  };

  // Chat Panel Component
  const renderChatPanel = () => {
    if (!showChat) return null;

    return h('div', { className: 'chat-panel' }, [
      h('div', { key: 'header', className: 'chat-header' }, [
        'AI 助手',
        h('button', {
          key: 'close',
          className: 'chat-close',
          onClick: () => setShowChat(false),
        }, '\u00D7'),
      ]),
      selectionInfo && h('div', {
        key: 'selection',
        className: 'selection-info',
      }, selectionInfo.isFormula ? `公式: ${selectionInfo.text}` : `选中: ${selectionInfo.text}`),
      h('div', { key: 'messages', className: 'chat-messages' },
        chatMessages.map((msg, idx) =>
          h('div', {
            key: idx,
            className: `chat-message chat-message-${msg.type}`,
          }, h('div', { className: 'message-content' }, msg.content))
        )
      ),
      h('div', { key: 'input-container', className: 'chat-input-container' }, [
        h('textarea', {
          key: 'input',
          className: 'chat-input',
          value: chatInput,
          onChange: (e) => setChatInput(e.target.value),
          onKeyPress: handleKeyPress,
          placeholder: '输入消息...',
          rows: 3,
        }),
        h('button', {
          key: 'send',
          className: 'chat-send',
          onClick: handleChatSend,
          disabled: isLoading || !chatInput.trim(),
        }, isLoading ? '发送中...' : '发送'),
      ]),
    ]);
  };

  // Empty State Component
  const renderEmptyState = () => {
    return h('div', { className: 'empty-state' }, [
      h('div', { key: 'icon', className: 'empty-state-icon' }, '\u{1F4C4}'),
      h('div', { key: 'text', className: 'empty-state-text' }, '未加载文档'),
      h('div', { key: 'hint', className: 'empty-state-hint' }, '点击"打开文档"按钮选择 Word 文档'),
    ]);
  };

  // Main render
  return h('div', { id: 'root' }, [
    // Header
    h('div', { key: 'header', className: 'header' }, [
      h('h1', { key: 'title' }, 'linumsX - Word 文档编辑器'),
      h('div', { key: 'actions', className: 'header-actions' }, [
        h('button', {
          key: 'open',
          className: 'btn btn-primary',
          onClick: handleOpenDocument,
        }, '\u{1F4C2} 打开文档'),
      ]),
    ]),

    // Main Content
    h('div', { key: 'content', className: 'main-content' }, [
      // Document Panel
      h('div', { key: 'doc-panel', className: 'document-panel' }, [
        // Toolbar
        h('div', { key: 'toolbar', className: 'document-toolbar' }, [
          h('span', { key: 'title', className: 'document-title' },
            documentData ? documentData.path.split(/[/\\]/).pop() : '未加载文档'
          ),
          documentData && h('span', { key: 'stats', style: { fontSize: '12px', color: '#999' } },
            `${documentData.paragraphs.length} 段落 | ${documentData.formulas.length} 公式`
          ),
        ]),

        // Document Content
        documentData
          ? h('div', { key: 'content', className: 'document-content' },
              documentData.paragraphs.map((para, idx) => renderParagraph(para, idx))
            )
          : renderEmptyState(),
      ]),

      // Chat Panel
      renderChatPanel(),
    ]),

    // Context Menu
    renderContextMenu(),
  ]);
}

// Mount the app
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(h(App));
