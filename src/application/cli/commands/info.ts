// src/application/cli/commands/info.ts
import { Command } from 'commander';
import { Document } from '../../../domain/document/entities/Document.js';

export const infoCommand = new Command('info')
  .description('Get document information')
  .argument('<document>', 'Path to the Word document')
  .action(async (document: string) => {
    try {
      console.log(`Loading document: ${document}`);

      const doc = new Document(document);
      await doc.load();

      console.log('\n=== Document Info ===');
      console.log(`Path: ${doc.path}`);
      console.log(`Paragraphs: ${doc.paragraphs.length}`);
      console.log(`Tables: ${doc.tables.length}`);
      console.log(`Headings: ${doc.headingOutline.length}`);

      if (doc.headingOutline.length > 0) {
        console.log('\n=== Outline ===');
        doc.headingOutline.forEach((h, i) => {
          console.log(`${'  '.repeat(h.level - 1)}${i + 1}. ${h.text}`);
        });
      }

    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });
