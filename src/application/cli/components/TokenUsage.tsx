// src/application/cli/components/TokenUsage.tsx
// Token usage indicator component - circular progress with token count
import React from 'react';
import { Text, Box } from 'ink';

interface TokenUsageProps {
	inputTokens: number;
	outputTokens: number;
	maxTokens?: number; // Context window limit (default: 200K for Claude)
}

// Character-based circle drawing for terminal
function Circle({ filled, percentage }: { filled: number; percentage: number }) {
	// Unicode circle characters from empty to full
	const circleChars = ['○', '◔', '◑', '◕', '●'];
	const index = Math.min(Math.floor(percentage / 25), 4);

	return (
		<Text color={percentage > 90 ? 'red' : percentage > 70 ? 'yellow' : 'cyan'}>
			{circleChars[index]}
		</Text>
	);
}

// Format number with K/M suffix
function formatTokens(num: number): string {
	if (num >= 1000000) {
		return `${(num / 1000000).toFixed(1)}M`;
	}
	if (num >= 1000) {
		return `${(num / 1000).toFixed(1)}K`;
	}
	return num.toString();
}

export const TokenUsage: React.FC<TokenUsageProps> = ({
	inputTokens,
	outputTokens,
	maxTokens = 200000,
}) => {
	const totalTokens = inputTokens + outputTokens;
	const percentage = Math.min((totalTokens / maxTokens) * 100, 100);

	return (
		<Box flexDirection="column" alignItems="flex-end">
			<Box alignItems="center">
				<Circle filled={Math.floor(percentage / 25)} percentage={percentage} />
				<Text dimColor> </Text>
				<Text color={percentage > 90 ? 'red' : percentage > 70 ? 'yellow' : 'white'}>
					{formatTokens(totalTokens)}
				</Text>
			</Box>
			{outputTokens > 0 && (
				<Text dimColor>
					in: {formatTokens(inputTokens)} / out: {formatTokens(outputTokens)}
				</Text>
			)}
		</Box>
	);
};
