import { Document, ParagraphData, TableData, HeadingOutline } from '../entities/Document.js';

export class DocumentService {
  async loadDocument(path: string): Promise<Document> {
    const doc = new Document(path);
    await doc.load();
    return doc;
  }

  async saveDocument(doc: Document): Promise<void> {
    await doc.save();
  }

  getDocumentText(doc: Document): string {
    return doc.getText();
  }

  getParagraphs(doc: Document): ParagraphData[] {
    return doc.paragraphs;
  }

  getTables(doc: Document): TableData[] {
    return doc.tables;
  }

  getHeadingOutline(doc: Document): HeadingOutline[] {
    return doc.headingOutline;
  }
}
