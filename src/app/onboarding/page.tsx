'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function OnboardingAuth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [mode, setMode] = useState<'email' | 'phone' | 'oauth'>('oauth');
  const supabase = createClient();

  const handleOAuth = async (provider: 'google' | 'apple') => {
    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    // Implementation placeholder for next phase
  };

  const handlePhoneAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    // Implementation placeholder for next phase
  };

  return (
    <div className="min-h-screen bg-bg-primary text-accent-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-12">
          <h1 className="font-display text-4xl tracking-tight mb-3">MYLI</h1>
          <p className="text-accent-muted font-sans font-light tracking-wide">
            Your journey begins here.
          </p>
        </div>

        <div className="space-y-4">
          <Button 
            variant="outline" 
            className="w-full h-14 bg-bg-surface border-none text-accent-white hover:bg-bg-secondary hover:text-accent-white transition-colors duration-300"
            onClick={() => handleOAuth('apple')}
          >
            Continue with Apple
          </Button>

          <Button 
            variant="outline" 
            className="w-full h-14 bg-bg-surface border-none text-accent-white hover:bg-bg-secondary hover:text-accent-white transition-colors duration-300"
            onClick={() => handleOAuth('google')}
          >
            Continue with Google
          </Button>

          <div className="flex items-center gap-4 py-4">
            <div className="flex-1 h-px bg-bg-surface"></div>
            <span className="text-accent-muted text-sm font-mono tracking-widest uppercase">OR</span>
            <div className="flex-1 h-px bg-bg-surface"></div>
          </div>

          {mode === 'oauth' && (
            <div className="grid grid-cols-2 gap-4">
              <Button 
                variant="ghost" 
                className="h-12 border border-bg-surface text-accent-muted hover:text-accent-white"
                onClick={() => setMode('email')}
              >
                Email
              </Button>
              <Button 
                variant="ghost" 
                className="h-12 border border-bg-surface text-accent-muted hover:text-accent-white"
                onClick={() => setMode('phone')}
              >
                Phone
              </Button>
            </div>
          )}

          {mode === 'email' && (
            <motion.form 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-4 overflow-hidden"
              onSubmit={handleEmailAuth}
            >
              <Input 
                type="email" 
                placeholder="Email address" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-14 bg-bg-surface border-none text-accent-white placeholder:text-accent-muted focus-visible:ring-1 focus-visible:ring-accent-gold"
              />
              <Input 
                type="password" 
                placeholder="Password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-14 bg-bg-surface border-none text-accent-white placeholder:text-accent-muted focus-visible:ring-1 focus-visible:ring-accent-gold"
              />
              <div className="flex gap-4 pt-2">
                <Button 
                  type="button"
                  variant="ghost" 
                  onClick={() => setMode('oauth')}
                  className="h-12 flex-1 border border-bg-surface text-accent-muted hover:text-accent-white"
                >
                  Back
                </Button>
                <Button type="submit" className="h-12 flex-1 bg-accent-gold text-bg-primary hover:bg-accent-gold/90 font-medium">
                  Sign In
                </Button>
              </div>
            </motion.form>
          )}

          {mode === 'phone' && (
            <motion.form 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-4 overflow-hidden"
              onSubmit={handlePhoneAuth}
            >
              <Input 
                type="tel" 
                placeholder="Phone number" 
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-14 bg-bg-surface border-none text-accent-white placeholder:text-accent-muted focus-visible:ring-1 focus-visible:ring-accent-gold"
              />
              <div className="flex gap-4 pt-2">
                <Button 
                  type="button"
                  variant="ghost" 
                  onClick={() => setMode('oauth')}
                  className="h-12 flex-1 border border-bg-surface text-accent-muted hover:text-accent-white"
                >
                  Back
                </Button>
                <Button type="submit" className="h-12 flex-1 bg-accent-gold text-bg-primary hover:bg-accent-gold/90 font-medium">
                  Send Code
                </Button>
              </div>
            </motion.form>
          )}

        </div>
      </motion.div>
    </div>
  );
}
