'use client';

import { Message } from '@/types';
import { FileText, Check, CheckCheck } from 'lucide-react';

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  isSenderOnline?: boolean;
}

export default function MessageBubble({ message, isOwn, isSenderOnline }: MessageBubbleProps) {
  const formatTime = (timestamp: Date | string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const isAIMessage = message.sender === 'AI Assistant';

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-3 animate-slide-in`}>
      <div
        className={`max-w-[75%] sm:max-w-[65%] rounded-2xl px-4 py-3 shadow-md transition-all duration-200 hover:shadow-lg ${
          isAIMessage
            ? 'bg-linear-to-br from-emerald-100 to-teal-100 text-emerald-900 rounded-bl-md border border-emerald-200'
            : isOwn
            ? 'bg-linear-to-br from-rose-400 to-pink-500 text-white rounded-br-md'
            : 'bg-linear-to-br from-purple-100 to-violet-100 text-purple-900 rounded-bl-md'
        }`}
      >
        {/* AI Assistant header */}
        {isAIMessage && (
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-emerald-200">
            <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
              <span className="text-white text-xs font-bold">AI</span>
            </div>
            <span className="text-xs font-semibold text-emerald-700">AI Assistant (Afaan Oromo)</span>
          </div>
        )}

        {/* Text content */}
        {message.content && (
          <p className={`text-sm leading-relaxed whitespace-pre-wrap wrap-break-word ${
            isAIMessage ? 'font-medium' : ''
          }`}>
            {message.content}
          </p>
        )}

        {/* Image message */}
        {message.fileType === 'image' && message.filePath && (
          <div className="mt-1">
            <a
              href={message.filePath}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <img
                src={message.filePath}
                alt={message.fileName || 'Image'}
                className="max-w-full rounded-lg max-h-64 object-cover cursor-pointer hover:opacity-90 transition-opacity"
              />
            </a>
            {message.fileName && (
              <p className={`text-xs mt-1 ${isOwn ? 'text-white/70' : 'text-purple-400'}`}>
                {message.fileName}
              </p>
            )}
          </div>
        )}

        {/* PDF message */}
        {message.fileType === 'pdf' && message.filePath && (
          <a
            href={message.filePath}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center gap-3 p-2 rounded-lg mt-1 transition-colors ${
              isOwn
                ? 'bg-white/20 hover:bg-white/30'
                : 'bg-purple-200/50 hover:bg-purple-200/70'
            }`}
          >
            <FileText className="w-8 h-8 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">
                {message.fileName || 'Document'}
              </p>
              <p className={`text-xs ${isOwn ? 'text-white/70' : 'text-purple-400'}`}>
                PDF Document
              </p>
            </div>
          </a>
        )}

        {/* Timestamp and read receipt */}
        <div className={`flex items-center gap-1 mt-1.5 ${isOwn ? 'justify-end' : 'justify-start'}`}>
          {!isOwn && isSenderOnline && (
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          )}
          <span className={`text-[10px] ${isOwn ? 'text-white/60' : 'text-purple-300'}`}>
            {formatTime(message.timestamp)}
          </span>
          {isOwn && (
            message.read ? (
              <CheckCheck className="w-3.5 h-3.5 text-white/80" />
            ) : (
              <Check className="w-3.5 h-3.5 text-white/50" />
            )
          )}
        </div>
      </div>
    </div>
  );
}
