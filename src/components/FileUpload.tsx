'use client';

import { useRef, useState } from 'react';
import { Paperclip, X, Image as ImageIcon, FileText } from 'lucide-react';

interface FileUploadProps {
  onUpload: (file: File) => void;
  disabled?: boolean;
}

export default function FileUpload({ onUpload, disabled }: FileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState('');

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      setError('Only images (JPG, PNG, GIF, WebP) and PDFs are allowed.');
      return;
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be under 10MB.');
      return;
    }

    setSelectedFile(file);

    // Generate preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setPreview(ev.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }
  };

  const handleSend = () => {
    if (selectedFile) {
      onUpload(selectedFile);
      clearFile();
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    setPreview(null);
    setError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="relative">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/gif,image/webp,application/pdf"
        onChange={handleFileSelect}
        className="hidden"
      />

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled}
        className="p-2 rounded-xl text-rose-400 hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-50"
        title="Attach file"
      >
        <Paperclip className="w-5 h-5" />
      </button>

      {/* File preview modal */}
      {selectedFile && (
        <div className="absolute bottom-full right-0 mb-2 bg-white rounded-2xl shadow-2xl shadow-rose-200/30 border border-rose-100 p-4 w-72 z-50 animate-slide-up">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-rose-600">Preview</span>
            <button
              onClick={clearFile}
              className="text-rose-400 hover:text-rose-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {preview ? (
            <img
              src={preview}
              alt="Preview"
              className="w-full max-h-40 object-cover rounded-lg mb-2"
            />
          ) : (
            <div className="flex items-center gap-3 p-3 bg-rose-50 rounded-lg mb-2">
              {selectedFile.type === 'application/pdf' ? (
                <FileText className="w-10 h-10 text-rose-400" />
              ) : (
                <ImageIcon className="w-10 h-10 text-rose-400" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-rose-700 truncate">{selectedFile.name}</p>
                <p className="text-xs text-rose-400">{formatFileSize(selectedFile.size)}</p>
              </div>
            </div>
          )}

          {error && (
            <p className="text-xs text-red-500 mb-2">{error}</p>
          )}

          <div className="flex gap-2">
            <button
              onClick={clearFile}
              className="flex-1 py-2 rounded-xl text-sm text-rose-500 hover:bg-rose-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={!!error}
              className="flex-1 py-2 rounded-xl text-sm bg-gradient-to-r from-rose-500 to-pink-500 text-white hover:from-rose-600 hover:to-pink-600 transition-colors disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </div>
      )}

      {error && !selectedFile && (
        <div className="absolute bottom-full right-0 mb-2 bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl px-3 py-2 whitespace-nowrap z-50 animate-slide-up">
          {error}
        </div>
      )}
    </div>
  );
}
