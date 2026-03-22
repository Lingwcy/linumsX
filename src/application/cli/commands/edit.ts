// src/application/cli/commands/edit.ts
import { Command } from 'commander';
import { createConfiguredAgent } from '../agentFactory.js';

export const editCommand = new Command('edit')
  .description('Edit a document using AI')
  .argument('<document>', 'Path to the Word document')
  .argument('<instruction>', 'Instruction for the AI')
  .option('-m, --model <model>', 'Model to use')
  .action(async (document: string, instruction: string, options: any) => {
    try {
      console.log(`Loading document: ${document}`);
      console.log(`Instruction: ${instruction}`);

      // 传递用户指令用于意图识别，动态加载相关工具
      const agent = createConfiguredAgent({ userInput: instruction });

      await agent.loadDocument(document);
      const result = await agent.run(instruction);
      console.log(result);

    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });
