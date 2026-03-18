'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Track = 'physical' | 'mental' | 'both';

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

function ftInToCm(ft: string, inches: string): string {
  const totalInches = Number(ft || 0) * 12 + Number(inches || 0);
  return totalInches > 0 ? (totalInches * 2.54).toFixed(1) : '';
}

function lbsToKg(lbs: string): string {
  const val = Number(lbs);
  return val > 0 ? (val * 0.453592).toFixed(1) : '';
}

export default function OnboardingPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [emailAction, setEmailAction] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [isLoading, setIsLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [redirecting, setRedirecting] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [track, setTrack] = useState<Track>('both');
  const [step, setStep] = useState(1);
  const [myliScore, setMyliScore] = useState<number | null>(null);
  const [unitSystem, setUnitSystem] = useState<'metric' | 'imperial'>('metric');
  const [heightFt, setHeightFt] = useState('');
  const [heightIn, setHeightIn] = useState('');
  const [weightLbs, setWeightLbs] = useState('');
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

  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setCheckingAuth(false);
          return;
        }
        const { data: profile } = await supabase
          .from('profiles')
          .select('onboarding_complete')
          .eq('user_id', user.id)
          .single();

        if (profile?.onboarding_complete) {
          setRedirecting(true);
          window.location.assign('/dashboard');
        } else {
          setCheckingAuth(false);
        }
      } catch {
        setCheckingAuth(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (unitSystem === 'imperial') {
      setPhysicalForm(prev => ({
        ...prev,
        heightCm: ftInToCm(heightFt, heightIn),
        weightKg: lbsToKg(weightLbs),
      }));
    }
  }, [unitSystem, heightFt, heightIn, weightLbs]);

  const stepLabels: Record<number, string> = {
    1: 'Choose Your Track',
    2: 'Create Account',
    3: 'Physical Profile',
    4: 'Mental Profile',
    5: 'You\'re Ready',
  };

  const appUrl = (
    process.env.NEXT_PUBLIC_APP_URL ||
    (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000')
  ).replace(/\/+$/, '');

  const clearFeedback = () => setMessage(null);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    clearFeedback();
    if (!email || !password) {
      setMessage({ type: 'error', text: 'Email and password are required.' });
      return;
    }

    setIsLoading(true);

    // Always try sign-in first — works for both existing and confirm-disabled accounts
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (!signInError) {
      setMessage({ type: 'success', text: 'Signed in. Checking your profile...' });
      await nextAfterAuth();
      return;
    }

    // If sign-in failed and user wanted to sign in, show the error
    if (emailAction === 'sign-in') {
      setIsLoading(false);
      setMessage({ type: 'error', text: signInError.message });
      return;
    }

    // Sign-up flow
    if (!name.trim()) {
      setIsLoading(false);
      setMessage({ type: 'error', text: 'Please enter your name.' });
      return;
    }

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${appUrl}/auth/callback`,
        data: { full_name: name },
      },
    });

    console.log('[MYLI Debug] signUp response:', {
      user: signUpData?.user?.id,
      identities: signUpData?.user?.identities?.length,
      session: !!signUpData?.session,
      confirmed: signUpData?.user?.confirmed_at,
      error: signUpError?.message,
    });

    if (signUpError) {
      setIsLoading(false);
      setMessage({ type: 'error', text: signUpError.message });
      return;
    }

    // Account already exists (empty identities array)
    if (signUpData.user?.identities?.length === 0) {
      setIsLoading(false);
      setMessage({
        type: 'error',
        text: 'An account with this email already exists. Switch to Sign In and use your password.',
      });
      setEmailAction('sign-in');
      return;
    }

    // Got a session back — email confirm is off, proceed directly
    if (signUpData.session) {
      setMessage({ type: 'success', text: 'Account created. Continuing...' });
      await nextAfterAuth();
      return;
    }

    // No session — try auto sign-in (handles race conditions)
    const { error: autoSignInError } = await supabase.auth.signInWithPassword({ email, password });
    if (!autoSignInError) {
      setMessage({ type: 'success', text: 'Account created. Continuing...' });
      await nextAfterAuth();
      return;
    }
    setIsLoading(false);

    setMessage({
      type: 'error',
      text: 'Account created but could not auto sign-in. Please switch to Sign In and try again.',
    });
    setEmailAction('sign-in');
  };


  const isPhysicalTrack = track === 'physical' || track === 'both';
  const isMentalTrack = track === 'mental' || track === 'both';

  const nextAfterAuth = async () => {
    setIsLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarding_complete')
        .eq('user_id', user.id)
        .single();

      if (profile?.onboarding_complete) {
        setRedirecting(true);
        setMessage({ type: 'success', text: 'Welcome back! Redirecting to dashboard...' });
        window.location.assign('/dashboard');
        return;
      }
    }

    setIsLoading(false);
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
          unit_system: unitSystem,
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
    setMessage({ type: 'success', text: 'Onboarding complete. Redirecting to your dashboard...' });
    setTimeout(() => {
      window.location.assign('/dashboard');
    }, 1500);
  };

  const physicalPreview = (() => {
    const age = Number(physicalForm.age);
    const heightCm = Number(physicalForm.heightCm);
    const weightKg = Number(physicalForm.weightKg);
    if (!age || !heightCm || !weightKg || !physicalForm.sex) return null;
    return calculatePhysicalMetrics(age, physicalForm.sex, heightCm, weightKg, physicalForm.activityLevel);
  })();

  if (checkingAuth || redirecting) {
    return (
      <div className="min-h-screen bg-bg-primary text-accent-white flex flex-col items-center justify-center p-6">
        <h1 className="font-display text-4xl tracking-tight mb-4">MYLI</h1>
        <p className="text-accent-muted text-sm animate-pulse">
          {redirecting ? 'Redirecting to your dashboard...' : 'Loading...'}
        </p>
      </div>
    );
  }

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
          <p className="text-accent-muted font-sans font-light tracking-wide text-sm">
            {stepLabels[step] ?? `Step ${step}`}
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

          {/* Step 1 — Track Selection */}
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

          {/* Step 2 — Email Auth Form */}
          {step === 2 && (
            <motion.form
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-4 overflow-hidden"
              onSubmit={handleEmailAuth}
            >
              <div className="grid grid-cols-2 gap-4">
                <Button
                  type="button"
                  className={emailAction === 'sign-in' ? 'h-12 bg-accent-gold text-bg-primary hover:bg-accent-gold/90' : 'h-12 border border-bg-surface bg-transparent text-accent-muted hover:text-accent-white'}
                  onClick={() => { setEmailAction('sign-in'); clearFeedback(); }}
                  disabled={isLoading}
                >
                  Sign In
                </Button>
                <Button
                  type="button"
                  className={emailAction === 'sign-up' ? 'h-12 bg-accent-gold text-bg-primary hover:bg-accent-gold/90' : 'h-12 border border-bg-surface bg-transparent text-accent-muted hover:text-accent-white'}
                  onClick={() => { setEmailAction('sign-up'); clearFeedback(); }}
                  disabled={isLoading}
                >
                  Create Account
                </Button>
              </div>

              {emailAction === 'sign-up' && (
                <Input
                  type="text"
                  placeholder="Full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-14 bg-bg-surface border-none text-accent-white placeholder:text-accent-muted focus-visible:ring-1 focus-visible:ring-accent-gold"
                  required
                />
              )}

              <Input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-14 bg-bg-surface border-none text-accent-white placeholder:text-accent-muted focus-visible:ring-1 focus-visible:ring-accent-gold"
                required
              />
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-14 bg-bg-surface border-none text-accent-white placeholder:text-accent-muted focus-visible:ring-1 focus-visible:ring-accent-gold"
                required
              />

              <div className="flex gap-4 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => { clearFeedback(); setStep(1); }}
                  className="h-12 flex-1 border border-bg-surface text-accent-muted hover:text-accent-white"
                  disabled={isLoading}
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  className="h-12 flex-1 bg-accent-gold text-bg-primary hover:bg-accent-gold/90 font-medium"
                  disabled={isLoading}
                >
                  {isLoading ? 'Working...' : emailAction === 'sign-in' ? 'Sign In' : 'Create Account'}
                </Button>
              </div>
            </motion.form>
          )}


          {/* Step 3 — Physical Profile */}
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
              <select
                value={physicalForm.sex}
                onChange={(e) => setPhysicalForm((prev) => ({ ...prev, sex: e.target.value }))}
                className="h-12 w-full rounded-lg bg-bg-surface border-none px-3 text-accent-white outline-none"
              >
                <option value="" disabled>Sex</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>

              {/* Unit system toggle */}
              <div className="flex items-center gap-2 rounded-lg bg-bg-surface p-1">
                <button
                  type="button"
                  onClick={() => setUnitSystem('metric')}
                  className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                    unitSystem === 'metric'
                      ? 'bg-accent-gold text-bg-primary'
                      : 'text-accent-muted hover:text-accent-white'
                  }`}
                >
                  Metric (kg / cm)
                </button>
                <button
                  type="button"
                  onClick={() => setUnitSystem('imperial')}
                  className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                    unitSystem === 'imperial'
                      ? 'bg-accent-gold text-bg-primary'
                      : 'text-accent-muted hover:text-accent-white'
                  }`}
                >
                  Imperial (lbs / ft)
                </button>
              </div>

              {/* Height */}
              {unitSystem === 'metric' ? (
                <Input
                  type="number"
                  placeholder="Height (cm)"
                  value={physicalForm.heightCm}
                  onChange={(e) => setPhysicalForm((prev) => ({ ...prev, heightCm: e.target.value }))}
                  className="h-12 bg-bg-surface border-none text-accent-white placeholder:text-accent-muted"
                />
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    type="number"
                    placeholder="Feet"
                    value={heightFt}
                    onChange={(e) => setHeightFt(e.target.value)}
                    className="h-12 bg-bg-surface border-none text-accent-white placeholder:text-accent-muted"
                    min="0"
                    max="9"
                  />
                  <Input
                    type="number"
                    placeholder="Inches"
                    value={heightIn}
                    onChange={(e) => setHeightIn(e.target.value)}
                    className="h-12 bg-bg-surface border-none text-accent-white placeholder:text-accent-muted"
                    min="0"
                    max="11"
                  />
                </div>
              )}

              {/* Weight */}
              {unitSystem === 'metric' ? (
                <Input
                  type="number"
                  placeholder="Weight (kg)"
                  value={physicalForm.weightKg}
                  onChange={(e) => setPhysicalForm((prev) => ({ ...prev, weightKg: e.target.value }))}
                  className="h-12 bg-bg-surface border-none text-accent-white placeholder:text-accent-muted"
                />
              ) : (
                <Input
                  type="number"
                  placeholder="Weight (lbs)"
                  value={weightLbs}
                  onChange={(e) => setWeightLbs(e.target.value)}
                  className="h-12 bg-bg-surface border-none text-accent-white placeholder:text-accent-muted"
                />
              )}

              <select
                value={physicalForm.activityLevel}
                onChange={(e) => setPhysicalForm((prev) => ({ ...prev, activityLevel: e.target.value }))}
                className="h-12 w-full rounded-lg bg-bg-surface border-none px-3 text-accent-white outline-none"
              >
                <option value="sedentary">Sedentary</option>
                <option value="lightly_active">Lightly Active</option>
                <option value="moderately_active">Moderately Active</option>
                <option value="very_active">Very Active</option>
                <option value="athlete">Athlete</option>
              </select>
              <select
                value={physicalForm.goal}
                onChange={(e) => setPhysicalForm((prev) => ({ ...prev, goal: e.target.value }))}
                className="h-12 w-full rounded-lg bg-bg-surface border-none px-3 text-accent-white outline-none"
              >
                <option value="maintain">Maintain</option>
                <option value="lose_fat">Lose Fat</option>
                <option value="build_muscle">Build Muscle</option>
                <option value="improve_endurance">Improve Endurance</option>
                <option value="recomposition">Recomposition</option>
              </select>
              {physicalPreview && (
                <div className="rounded-md border border-bg-surface p-4 text-sm">
                  <p className="text-accent-muted mb-2 font-mono text-xs uppercase tracking-widest">Live Health Metrics</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <p className="text-accent-muted text-xs">BMI</p>
                      <p className="text-accent-gold font-display text-xl">{physicalPreview.bmi}</p>
                    </div>
                    <div>
                      <p className="text-accent-muted text-xs">BMR</p>
                      <p className="text-accent-gold font-display text-xl">{physicalPreview.bmr}</p>
                    </div>
                    <div>
                      <p className="text-accent-muted text-xs">TDEE</p>
                      <p className="text-accent-gold font-display text-xl">{physicalPreview.tdee}</p>
                    </div>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <Button type="button" variant="ghost" className="h-12 border border-bg-surface text-accent-muted hover:text-accent-white" onClick={() => setStep(2)}>
                  Back
                </Button>
                <Button
                  type="button"
                  className="h-12 bg-accent-gold text-bg-primary hover:bg-accent-gold/90"
                  onClick={() => {
                    if (!physicalForm.age || !physicalForm.sex || !physicalForm.heightCm || !physicalForm.weightKg) {
                      setMessage({ type: 'error', text: 'Please fill in all physical profile fields.' });
                      return;
                    }
                    clearFeedback();
                    setStep(isMentalTrack ? 4 : 5);
                  }}
                >
                  Continue
                </Button>
              </div>
            </div>
          )}

          {/* Step 4 — Mental Profile */}
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
                step="0.5"
                min="0"
                max="24"
              />
              <select
                value={mentalForm.productivityStyle}
                onChange={(e) => setMentalForm((prev) => ({ ...prev, productivityStyle: e.target.value }))}
                className="h-12 w-full rounded-lg bg-bg-surface border-none px-3 text-accent-white outline-none"
              >
                <option value="deep_work">Deep Work</option>
                <option value="pomodoro">Pomodoro</option>
                <option value="time_blocking">Time Blocking</option>
                <option value="flexible">Flexible</option>
              </select>
              <Input
                type="text"
                placeholder="Life areas to improve (comma separated)"
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

          {/* Step 5 — Welcome / Save */}
          {step === 5 && (
            <div className="space-y-4">
              <h2 className="font-display text-3xl">Welcome to MYLI</h2>
              <p className="text-accent-muted">
                Your profile is ready. We will personalize your daily intelligence feed.
              </p>
              {physicalPreview && isPhysicalTrack && (
                <div className="rounded-md border border-bg-surface p-4 text-sm">
                  <p className="text-accent-muted mb-3 font-mono text-xs uppercase tracking-widest">Your Health Metrics</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <p className="text-accent-muted text-xs">BMI</p>
                      <p className="text-accent-white font-display text-2xl">{physicalPreview.bmi}</p>
                    </div>
                    <div>
                      <p className="text-accent-muted text-xs">BMR</p>
                      <p className="text-accent-white font-display text-2xl">{physicalPreview.bmr}</p>
                    </div>
                    <div>
                      <p className="text-accent-muted text-xs">TDEE</p>
                      <p className="text-accent-white font-display text-2xl">{physicalPreview.tdee}</p>
                    </div>
                  </div>
                </div>
              )}
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
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
