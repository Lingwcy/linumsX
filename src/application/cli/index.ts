// src/application/cli/index.ts
// Shebang: #!/usr/bin/env node (handled by npm bin)

import { Command } from 'commander';
import { editCommand } from './commands/edit.js';
import { infoCommand } from './commands/info.js';
import { interactiveCommand } from './commands/interactive.js';
import { runInteractive } from './ink.js';

const program = new Command();

program
  .name('linumsX')
  .description('linumsX AI-powered Word document agent')
  .version('1.0.0');

program.addCommand(editCommand);
program.addCommand(infoCommand);

// Ink interactive mode
const inkCommand = new Command('ink')
  .alias('i')
  .description('Start interactive mode with Ink UI')
  .action(async () => {
    await runInteractive();
  });

program.addCommand(inkCommand);

// Legacy interactive command (simple readline)
program.addCommand(interactiveCommand);

program.parse();
