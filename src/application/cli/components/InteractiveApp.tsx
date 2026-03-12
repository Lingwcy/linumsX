// src/application/cli/components/InteractiveApp.tsx
// Interactive CLI with activity states and expandable tool details
import React, { useState } from 'react';
import { Text, Box, Spacer, Static, useInput } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import { Agent } from '../../../domain/agent/Agent.js';
import { AgentRunState, AgentToolEvent } from '../../../domain/agent/types.js';

interface Message {
	role: 'user' | 'assistant' | 'system';
	content: string;
	kind?: 'tool';
	toolEvent?: {
		phase: 'start' | 'result';
		name: string;
		iteration?: number;
		summary: string;
		input: string;
		resultLabel?: 'Result' | 'Error';
		result?: string;
		success?: boolean;
	};
}

interface Props {
	agent: Agent;
}

interface ToolActivity {
	name: string;
	input: object;
	summary: string;
	result?: unknown;
	success?: boolean;
	iteration?: number;
}

const DETAIL_LINE_LIMIT = 12;
const DETAIL_LINE_WIDTH = 100;

export const InteractiveApp: React.FC<Props> = ({ agent }) => {
	const [input, setInput] = useState('');
	const [messages, setMessages] = useState<Message[]>([]);
	const [currentDoc, setCurrentDoc] = useState<string | null>(null);
	const [status, setStatus] = useState<{ state: AgentRunState; summary: string }>({
		state: 'idle',
		summary: 'Ready',
	});
	const [toolActivity, setToolActivity] = useState<ToolActivity | null>(null);
	const [historyVersion, setHistoryVersion] = useState(0);

	useInput((value, key) => {
		if (key.ctrl && value === 'b') {
			if (!toolActivity) {
				return;
			}

			setMessages(prev => [
				...prev,
				{
					role: 'system',
					content: buildToolDetailsMessage(toolActivity),
				},
			]);
		}
	});

	const updateToolActivity = (event: AgentToolEvent) => {
		setToolActivity({
			name: event.name,
			input: event.input,
			summary: event.summary,
			result: event.result,
			success: event.success,
			iteration: event.iteration,
		});
	};

	const appendToolStart = (event: AgentToolEvent) => {
		setMessages(prev => [
			...prev,
			buildToolEventEntry(event, 'start'),
		]);
		updateToolActivity(event);
	};

	const completeToolHistoryEntry = (event: AgentToolEvent) => {
		setMessages(prev => [
			...prev,
			buildToolEventEntry(event, 'result'),
		]);
		updateToolActivity(event);
	};

	const handleSubmit = async () => {
		if (!input.trim()) return;

		const userMessage: Message = { role: 'user', content: input };
		setMessages(prev => [...prev, userMessage]);
		setToolActivity(null);
		setInput('');

		try {
			const cmd = input.trim().toLowerCase();

			if (cmd === 'quit' || cmd === 'exit' || cmd === 'q') {
				process.exit(0);
			}

			if (cmd.startsWith('load ') || cmd === 'load') {
				const path = cmd === 'load' ? '' : input.trim().substring(5);
				if (!path) {
					setMessages(prev => [
						...prev,
						{ role: 'system', content: 'Usage: load <path>' },
					]);
					setStatus({ state: 'idle', summary: 'Ready' });
					return;
				}
				try {
					await agent.loadDocument(path);
					setCurrentDoc(path);
					setMessages(prev => [
						...prev,
						{ role: 'system', content: `Loaded: ${path}` },
					]);
				} catch (error) {
					const msg = error instanceof Error ? error.message : String(error);
					setMessages(prev => [
						...prev,
						{ role: 'system', content: `Failed to load: ${msg}` },
					]);
				}
				setStatus({ state: 'idle', summary: currentDoc ? `Loaded ${currentDoc}` : 'Ready' });
				return;
			}

			if (cmd === 'doc') {
				const docPath = agent.getDocumentPath();
				setMessages(prev => [
					...prev,
					{
						role: 'system',
						content: docPath ? `Current document: ${docPath}` : 'No document loaded',
					},
				]);
				setStatus({ state: 'idle', summary: docPath ? 'Current document inspected' : 'Ready' });
				return;
			}

			if (cmd === 'unload') {
				agent.unloadDocument();
				setCurrentDoc(null);
				setMessages(prev => [
					...prev,
					{ role: 'system', content: 'Document unloaded' },
				]);
				setStatus({ state: 'idle', summary: 'Ready' });
				return;
			}

			if (cmd === 'clear') {
				setMessages([]);
				setToolActivity(null);
				setHistoryVersion(prev => prev + 1);
				setStatus({ state: 'idle', summary: 'Ready' });
				return;
			}

			if (cmd === 'help') {
				setMessages(prev => [
					...prev,
					{
						role: 'system',
						content: `Commands:
  load <path>  - Load Word document
  doc          - Show current document
  clear        - Clear chat history
  help         - Show this help
	unload       - Unload current document
  quit         - Exit`,
					},
				]);
				setStatus({ state: 'idle', summary: 'Ready' });
				return;
			}

			const result = await agent.run(input, {
				onStateChange: update => {
					setStatus({ state: update.state, summary: update.summary });
				},
				onToolStart: event => {
					appendToolStart(event);
				},
				onToolResult: event => {
					completeToolHistoryEntry(event);
				},
			});
			setMessages(prev => [
				...prev,
				{ role: 'assistant', content: result },
			]);
			setToolActivity(null);
			setStatus({ state: 'idle', summary: 'Ready' });
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			setMessages(prev => [
				...prev,
				{ role: 'system', content: `Error: ${msg}` },
			]);
			setToolActivity(null);
			setStatus({ state: 'idle', summary: 'Request failed' });
		}
	};

	const statusColor =
		status.state === 'thinking'
			? 'yellow'
			: status.state === 'tool_use'
				? 'cyan'
				: status.state === 'responding'
					? 'green'
					: 'gray';

	const showStatusPanel = status.state !== 'idle';
	const showToolPanel = toolActivity && showStatusPanel;

	return (
		<Box flexDirection="column">
			{/* Messages */}
			<Box key={historyVersion} flexDirection="column">
				<Static items={messages}>
					{(msg, i) => (
						<MessageRow key={`${historyVersion}-${i}`} message={msg} />
					)}
				</Static>
			</Box>

			<Spacer />

			{currentDoc && (
				<Box paddingX={1}>
					<Text dimColor>Document: {currentDoc}</Text>
				</Box>
			)}

			{showToolPanel && (
				<Box paddingX={1} marginTop={1}>
					<Text color="yellow">Tool {toolActivity.name}</Text>
					<Text dimColor>: {toolActivity.summary}</Text>
					<Text dimColor> | Ctrl+B writes details to history</Text>
				</Box>
			)}

			{showStatusPanel && (
				<Box paddingX={1} marginTop={1}>
					<Text color={statusColor}>
						{status.state === 'thinking' && <Spinner type="dots" />}
						{status.state === 'tool_use' && <Spinner type="dots" />}
						{status.state === 'responding' && <Spinner type="dots" />}
						{' Processing'}
					</Text>
					<Text> {status.summary}</Text>
				</Box>
			)}

			{/* Input */}
			<Box paddingX={1} marginTop={1}>
				<Text color="green">{'>'}</Text>
				<TextInput
					value={input}
					onChange={setInput}
					onSubmit={handleSubmit}
					placeholder="Type a message or command..."
				/>
			</Box>

			<Box paddingX={1}>
				<Text dimColor>help, clear, quit</Text>
			</Box>
		</Box>
	);
};

