import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';

interface MessageContentProps {
  content: string;
  isStreaming?: boolean;
}

/**
 * MessageContent - 消息内容渲染器
 *
 * 渲染 Markdown 格式的消息内容
 * 支持 GFM (GitHub Flavored Markdown)、代码高亮
 */
export function MessageContent({ content, isStreaming = false }: MessageContentProps) {
  // 流式输出时添加光标效果
  const cursorAnimation = isStreaming ? (
    <span className="inline-block w-0.5 h-4 bg-blue-500 animate-pulse ml-0.5" />
  ) : null;

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, rehypeHighlight]}
        components={{
          // 自定义代码块样式
          code: ({ className, children, ...props }) => {
            const match = /language-(\w+)/.exec(className || '');
            const isInline = !match;

            if (isInline) {
              return (
                <code
                  className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-sm font-mono text-blue-600 dark:text-blue-400"
                  {...props}
                >
                  {children}
                </code>
              );
            }

            return (
              <code className={`${className} block rounded-lg overflow-hidden`} {...props}>
                {children}
              </code>
            );
          },
          // 自定义pre标签样式
          pre: ({ children }) => (
            <pre className="bg-gray-900 dark:bg-gray-950 rounded-lg p-4 overflow-x-auto text-sm my-3">
              {children}
            </pre>
          ),
          // 自定义链接样式
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              {children}
            </a>
          ),
          // 自定义列表样式
          ul: ({ children }) => <ul className="list-disc list-inside space-y-1 my-2">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 my-2">{children}</ol>,
          li: ({ children }) => <li className="text-gray-700 dark:text-gray-300">{children}</li>,
          // 自定义标题样式
          h1: ({ children }) => <h1 className="text-xl font-bold my-3">{children}</h1>,
          h2: ({ children }) => <h2 className="text-lg font-semibold my-2">{children}</h2>,
          h3: ({ children }) => <h3 className="text-base font-medium my-2">{children}</h3>,
          // 自定义表格样式
          table: ({ children }) => (
            <div className="overflow-x-auto my-3">
              <table className="min-w-full border border-gray-200 dark:border-gray-700 rounded-lg">
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-gray-200 dark:border-gray-700 px-3 py-2 bg-gray-50 dark:bg-gray-800 font-semibold text-left">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">{children}</td>
          ),
          // 自定义引用样式
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-blue-500 pl-4 my-3 italic text-gray-600 dark:text-gray-400">
              {children}
            </blockquote>
          ),
          // 自定义段落样式
          p: ({ children }) => (
            <p className="my-2 text-gray-700 dark:text-gray-300 leading-relaxed">
              {children}
            </p>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
      {cursorAnimation}
    </div>
  );
}
