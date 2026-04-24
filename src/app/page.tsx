'use client';

import { useState, useEffect } from 'react';
import LoginForm from '@/components/LoginForm';
import RegisterForm from '@/components/RegisterForm';
import ChatInterface from '@/components/ChatInterface';

export default function Home() {
  const [user, setUser] = useState<{ username: string; token: string } | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [showRegister, setShowRegister] = useState(false);

  // Check if already logged in
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const storedToken = localStorage.getItem('chat_token');
        const storedUsername = localStorage.getItem('chat_username');
        if (storedToken && storedUsername) {
          // Verify token with server
          const res = await fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${storedToken}` },
          });
          if (res.ok) {
            setUser({ username: storedUsername, token: storedToken });
          } else {
            // Token expired or invalid
            localStorage.removeItem('chat_token');
            localStorage.removeItem('chat_username');
          }
        }
      } catch {
        // Not authenticated
      } finally {
        setIsChecking(false);
      }
    };

    checkAuth();
  }, []);

  const handleLogin = (username: string, token: string) => {
    localStorage.setItem('chat_token', token);
    localStorage.setItem('chat_username', username);
    setUser({ username, token });
  };

  const handleRegister = (username: string, token: string, gender: string) => {
    localStorage.setItem('chat_token', token);
    localStorage.setItem('chat_username', username);
    localStorage.setItem('chat_gender', gender);
    setUser({ username, token });
  };

  const handleLogout = () => {
    localStorage.removeItem('chat_token');
    localStorage.removeItem('chat_username');
    localStorage.removeItem('chat_gender');
    setUser(null);
  };

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-rose-50 via-pink-50 to-purple-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-rose-200 border-t-rose-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-rose-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    if (showRegister) {
      return (
        <RegisterForm
          onRegister={handleRegister}
          onSwitchToLogin={() => setShowRegister(false)}
        />
      );
    } else {
      return (
        <LoginForm
          onLogin={handleLogin}
          onSwitchToRegister={() => setShowRegister(true)}
        />
      );
    }
  }

  return <ChatInterface username={user.username} token={user.token} onLogout={handleLogout} />;
}
