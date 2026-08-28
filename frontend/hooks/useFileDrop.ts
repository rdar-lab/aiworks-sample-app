import { useState, useCallback, useEffect } from 'react';

// Handles drag-over visual state and drop events only.
// Passes raw dropped files to onFiles — callers are responsible for validation.
export function useFileDrop(onFiles: (files: File[]) => void) {
  const [isDragOver, setIsDragOver] = useState(false);

  // Reset drag overlay state whenever any drop or drag-cancel event completes.
  // Using the capture phase for "drop" is intentional: it fires even when a child
  // element calls e.stopPropagation() (e.g. AttachmentToolbar does this so the
  // card's onDrop doesn't also fire). Without this listener the card overlay would
  // stay visible after a successful toolbar drop. Both the toolbar and card instances
  // reset together, which is correct — a completed drag should clear all overlays.
  useEffect(() => {
    const reset = () => setIsDragOver(false);
    document.addEventListener('drop', reset, true);
    document.addEventListener('dragend', reset);
    return () => {
      document.removeEventListener('drop', reset, true);
      document.removeEventListener('dragend', reset);
    };
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) onFiles(files);
  }, [onFiles]);

  return { isDragOver, handleDragOver, handleDragLeave, handleDrop };
}
