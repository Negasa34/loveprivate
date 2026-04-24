'use client';

import { useState } from 'react';

const EMOJIS = [
  '❤️', '💕', '💖', '💗', '💓', '💞', '💘', '💝',
  '😘', '🥰', '😍', '😻', '🤗', '💋', '🌹', '🌸',
  '✨', '🌟', '💫', '🎈', '🎉', '🎊', '🎁', '🎀',
  '😊', '🥺', '😭', '🤭', '😏', '😎', '🥳', '🙌',
  '👍', '👏', '🤝', '💪', '🫂', '☕', '🍕', '🎬',
];

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export default function EmojiPicker({ onSelect, onClose }: EmojiPickerProps) {
  const [search, setSearch] = useState('');

  const filteredEmojis = search
    ? EMOJIS.filter(() => true) // Simple emoji - show all for now
    : EMOJIS;

  return (
    <div className="absolute bottom-full right-0 mb-2 bg-white rounded-2xl shadow-2xl shadow-rose-200/30 border border-rose-100 p-3 w-72 z-50 animate-slide-up">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-rose-600">Emojis</span>
        <button
          onClick={onClose}
          className="text-rose-400 hover:text-rose-600 text-sm font-medium"
        >
          ✕
        </button>
      </div>
      <div className="grid grid-cols-8 gap-1 max-h-48 overflow-y-auto custom-scrollbar">
        {filteredEmojis.map((emoji, i) => (
          <button
            key={i}
            onClick={() => {
              onSelect(emoji);
              onClose();
            }}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-rose-50 active:bg-rose-100 transition-colors text-lg"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
