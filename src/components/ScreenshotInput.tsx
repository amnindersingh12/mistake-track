import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, X, Image as ImageIcon, Check } from 'lucide-react';

export interface CompressionResult {
  dataUrl: string;
  originalSize: number;
  compressedSize: number;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export async function compressImage(
  file: File,
  maxDimension = 1600,
  quality = 0.8
): Promise<CompressionResult> {
  const originalSize = file.size;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onload = (event) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to load image'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          const rawUrl = (event.target?.result as string) || '';
          resolve({ dataUrl: rawUrl, originalSize, compressedSize: originalSize });
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        let dataUrl = canvas.toDataURL('image/webp', quality);
        if (!dataUrl.startsWith('data:image/webp')) {
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }

        const base64Data = dataUrl.split(',')[1] || '';
        const compressedSize = Math.round((base64Data.length * 3) / 4);

        resolve({
          dataUrl,
          originalSize,
          compressedSize
        });
      };
      img.src = (event.target?.result as string) || '';
    };
    reader.readAsDataURL(file);
  });
}

export interface ScreenshotInputProps {
  value?: string;
  onChange: (dataUrl?: string) => void;
  className?: string;
  label?: string;
}

export const ScreenshotInput: React.FC<ScreenshotInputProps> = ({
  value,
  onChange,
  className = '',
  label = 'Question Screenshot'
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [sizeStats, setSizeStats] = useState<{ original: number; compressed: number } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropzoneRef = useRef<HTMLDivElement>(null);

  const processImageFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith('image/')) {
        setErrorMessage('Only image files (PNG, JPG, WebP) are supported.');
        return;
      }
      setErrorMessage(null);
      setIsProcessing(true);
      try {
        const result = await compressImage(file, 1600, 0.8);
        setSizeStats({ original: result.originalSize, compressed: result.compressedSize });
        onChange(result.dataUrl);
      } catch {
        setErrorMessage('Failed to process and compress screenshot.');
      } finally {
        setIsProcessing(false);
      }
    },
    [onChange]
  );

  const handlePaste = useCallback(
    (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            processImageFile(file);
            break;
          }
        }
      }
    },
    [processImageFile]
  );

  useEffect(() => {
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
      e.target.value = '';
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSizeStats(null);
    setErrorMessage(null);
    onChange(undefined);
  };

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && <label className="block text-xs font-bold text-[var(--ink)] dark:text-[var(--text-main)]">{label}</label>}

      {value ? (
        <div className="relative border-2 border-[var(--ink-border)] rounded-xl p-2.5 bg-[var(--bg-surface)] flex items-center gap-3">
          <div className="w-16 h-16 rounded-lg overflow-hidden border border-[var(--ink-border)] bg-black/5 flex-shrink-0">
            <img src={value} alt="Screenshot preview" className="w-full h-full object-contain" />
          </div>
          <div className="flex-1 min-w-0 text-xs space-y-0.5">
            <div className="flex items-center gap-1.5 font-bold text-emerald-600 dark:text-emerald-400">
              <Check className="w-3.5 h-3.5" />
              <span>Screenshot Attached</span>
            </div>
            {sizeStats && (
              <div className="text-[11px] text-[var(--text-muted)] font-mono">
                {formatBytes(sizeStats.original)} → {formatBytes(sizeStats.compressed)} (
                {Math.round((1 - sizeStats.compressed / sizeStats.original) * 100)}% smaller)
              </div>
            )}
            <div className="text-[10px] text-[var(--text-muted)]">
              Compressed with HTML5 Canvas (max 1600px, 80% quality)
            </div>
          </div>
          <button
            type="button"
            onClick={handleRemove}
            aria-label="Remove screenshot"
            className="p-1.5 rounded-lg border border-[var(--ink-border)] bg-[var(--bg-panel)] text-[var(--text-muted)] hover:text-rose-600 hover:border-rose-400 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div
          ref={dropzoneRef}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`cursor-pointer border-2 border-dashed rounded-xl p-4 text-center transition-all ${
            isDragging
              ? 'border-[var(--sakura)] bg-[var(--sakura)]/10 scale-[0.99]'
              : 'border-[var(--ink-border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface)]/80'
          }`}
          role="button"
          tabIndex={0}
          aria-label="Upload or paste screenshot"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
            aria-hidden="true"
          />
          <div className="flex flex-col items-center justify-center gap-1.5">
            <div className="p-2 rounded-full bg-[var(--bg-panel)] border border-[var(--ink-border)] text-[var(--text-muted)]">
              {isProcessing ? <Upload className="w-4 h-4 animate-bounce" /> : <ImageIcon className="w-4 h-4" />}
            </div>
            <div className="text-xs font-bold text-[var(--ink)] dark:text-[var(--text-main)]">
              {isProcessing ? 'Compressing image...' : 'Paste screenshot (Cmd+V) or click to browse'}
            </div>
            <div className="text-[10px] text-[var(--text-muted)] font-mono">
              Drag & drop supported • Auto-compressed to max 1600px
            </div>
          </div>
        </div>
      )}

      {errorMessage && (
        <div role="alert" className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold mt-1">
          {errorMessage}
        </div>
      )}
    </div>
  );
};
