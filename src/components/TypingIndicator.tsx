'use client';

export default function TypingIndicator() {
  return (
    <div className="flex items-center gap-2 mb-3 animate-slide-in">
      <div className="bg-gradient-to-br from-purple-100 to-violet-100 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-purple-400 mr-1">typing</span>
          <div className="flex gap-1">
            <span className="w-2 h-2 rounded-full bg-purple-400 animate-bounce-dot" style={{ animationDelay: '0ms' }} />
            <span className="w-2 h-2 rounded-full bg-purple-400 animate-bounce-dot" style={{ animationDelay: '150ms' }} />
            <span className="w-2 h-2 rounded-full bg-purple-400 animate-bounce-dot" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    </div>
  );
}
