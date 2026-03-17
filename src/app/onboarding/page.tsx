'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Track = 'physical' | 'mental' | 'both';
type AuthMode = 'email' | 'phone' | 'oauth';

type PhysicalFormState = {
  age: string;
  sex: string;
  heightCm: string;
  weightKg: string;
  activityLevel: string;
  goal: string;
};

type MentalFormState = {
  stressSources: string;
  sleepAvg: string;
  productivityStyle: string;
  lifeAreas: string;
};

function calculatePhysicalMetrics(age: number, sex: string, heightCm: number, weightKg: number, activityLevel: string) {
  const bmi = weightKg / ((heightCm / 100) ** 2);
  const bmrBase = 10 * weightKg + 6.25 * heightCm - 5 * age;
  const bmr = sex.toLowerCase() === 'male' ? bmrBase + 5 : bmrBase - 161;
  const activityFactorMap: Record<string, number> = {
    sedentary: 1.2,
    lightly_active: 1.375,
    moderately_active: 1.55,
    very_active: 1.725,
    athlete: 1.9,
  };
  const tdee = bmr * (activityFactorMap[activityLevel] ?? 1.2);

  return {
    bmi: Number(bmi.toFixed(1)),
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
  };
}

export default function OnboardingPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [mode, setMode] = useState<AuthMode>('oauth');
  const [emailAction, setEmailAction] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [phoneStep, setPhoneStep] = useState<'request' | 'verify'>('request');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [track, setTrack] = useState<Track>('both');
  const [step, setStep] = useState(1);
  const [myliScore, setMyliScore] = useState<number | null>(null);
  const [physicalForm, setPhysicalForm] = useState<PhysicalFormState>({
    age: '',
    sex: '',
    heightCm: '',
    weightKg: '',
    activityLevel: 'moderately_active',
    goal: 'maintain',
  });
  const [mentalForm, setMentalForm] = useState<MentalFormState>({
    stressSources: '',
    sleepAvg: '',
    productivityStyle: 'deep_work',
    lifeAreas: '',
  });

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');

  const clearFeedback = () => setMessage(null);

  const handleOAuth = async (provider: 'google' | 'apple') => {
    const supabase = createClient();
    clearFeedback();
    setIsLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${appUrl}/auth/callback`,
      },
    });
    setIsLoading(false);
    if (error) {
      setMessage({ type: 'error', text: error.message });
      return;
    }
    setMessage({ type: 'success', text: 'Redirecting to provider...' });
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    clearFeedback();
    if (!email || !password) {
      setMessage({ type: 'error', text: 'Email and password are required.' });
      return;
    }

    setIsLoading(true);
    if (emailAction === 'sign-in') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setIsLoading(false);
      if (error) {
        setMessage({ type: 'error', text: error.message });
        return;
      }
      setMessage({ type: 'success', text: 'Signed in. Redirecting...' });
      setStep(3);
      return;
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${appUrl}/auth/callback`,
      },
    });
    setIsLoading(false);
    if (error) {
      setMessage({ type: 'error', text: error.message });
      return;
    }
    setMessage({
      type: 'success',
      text: 'Account created. Check email if needed, then continue signing in.',
    });
  };

  const handlePhoneAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    clearFeedback();
    if (phoneStep === 'request') {
      if (!phone) {
        setMessage({ type: 'error', text: 'Phone number is required.' });
        return;
      }
      setIsLoading(true);
      const { error } = await supabase.auth.signInWithOtp({ phone });
      setIsLoading(false);
      if (error) {
        setMessage({ type: 'error', text: error.message });
        return;
      }
      setPhoneStep('verify');
      setMessage({ type: 'success', text: 'OTP sent. Enter the verification code.' });
      return;
    }

    if (!otpCode) {
      setMessage({ type: 'error', text: 'Verification code is required.' });
      return;
    }

    setIsLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      phone,
      token: otpCode,
      type: 'sms',
    });
    setIsLoading(false);
    if (error) {
      setMessage({ type: 'error', text: error.message });
      return;
    }
    setMessage({ type: 'success', text: 'Phone verified. Redirecting...' });
    setStep(3);
  };

  const resendOtp = async () => {
    const supabase = createClient();
    clearFeedback();
    if (!phone) {
      setMessage({ type: 'error', text: 'Phone number is required.' });
      return;
    }
    setIsLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ phone });
    setIsLoading(false);
    if (error) {
      setMessage({ type: 'error', text: error.message });
      return;
    }
    setMessage({ type: 'success', text: 'A new OTP has been sent.' });
  };

  const isPhysicalTrack = track === 'physical' || track === 'both';
  const isMentalTrack = track === 'mental' || track === 'both';

  const nextAfterAuth = () => {
    if (isPhysicalTrack) {
      setStep(3);
      return;
    }
    if (isMentalTrack) {
      setStep(4);
      return;
    }
    setStep(5);
  };

  const saveOnboarding = async () => {
    const supabase = createClient();
    clearFeedback();
    setIsLoading(true);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setIsLoading(false);
      setMessage({ type: 'error', text: 'Please authenticate before saving onboarding.' });
      return;
    }

    const scoreSeed = Math.floor(Math.random() * 100) + 650;
    setMyliScore(scoreSeed);

    const { error: profileError } = await supabase.from('profiles').upsert(
      {
        user_id: user.id,
        track,
        myli_score: scoreSeed,
        onboarding_complete: true,
        last_active: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );

    if (profileError) {
      setIsLoading(false);
      setMessage({ type: 'error', text: profileError.message });
      return;
    }

    if (isPhysicalTrack) {
      const age = Number(physicalForm.age);
      const heightCm = Number(physicalForm.heightCm);
      const weightKg = Number(physicalForm.weightKg);
      const metrics = calculatePhysicalMetrics(age, physicalForm.sex, heightCm, weightKg, physicalForm.activityLevel);
      const { error: physicalError } = await supabase.from('physical_profiles').upsert(
        {
          user_id: user.id,
          age,
          sex: physicalForm.sex,
          height_cm: heightCm,
          weight_kg: weightKg,
          activity_level: physicalForm.activityLevel,
          goal: physicalForm.goal,
          bmi: metrics.bmi,
          bmr: metrics.bmr,
          tdee: metrics.tdee,
        },
        { onConflict: 'user_id' }
      );
      if (physicalError) {
        setIsLoading(false);
        setMessage({ type: 'error', text: physicalError.message });
        return;
      }
    }

    if (isMentalTrack) {
      const { error: mentalError } = await supabase.from('mental_profiles').upsert(
        {
          user_id: user.id,
          stress_sources: mentalForm.stressSources.split(',').map((item) => item.trim()).filter(Boolean),
          sleep_avg: Number(mentalForm.sleepAvg || 0),
          productivity_style: mentalForm.productivityStyle,
          life_areas: mentalForm.lifeAreas.split(',').map((item) => item.trim()).filter(Boolean),
        },
        { onConflict: 'user_id' }
      );
      if (mentalError) {
        setIsLoading(false);
        setMessage({ type: 'error', text: mentalError.message });
        return;
      }
    }

    setIsLoading(false);
    setMessage({ type: 'success', text: 'Onboarding complete. Welcome to MYLI.' });
    setStep(5);
  };

  const physicalPreview = (() => {
    const age = Number(physicalForm.age);
    const heightCm = Number(physicalForm.heightCm);
    const weightKg = Number(physicalForm.weightKg);
    if (!age || !heightCm || !weightKg || !physicalForm.sex) return null;
    return calculatePhysicalMetrics(age, physicalForm.sex, heightCm, weightKg, physicalForm.activityLevel);
  })();

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
            Step {step} of 5
          </p>
        </div>

        <div className="space-y-4">
          {message && (
            <div
              className={`rounded-md border px-4 py-3 text-sm ${
                message.type === 'error'
                  ? 'border-danger/60 text-danger'
                  : 'border-success/60 text-success'
              }`}
              role="status"
              aria-live="polite"
            >
              {message.text}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-accent-muted">Select your starting track.</p>
              <div className="grid grid-cols-3 gap-3">
                <Button
                  type="button"
                  variant={track === 'physical' ? 'default' : 'outline'}
                  className={track === 'physical' ? 'h-16 bg-accent-gold text-bg-primary hover:bg-accent-gold/90' : 'h-16 bg-bg-surface border-none text-accent-white hover:bg-bg-secondary'}
                  onClick={() => setTrack('physical')}
                >
                  Body
                </Button>
                <Button
                  type="button"
                  variant={track === 'both' ? 'default' : 'outline'}
                  className={track === 'both' ? 'h-16 bg-accent-gold text-bg-primary hover:bg-accent-gold/90' : 'h-16 bg-bg-surface border-none text-accent-white hover:bg-bg-secondary'}
                  onClick={() => setTrack('both')}
                >
                  Both
                </Button>
                <Button
                  type="button"
                  variant={track === 'mental' ? 'default' : 'outline'}
                  className={track === 'mental' ? 'h-16 bg-accent-gold text-bg-primary hover:bg-accent-gold/90' : 'h-16 bg-bg-surface border-none text-accent-white hover:bg-bg-secondary'}
                  onClick={() => setTrack('mental')}
                >
                  Mind
                </Button>
              </div>
              <Button 
                type="button"
                className="h-12 w-full bg-accent-gold text-bg-primary hover:bg-accent-gold/90"
                onClick={() => setStep(2)}
              >
                Continue
              </Button>
            </div>
          )}

          {step === 2 && (
            <>
              <Button 
                variant="outline" 
                className="w-full h-14 bg-bg-surface border-none text-accent-white hover:bg-bg-secondary hover:text-accent-white transition-colors duration-300"
                onClick={() => handleOAuth('apple')}
                disabled={isLoading}
              >
                {isLoading ? 'Loading...' : 'Continue with Apple'}
              </Button>

              <Button 
                variant="outline" 
                className="w-full h-14 bg-bg-surface border-none text-accent-white hover:bg-bg-secondary hover:text-accent-white transition-colors duration-300"
                onClick={() => handleOAuth('google')}
                disabled={isLoading}
              >
                {isLoading ? 'Loading...' : 'Continue with Google'}
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
                    onClick={() => {
                      clearFeedback();
                      setMode('email');
                    }}
                    disabled={isLoading}
                  >
                    Email
                  </Button>
                  <Button
                    variant="ghost"
                    className="h-12 border border-bg-surface text-accent-muted hover:text-accent-white"
                    onClick={() => {
                      clearFeedback();
                      setMode('phone');
                    }}
                    disabled={isLoading}
                  >
                    Phone
                  </Button>
                </div>
              )}
              <Button
                type="button"
                variant="outline"
                className="w-full h-12 border-bg-surface text-accent-muted hover:text-accent-white"
                onClick={nextAfterAuth}
              >
                I am already authenticated
              </Button>
            </>
          )}

          {step === 2 && mode === 'email' && (
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
              <div className="grid grid-cols-2 gap-4">
                <Button
                  type="button"
                  variant={emailAction === 'sign-in' ? 'default' : 'ghost'}
                  className={emailAction === 'sign-in' ? 'h-12 bg-accent-gold text-bg-primary hover:bg-accent-gold/90' : 'h-12 border border-bg-surface text-accent-muted hover:text-accent-white'}
                  onClick={() => setEmailAction('sign-in')}
                  disabled={isLoading}
                >
                  Sign In
                </Button>
                <Button
                  type="button"
                  variant={emailAction === 'sign-up' ? 'default' : 'ghost'}
                  className={emailAction === 'sign-up' ? 'h-12 bg-accent-gold text-bg-primary hover:bg-accent-gold/90' : 'h-12 border border-bg-surface text-accent-muted hover:text-accent-white'}
                  onClick={() => setEmailAction('sign-up')}
                  disabled={isLoading}
                >
                  Sign Up
                </Button>
              </div>
              <div className="flex gap-4 pt-2">
                <Button 
                  type="button"
                  variant="ghost" 
                  onClick={() => {
                    clearFeedback();
                    setMode('oauth');
                  }}
                  className="h-12 flex-1 border border-bg-surface text-accent-muted hover:text-accent-white"
                  disabled={isLoading}
                >
                  Back
                </Button>
                <Button type="submit" className="h-12 flex-1 bg-accent-gold text-bg-primary hover:bg-accent-gold/90 font-medium" disabled={isLoading}>
                  {isLoading ? 'Working...' : emailAction === 'sign-in' ? 'Sign In' : 'Create Account'}
                </Button>
              </div>
            </motion.form>
          )}

          {step === 2 && mode === 'phone' && (
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
                disabled={phoneStep === 'verify' || isLoading}
              />
              {phoneStep === 'verify' && (
                <Input
                  type="text"
                  placeholder="Verification code"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  className="h-14 bg-bg-surface border-none text-accent-white placeholder:text-accent-muted focus-visible:ring-1 focus-visible:ring-accent-gold"
                  disabled={isLoading}
                />
              )}
              <div className="flex gap-4 pt-2">
                <Button 
                  type="button"
                  variant="ghost" 
                  onClick={() => {
                    clearFeedback();
                    setMode('oauth');
                    setPhoneStep('request');
                    setOtpCode('');
                  }}
                  className="h-12 flex-1 border border-bg-surface text-accent-muted hover:text-accent-white"
                  disabled={isLoading}
                >
                  Back
                </Button>
                <Button type="submit" className="h-12 flex-1 bg-accent-gold text-bg-primary hover:bg-accent-gold/90 font-medium" disabled={isLoading}>
                  {isLoading ? 'Working...' : phoneStep === 'request' ? 'Send Code' : 'Verify Code'}
                </Button>
              </div>
              {phoneStep === 'verify' && (
                <Button
                  type="button"
                  variant="ghost"
                  className="h-10 w-full border border-bg-surface text-accent-muted hover:text-accent-white"
                  onClick={resendOtp}
                  disabled={isLoading}
                >
                  Resend OTP
                </Button>
              )}
            </motion.form>
          )}

          {step === 3 && isPhysicalTrack && (
            <div className="space-y-4">
              <p className="text-sm text-accent-muted">Physical profile</p>
              <Input
                type="number"
                placeholder="Age"
                value={physicalForm.age}
                onChange={(e) => setPhysicalForm((prev) => ({ ...prev, age: e.target.value }))}
                className="h-12 bg-bg-surface border-none text-accent-white placeholder:text-accent-muted"
              />
              <Input
                type="text"
                placeholder="Sex (male/female)"
                value={physicalForm.sex}
                onChange={(e) => setPhysicalForm((prev) => ({ ...prev, sex: e.target.value }))}
                className="h-12 bg-bg-surface border-none text-accent-white placeholder:text-accent-muted"
              />
              <Input
                type="number"
                placeholder="Height (cm)"
                value={physicalForm.heightCm}
                onChange={(e) => setPhysicalForm((prev) => ({ ...prev, heightCm: e.target.value }))}
                className="h-12 bg-bg-surface border-none text-accent-white placeholder:text-accent-muted"
              />
              <Input
                type="number"
                placeholder="Weight (kg)"
                value={physicalForm.weightKg}
                onChange={(e) => setPhysicalForm((prev) => ({ ...prev, weightKg: e.target.value }))}
                className="h-12 bg-bg-surface border-none text-accent-white placeholder:text-accent-muted"
              />
              <Input
                type="text"
                placeholder="Activity level: sedentary/lightly_active/moderately_active/very_active/athlete"
                value={physicalForm.activityLevel}
                onChange={(e) => setPhysicalForm((prev) => ({ ...prev, activityLevel: e.target.value }))}
                className="h-12 bg-bg-surface border-none text-accent-white placeholder:text-accent-muted"
              />
              <Input
                type="text"
                placeholder="Goal: lose_fat/build_muscle/improve_endurance/maintain/recomposition"
                value={physicalForm.goal}
                onChange={(e) => setPhysicalForm((prev) => ({ ...prev, goal: e.target.value }))}
                className="h-12 bg-bg-surface border-none text-accent-white placeholder:text-accent-muted"
              />
              {physicalPreview && (
                <div className="rounded-md border border-bg-surface p-3 text-sm text-accent-muted">
                  BMI: {physicalPreview.bmi} | BMR: {physicalPreview.bmr} | TDEE: {physicalPreview.tdee}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <Button type="button" variant="ghost" className="h-12 border border-bg-surface text-accent-muted hover:text-accent-white" onClick={() => setStep(2)}>
                  Back
                </Button>
                <Button type="button" className="h-12 bg-accent-gold text-bg-primary hover:bg-accent-gold/90" onClick={() => setStep(isMentalTrack ? 4 : 5)}>
                  Continue
                </Button>
              </div>
            </div>
          )}

          {step === 4 && isMentalTrack && (
            <div className="space-y-4">
              <p className="text-sm text-accent-muted">Mental profile</p>
              <Input
                type="text"
                placeholder="Stress sources (comma separated)"
                value={mentalForm.stressSources}
                onChange={(e) => setMentalForm((prev) => ({ ...prev, stressSources: e.target.value }))}
                className="h-12 bg-bg-surface border-none text-accent-white placeholder:text-accent-muted"
              />
              <Input
                type="number"
                placeholder="Average sleep hours"
                value={mentalForm.sleepAvg}
                onChange={(e) => setMentalForm((prev) => ({ ...prev, sleepAvg: e.target.value }))}
                className="h-12 bg-bg-surface border-none text-accent-white placeholder:text-accent-muted"
              />
              <Input
                type="text"
                placeholder="Productivity style (deep_work/pomodoro/time_blocking/flexible)"
                value={mentalForm.productivityStyle}
                onChange={(e) => setMentalForm((prev) => ({ ...prev, productivityStyle: e.target.value }))}
                className="h-12 bg-bg-surface border-none text-accent-white placeholder:text-accent-muted"
              />
              <Input
                type="text"
                placeholder="Life areas (comma separated)"
                value={mentalForm.lifeAreas}
                onChange={(e) => setMentalForm((prev) => ({ ...prev, lifeAreas: e.target.value }))}
                className="h-12 bg-bg-surface border-none text-accent-white placeholder:text-accent-muted"
              />
              <div className="grid grid-cols-2 gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  className="h-12 border border-bg-surface text-accent-muted hover:text-accent-white"
                  onClick={() => setStep(isPhysicalTrack ? 3 : 2)}
                >
                  Back
                </Button>
                <Button type="button" className="h-12 bg-accent-gold text-bg-primary hover:bg-accent-gold/90" onClick={() => setStep(5)}>
                  Continue
                </Button>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <h2 className="font-display text-3xl">Welcome to MYLI</h2>
              <p className="text-accent-muted">
                Your profile is ready. We will personalize your daily intelligence feed.
              </p>
              <div className="rounded-md border border-bg-surface p-4 text-sm">
                <p className="text-accent-muted">Projected MYLI Score</p>
                <p className="mt-2 text-3xl font-display text-accent-gold">{myliScore ?? '---'}</p>
              </div>
              <Button
                type="button"
                className="h-12 w-full bg-accent-gold text-bg-primary hover:bg-accent-gold/90"
                onClick={saveOnboarding}
                disabled={isLoading}
              >
                {isLoading ? 'Saving...' : 'Begin Your Journey'}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-12 w-full border-bg-surface text-accent-muted hover:text-accent-white"
                onClick={() => window.location.assign('/dashboard')}
              >
                Go to Dashboard
              </Button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
