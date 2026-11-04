import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ScreenshotInput, formatBytes } from './ScreenshotInput';

describe('formatBytes', () => {
  it('formats zero bytes', () => {
    expect(formatBytes(0)).toBe('0 B');
  });

  it('formats kilobytes and megabytes', () => {
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(2048 * 1024)).toBe('2.0 MB');
  });
});

describe('ScreenshotInput component', () => {
  it('renders dropzone when value is empty', () => {
    render(<ScreenshotInput onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /upload or paste screenshot/i })).toBeInTheDocument();
  });

  it('renders preview thumbnail and remove button when value is present', () => {
    const dummyImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const onChange = vi.fn();
    render(<ScreenshotInput value={dummyImage} onChange={onChange} />);

    expect(screen.getByAltText('Screenshot preview')).toBeInTheDocument();
    const removeBtn = screen.getByRole('button', { name: /remove screenshot/i });
    expect(removeBtn).toBeInTheDocument();

    fireEvent.click(removeBtn);
    expect(onChange).toHaveBeenCalledWith(undefined);
  });
});
