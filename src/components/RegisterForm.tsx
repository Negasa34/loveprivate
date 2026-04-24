'use client';

import { useState } from 'react';
import { Heart, Lock, User, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface RegisterFormProps {
  onRegister: (username: string, token: string, gender: string) => void;
  onSwitchToLogin: () => void;
}

export default function RegisterForm({ onRegister, onSwitchToLogin }: RegisterFormProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [gender, setGender] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password, gender }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Registration failed');
        return;
      }

      onRegister(data.username, data.token, data.gender);
    } catch {
      setError('Connection error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-linear-to-br from-rose-50 via-pink-50 to-purple-50">
      {/* Floating Hearts Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="absolute animate-float-heart text-rose-200/40"
            style={{
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 8}s`,
              animationDuration: `${6 + Math.random() * 6}s`,
              fontSize: `${12 + Math.random() * 24}px`,
            }}
          >
            ♥
          </div>
        ))}
      </div>

      {/* Register Card */}
      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl shadow-rose-200/50 p-8 border border-rose-100/50">
          {/* Logo / Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-linear-to-br from-rose-400 to-pink-500 shadow-lg shadow-rose-300/50 mb-4 animate-pulse-glow">
              <Heart className="w-10 h-10 text-white fill-white" />
            </div>
            <h1 className="text-3xl font-bold bg-linear-to-r from-rose-600 via-pink-600 to-purple-600 bg-clip-text text-transparent">
              Join Our Love Story
            </h1>
            <p className="text-rose-400 mt-2 text-sm">Create your account for private chat</p>
          </div>

          {/* Register Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-rose-700 flex items-center gap-2">
                <User className="w-4 h-4" />
                Username
              </label>
              <Input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Choose a username"
                className="h-12 rounded-xl border-rose-200 focus:border-rose-400 focus:ring-rose-400/20 bg-rose-50/50 placeholder:text-rose-300"
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-rose-700 flex items-center gap-2">
                <Lock className="w-4 h-4" />
                Password
              </label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a password"
                className="h-12 rounded-xl border-rose-200 focus:border-rose-400 focus:ring-rose-400/20 bg-rose-50/50 placeholder:text-rose-300"
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-rose-700 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Gender
              </label>
              <Select value={gender} onValueChange={setGender} disabled={isLoading}>
                <SelectTrigger className="h-12 rounded-xl border-rose-200 focus:border-rose-400 focus:ring-rose-400/20 bg-rose-50/50">
                  <SelectValue placeholder="Select your gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="soulmate">Soulmate</SelectItem>
                  <SelectItem value="girl">Girl</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3 animate-shake">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={isLoading || !username.trim() || !password || !gender}
              className="w-full h-12 rounded-xl bg-linear-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white font-semibold shadow-lg shadow-rose-300/30 transition-all duration-300 hover:shadow-xl hover:shadow-rose-300/40 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating account...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Heart className="w-4 h-4 fill-white" />
                  Join with Love
                </div>
              )}
            </Button>
          </form>

          {/* Switch to Login */}
          <div className="mt-6 text-center">
            <button
              onClick={onSwitchToLogin}
              className="text-sm text-rose-500 hover:text-rose-600 underline transition-colors"
            >
              Already have an account? Sign in
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}