function buildToolDetailsMessage(toolActivity: ToolActivity): string {
	const inputPreview = formatDetailValue(toolActivity.input);
	const resultPreview = toolActivity.result === undefined ? 'No result yet.' : formatDetailValue(toolActivity.result);

	return [
		`Tool details: ${toolActivity.name}`,
		toolActivity.summary,
		'',
		'Input:',
		inputPreview,
		'',
		toolActivity.success === false ? 'Error:' : 'Result:',
		resultPreview,
		'',
		'Details are truncated to keep the terminal responsive.',
	].join('\n');
}

function formatDetailValue(value: unknown): string {
	const rendered = typeof value === 'string' ? value : JSON.stringify(value, null, 2) ?? '';
	const wrappedLines = rendered
		.split(/\r?\n/)
		.flatMap(line => wrapLine(line, DETAIL_LINE_WIDTH));

	if (wrappedLines.length <= DETAIL_LINE_LIMIT) {
		return wrappedLines.join('\n');
	}

	return `${wrappedLines.slice(0, DETAIL_LINE_LIMIT).join('\n')}\n... (${wrappedLines.length - DETAIL_LINE_LIMIT} more lines)`;
}

function formatInlinePreview(value: unknown): string {
	const rendered = typeof value === 'string' ? value : JSON.stringify(value) ?? '';
	return rendered.length > 180 ? `${rendered.slice(0, 177)}...` : rendered;
}

