// src/application/cli/ink.ts - Ink UI entrypoint

import React from 'react';
import { render } from 'ink';
import { InteractiveApp } from './components/InteractiveApp.js';
import { createConfiguredAgent } from './agentFactory.js';

export async function runInteractive(): Promise<void> {
	const agent = createConfiguredAgent({ persistConversation: true });
	const app = render(React.createElement(InteractiveApp, { agent }));
	await app.waitUntilExit();
}
