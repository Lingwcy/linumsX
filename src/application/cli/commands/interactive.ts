// src/application/cli/commands/interactive.ts
import { Command } from 'commander';
import readline from 'readline';
import { createConfiguredAgent } from '../agentFactory.js';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function askQuestion(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

export const interactiveCommand = new Command('interactive')
  .description('Start an interactive REPL session (simple)')
  .action(async () => {
    try {
      const agent = createConfiguredAgent({ persistConversation: true });

      console.log('linumsX - Interactive Mode');
      console.log('Commands:');
      console.log('  load <path>   - 加载 Word 文档');
      console.log('  unload       - 卸载当前文档');
      console.log('  doc          - 查看当前文档信息');
      console.log('  quit         - 退出\n');

      while (true) {
        const instruction = await askQuestion('> ');

        if (!instruction.trim()) continue;

        const cmd = instruction.trim().toLowerCase();

        // Handle commands
        if (cmd === 'quit' || cmd === 'exit' || cmd === 'q') {
          console.log('Goodbye!');
          rl.close();
          process.exit(0);
        }

        if (cmd.startsWith('load ') || cmd === 'load') {
          const path = cmd === 'load' ? '' : instruction.trim().substring(5);
          if (!path) {
            const docPath = await askQuestion('Document path: ');
            if (!docPath.trim() || docPath.toLowerCase() === 'cancel') {
              continue;
            }
            try {
              await agent.loadDocument(docPath);
              console.log(`✅ 已加载文档: ${docPath}\n`);
            } catch (error) {
              const msg = error instanceof Error ? error.message : String(error);
              console.error(`Failed to load: ${msg}\n`);
            }
          } else {
            try {
              await agent.loadDocument(path);
              console.log(`Loaded: ${path}\n`);
            } catch (error) {
              const msg = error instanceof Error ? error.message : String(error);
              console.error(`Failed to load: ${msg}\n`);
            }
          }
          continue;
        }

        if (cmd === 'unload') {
          agent.unloadDocument();
          console.log('✅ 已卸载文档\n');
          continue;
        }

        if (cmd === 'doc') {
          const docPath = agent.getDocumentPath();
          if (docPath) {
            console.log(`📄 当前文档: ${docPath}\n`);
          } else {
            console.log('📄 当前无文档加载\n');
          }
          continue;
        }

        // Regular message - run agent
        try {
          const result = await agent.run(instruction);
          console.log('\n' + result + '\n');
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          console.error(`Error: ${msg}\n`);
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`Error: ${msg}`);
      rl.close();
      process.exit(1);
    }
  });
