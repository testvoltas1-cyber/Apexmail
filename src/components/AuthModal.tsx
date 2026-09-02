// src/components/AuthModal.tsx
// Clean User Authentication Modal: Admin Master Access & Custom Domain User Sign In

import React, { useState } from 'react';
import {
  Mail,
  Lock,
  User as UserIcon,
  X,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  KeyRound
} from 'lucide-react';
import { User } from '../types';
import { api } from '../api/client';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (user: User, token: string) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onAuthSuccess,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (mode === 'login') {
        const res = await api.login(email, password);
        onAuthSuccess(res.user, res.token);
      } else {
        const res = await api.register(name, email, password);
        onAuthSuccess(res.user, res.token);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdminQuickLogin = () => {
    setEmail('admin@apexmail.internal');
    setPassword('admin123');
    setIsLoading(true);
    api.login('admin@apexmail.internal', 'admin123')
      .then((res) => {
        onAuthSuccess(res.user, res.token);
        onClose();
      })
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl shadow-2xl border border-gray-200 max-w-md w-full p-7 space-y-5 animate-in fade-in duration-150">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-200">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base text-gray-900 leading-tight">ApexMail Enterprise</h2>
              <p className="text-xs text-gray-500">Custom Domain Webmail Suite</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Master Admin Quick Access Card */}
        <div className="p-3.5 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-2xl border border-purple-200/80 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-purple-900">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-purple-600" />
              <span>Admin Master Access</span>
            </span>
            <span className="text-[10px] bg-purple-200/70 text-purple-800 px-2 py-0.5 rounded-full font-mono">
              Ready
            </span>
          </div>
          <p className="text-[11px] text-purple-700/90 leading-relaxed">
            Log in as Administrator to configure custom domains (MX/SPF/DKIM) and provision user accounts.
          </p>
          <button
            type="button"
            onClick={handleAdminQuickLogin}
            disabled={isLoading}
            className="w-full py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs transition-colors"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>1-Click Sign In as Admin</span>
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-gray-200 text-xs font-semibold">
          <button
            onClick={() => {
              setMode('login');
              setError(null);
            }}
            className={`flex-1 py-2.5 border-b-2 text-center transition-colors ${
              mode === 'login'
                ? 'border-blue-600 text-blue-600 font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            Sign In with Email
          </button>
          <button
            onClick={() => {
              setMode('register');
              setError(null);
            }}
            className={`flex-1 py-2.5 border-b-2 text-center transition-colors ${
              mode === 'register'
                ? 'border-blue-600 text-blue-600 font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            Create New Account
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          {mode === 'register' && (
            <div>
              <label className="block font-semibold text-gray-700 mb-1">Full Name</label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alex Rivera"
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block font-semibold text-gray-700 mb-1">
              Email Address / Username
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="text"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@yourdomain.com or admin"
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-mono text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-gray-700 mb-1">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
          >
            <span>
              {isLoading
                ? 'Authenticating...'
                : mode === 'login'
                ? 'Sign In to Mailbox'
                : 'Register Account & Open Mailbox'}
            </span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="text-[11px] text-gray-500 text-center bg-gray-50 p-2.5 rounded-xl border border-gray-200">
          💡 <strong>Setup Flow:</strong> Admin adds Custom Domain &rarr; Creates user accounts &rarr; Users log in directly and access their inbox!
        </div>
      </div>
    </div>
  );
};
