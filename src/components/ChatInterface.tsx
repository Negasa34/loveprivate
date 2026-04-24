'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Heart, LogOut, Search, X, Wifi, WifiOff, Sparkles, Quote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import MessageBubble from './MessageBubble';
import TypingIndicator from './TypingIndicator';
import EmojiPicker from './EmojiPicker';
import FileUpload from './FileUpload';
import { getSocket, disconnectSocket } from '@/lib/socket';
import { Message, PartnerStatus } from '@/types';

interface ChatInterfaceProps {
  username: string;
  token: string;
  onLogout: () => void;
}

export default function ChatInterface({ username, token, onLogout }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const [partnerStatus, setPartnerStatus] = useState<PartnerStatus | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Message[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [showAIOptions, setShowAIOptions] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const socketRef = useRef<ReturnType<typeof getSocket> | null>(null);

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const loadPartnerStatus = async () => {
    try {
      const res = await fetch('/api/partner/status', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPartnerStatus(data);
        return data as PartnerStatus;
      }
    } catch (error) {
      console.error('Load partner status error:', error);
    }
    return null;
  };

  const loadMessages = async () => {
    try {
      const res = await fetch('/api/messages', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
        setTimeout(scrollToBottom, 100);
      }
    } catch (error) {
      console.error('Load messages error:', error);
    }
  };

  useEffect(() => {
    loadMessages();
    loadPartnerStatus();
  }, [token, scrollToBottom]);

  // Socket.io connection
  useEffect(() => {
    const socket = getSocket(token);
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('new_message', (message: Message) => {
      setMessages(prev => {
        // Avoid duplicates
        if (prev.some(m => m._id === message._id)) return prev;
        return [...prev, message];
      });
      setTimeout(scrollToBottom, 100);

      // Mark as read if not own message
      if (message.sender !== username) {
        socket.emit('message_read');
      }
    });

    socket.on('partner_typing', () => {
      setIsPartnerTyping(true);
    });

    socket.on('partner_stop_typing', () => {
      setIsPartnerTyping(false);
    });

    socket.on('user_online', (data: { username: string }) => {
      setPartnerStatus(prev => prev ? { ...prev, isOnline: true } : { username: data.username, isOnline: true, lastSeen: null });
    });

    socket.on('user_offline', (data: { username: string; lastSeen: string }) => {
      setPartnerStatus(prev => prev ? { ...prev, isOnline: false, lastSeen: data.lastSeen } : { username: data.username, isOnline: false, lastSeen: data.lastSeen });
    });

    socket.on('online_users', (users: string[]) => {
      const partner = users.find(u => u !== username);
      if (partner) {
        setPartnerStatus(prev => prev ? { ...prev, isOnline: true } : { username: partner, isOnline: true, lastSeen: null });
      }
    });

    socket.on('messages_read', () => {
      setMessages(prev => prev.map(m => m.sender === username ? { ...m, read: true } : m));
    });

    // Connect if not already
    if (!socket.connected) {
      socket.connect();
    }

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('new_message');
      socket.off('partner_typing');
      socket.off('partner_stop_typing');
      socket.off('user_online');
      socket.off('user_offline');
      socket.off('online_users');
      socket.off('messages_read');
    };
  }, [token, username, scrollToBottom]);

  // Handle click outside to close AI options
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showAIOptions && !(event.target as Element).closest('.ai-options-container')) {
        setShowAIOptions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAIOptions]);

  // Send message
  const sendMessage = async () => {
    if (!newMessage.trim() || !socketRef.current || isSending) return;

    const content = newMessage.trim();
    setNewMessage('');
    setIsSending(true);

    // Stop typing indicator
    socketRef.current.emit('stop_typing');

    try {
      socketRef.current.emit('send_message', { content });
    } catch (error) {
      console.error('Send message error:', error);
    } finally {
      setIsSending(false);
      messageInputRef.current?.focus();
    }
  };

  // Handle typing
  const handleTyping = (value: string) => {
    setNewMessage(value);

    if (socketRef.current) {
      socketRef.current.emit('typing');
    }

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing
    typingTimeoutRef.current = setTimeout(() => {
      if (socketRef.current) {
        socketRef.current.emit('stop_typing');
      }
    }, 2000);
  };

  // Handle file upload
  const handleFileUpload = async (file: File) => {
    setIsSending(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        console.error('Upload error:', data.error);
      }
    } catch (error) {
      console.error('Upload error:', error);
    } finally {
      setIsSending(false);
    }
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // Ignore errors
    }
    disconnectSocket();
    onLogout();
  };

  // Handle search
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const res = await fetch(`/api/messages/search?q=${encodeURIComponent(searchQuery)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  // Keyboard handler for Enter
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Emoji insert
  const handleEmojiSelect = (emoji: string) => {
    setNewMessage(prev => prev + emoji);
    messageInputRef.current?.focus();
  };

  // AI generate functions
  const generateRomanticQuote = () => {
    if (!socketRef.current || isSending) return;
    setIsSending(true);
    try {
      socketRef.current.emit('send_message', { content: '/quote' });
    } catch (error) {
      console.error('Generate quote error:', error);
    } finally {
      setIsSending(false);
      setShowAIOptions(false);
    }
  };

  const generateLoveAdvice = () => {
    if (!socketRef.current || isSending) return;
    setIsSending(true);
    try {
      socketRef.current.emit('send_message', { content: '/ai Give me romantic advice for our relationship' });
    } catch (error) {
      console.error('Generate advice error:', error);
    } finally {
      setIsSending(false);
      setShowAIOptions(false);
    }
  };

  const partnerName = partnerStatus?.username || 'Soulmate';

  return (
    <div className="flex flex-col h-screen bg-linear-to-br from-rose-50 via-pink-50 to-purple-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-rose-100 px-4 py-3 flex items-center justify-between sticky top-0 z-40 shadow-sm">
        <div className="flex items-center gap-3">
          <Avatar className="w-10 h-10 ring-2 ring-rose-300 ring-offset-2">
            <AvatarFallback className="bg-linear-to-br from-purple-400 to-violet-500 text-white font-semibold">
              {partnerName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <h2 className="font-semibold text-rose-800 text-sm sm:text-base">{partnerName}</h2>
            {username === 'boss' && (
              <div className="text-xs text-purple-600 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                AI Assistant Available
              </div>
            )}
            <div className="flex items-center gap-1.5">
              {partnerStatus?.isOnline ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-xs text-green-600">Online</span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-gray-300" />
                  <span className="text-xs text-gray-400">
                    {partnerStatus?.lastSeen
                      ? `Last seen ${new Date(partnerStatus.lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                      : 'Offline'}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden sm:flex items-center">
            {isConnected ? (
              <Wifi className="w-4 h-4 text-green-400" />
            ) : (
              <WifiOff className="w-4 h-4 text-red-400" />
            )}
          </div>

          {/* Search button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowSearch(!showSearch)}
            className="text-rose-400 hover:text-rose-600 hover:bg-rose-50 h-9 w-9"
          >
            <Search className="w-4 h-4" />
          </Button>

          {/* Logout button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            className="text-rose-400 hover:text-rose-600 hover:bg-rose-50 h-9 w-9"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Search bar */}
      {showSearch && (
        <div className="bg-white/80 backdrop-blur-xl border-b border-rose-100 px-4 py-2 flex items-center gap-2 animate-slide-down">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search messages..."
            className="h-9 rounded-xl border-rose-200 focus:border-rose-400 text-sm bg-rose-50/50"
          />
          <Button
            onClick={handleSearch}
            size="sm"
            disabled={isSearching}
            className="bg-linear-to-r from-rose-500 to-pink-500 text-white rounded-xl h-9"
          >
            {isSearching ? '...' : 'Search'}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setShowSearch(false);
              setSearchQuery('');
              setSearchResults([]);
            }}
            className="text-rose-400 h-9 w-9"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Search results */}
      {searchResults.length > 0 && (
        <div className="bg-white/90 backdrop-blur border-b border-rose-100 max-h-48 overflow-y-auto custom-scrollbar">
          <div className="p-3 space-y-2">
            <p className="text-xs text-rose-400 font-medium">Search Results ({searchResults.length})</p>
            {searchResults.map((msg) => (
              <div key={msg._id} className="text-sm p-2 rounded-lg bg-rose-50">
                <span className="font-medium text-rose-600">{msg.sender}: </span>
                <span className="text-rose-800">{msg.content}</span>
                <span className="text-xs text-rose-300 ml-2">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 custom-scrollbar">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-rose-300">
            <Heart className="w-16 h-16 mb-4 animate-pulse-glow" />
            <p className="text-lg font-medium">Start your conversation</p>
            <p className="text-sm">Send a message to begin</p>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto">
            {messages.map((message) => (
              <MessageBubble
                key={message._id}
                message={message}
                isOwn={message.sender === username}
                isSenderOnline={message.sender !== username ? partnerStatus?.isOnline : undefined}
              />
            ))}
            {isPartnerTyping && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="bg-white/80 backdrop-blur-xl border-t border-rose-100 px-3 sm:px-6 py-3 sticky bottom-0">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-2">
            {/* File upload */}
            <FileUpload onUpload={handleFileUpload} disabled={isSending} />

            {/* Message input */}
            <div className="flex-1 relative">
              <input
                ref={messageInputRef}
                type="text"
                value={newMessage}
                onChange={(e) => handleTyping(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={username === 'boss' ? "Type a message or /ai for Afaan Oromo AI responses..." : "Type a message..."}
                disabled={isSending}
                className="w-full h-11 px-4 pr-10 rounded-2xl border border-rose-200 bg-rose-50/50 text-rose-800 placeholder:text-rose-300 focus:outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-400/20 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              />
              {/* Emoji button */}
              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-rose-300 hover:text-rose-500 transition-colors"
              >
                😊
              </button>
            </div>

            {/* Emoji Picker */}
            {showEmojiPicker && (
              <EmojiPicker
                onSelect={handleEmojiSelect}
                onClose={() => setShowEmojiPicker(false)}
              />
            )}

            {/* AI Generate button */}
            <div className="relative ai-options-container">
              <Button
                onClick={() => setShowAIOptions(!showAIOptions)}
                disabled={isSending}
                className="h-11 w-11 rounded-full bg-linear-to-r from-purple-500 to-violet-500 hover:from-purple-600 hover:to-violet-600 text-white shadow-lg shadow-purple-300/30 transition-all duration-200 hover:shadow-xl hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 p-0 mr-2"
                title="AI Love Assistant"
              >
                <Sparkles className="w-5 h-5" />
              </Button>

              {/* AI Options Dropdown */}
              {showAIOptions && (
                <div className="absolute bottom-full right-0 mb-2 bg-white rounded-xl shadow-xl border border-purple-100 p-2 min-w-48 animate-slide-up">
                  <div className="space-y-1">
                    <Button
                      onClick={generateRomanticQuote}
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-purple-700 hover:bg-purple-50 hover:text-purple-800"
                    >
                      <Quote className="w-4 h-4 mr-2" />
                      Romantic Quote
                    </Button>
                    <Button
                      onClick={generateLoveAdvice}
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-purple-700 hover:bg-purple-50 hover:text-purple-800"
                    >
                      <Heart className="w-4 h-4 mr-2" />
                      Love Advice
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Send button */}
            <Button
              onClick={sendMessage}
              disabled={!newMessage.trim() || isSending}
              className="h-11 w-11 rounded-full bg-linear-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white shadow-lg shadow-rose-300/30 transition-all duration-200 hover:shadow-xl hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 p-0"
            >
              <Heart className="w-5 h-5 fill-white" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
