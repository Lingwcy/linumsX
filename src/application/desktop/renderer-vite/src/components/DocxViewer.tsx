import { useEffect, useRef, useCallback } from 'react';
import * as docxPreview from 'docx-preview';

interface DocxViewerProps {
  arrayBuffer: ArrayBuffer | null;
  onSelectionChange?: (text: string, isFormula: boolean) => void;
}

export function DocxViewer({ arrayBuffer, onSelectionChange }: DocxViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Render docx when arrayBuffer changes
  useEffect(() => {
    if (!arrayBuffer || !containerRef.current) return;

    // Clear previous content
    containerRef.current.innerHTML = '';

    // Render the document
    docxPreview.renderAsync(arrayBuffer, containerRef.current).catch((error) => {
      console.error('Failed to render docx:', error);
    });
  }, [arrayBuffer]);

  // Handle text selection
  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      return;
    }

    const text = selection.toString().trim();
    if (!text) {
      return;
    }

    // Check if selection contains formula-like content
    const isFormula = detectFormula(text);

    if (onSelectionChange) {
      onSelectionChange(text, isFormula);
    }
  }, [onSelectionChange]);

  // Detect if text is likely a formula
  const detectFormula = (text: string): boolean => {
    // Common formula patterns
    const formulaPatterns = [
      /^[a-zA-Z0-9\s\+\-\*\/\=\(\)\[\]\{\}]+$/, // Basic math
      /\\frac/, // LaTeX fraction
      /\\sqrt/, // LaTeX sqrt
      /\\sum/, // LaTeX sum
      /\\int/, // LaTeX integral
      /\\lim/, // LaTeX limit
      /\\alpha|\\beta|\\gamma|\\delta|\\theta|\\pi|\\sigma/, // Greek letters
      /∫|∑|∏|√|∞|≈|≠|≤|≥|±|×|÷/, // Math symbols
    ];

    return formulaPatterns.some(pattern => pattern.test(text));
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('mouseup', handleMouseUp);
    return () => {
      container.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseUp]);

  if (!arrayBuffer) {
    return null;
  }

  return (
    <div className="docx-viewer w-full h-full">
      <div
        ref={containerRef}
        className="docx-preview office-reading-mode"
      />
    </div>
  );
}