function buildToolEventEntry(event: AgentToolEvent, phase: 'start' | 'result'): Message {
	return {
		role: 'system',
		content: '',
		kind: 'tool',
		toolEvent: {
			phase,
			name: event.name,
			iteration: event.iteration,
			summary: event.summary,
			input: formatDetailValue(event.input),
			resultLabel: phase === 'result' ? (event.success === false ? 'Error' : 'Result') : undefined,
			result: phase === 'result' ? formatDetailValue(event.result) : undefined,
			success: event.success,
		},
	};
}

function MessageRow({ message }: { message: Message }) {
	if (message.kind === 'tool' && message.toolEvent) {
		return <ToolEventRow toolEvent={message.toolEvent} />;
	}

	return (
		<Box paddingX={1} paddingY={0}>
			{message.role === 'user' && <Text color="green"> {'> '}</Text>}
			{message.role === 'assistant' && <Text color="blue"> {'  '}</Text>}
			{message.role === 'system' && <Text dimColor> {'# '}</Text>}
			<Text>{message.content}</Text>
		</Box>
	);
}

function ToolEventRow({ toolEvent }: { toolEvent: NonNullable<Message['toolEvent']> }) {
	const labelColor = toolEvent.phase === 'start'
		? 'yellow'
		: toolEvent.success === false
			? 'red'
			: 'cyan';
	const statusText = toolEvent.phase === 'start' ? 'start' : toolEvent.success === false ? 'failed' : 'success';

	return (
		<Box flexDirection="column" paddingX={1} paddingY={0} marginTop={0}>
			<Box>
				<Text color={labelColor}>#Tool {statusText}</Text>
				<Text> {toolEvent.name}</Text>
				{typeof toolEvent.iteration === 'number' && <Text dimColor> (iteration {toolEvent.iteration})</Text>}
			</Box>
			<Box paddingLeft={2}>
				<Text dimColor italic>{toolEvent.summary}</Text>
			</Box>
			<Box paddingLeft={2}>
				<Text dimColor>Input:</Text>
			</Box>
			<Box paddingLeft={3}>
				<Text color="gray">{toolEvent.input}</Text>
			</Box>
			{toolEvent.resultLabel && toolEvent.result && (
				<>
					<Box paddingLeft={2}>
						<Text dimColor>{toolEvent.resultLabel}:</Text>
					</Box>
					<Box paddingLeft={3}>
						<Text color={toolEvent.success === false ? 'red' : 'gray'}>{toolEvent.result}</Text>
					</Box>
				</>
			)}
		</Box>
	);
}

function wrapLine(line: string, maxWidth: number): string[] {
	if (line.length <= maxWidth) {
		return [line];
	}

	const segments: string[] = [];
	for (let index = 0; index < line.length; index += maxWidth) {
		segments.push(line.slice(index, index + maxWidth));
	}

	return segments;
}
