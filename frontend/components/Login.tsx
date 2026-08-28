
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import { Loader2, Lock, ArrowRight, Mail, User as UserIcon, CheckCircle } from 'lucide-react';
import {authAPI} from '../services/backendService';
import { User } from '../types';
import { validateEmail, validatePassword } from '../utils/validation';
import { useServerSettings } from '../contexts/ServerSettingsContext';

// Isolated component so useGoogleLogin is only called inside GoogleOAuthProvider.
const GoogleLoginButton: React.FC<{ redirectUri: string; returnTo?: string }> = ({ redirectUri, returnTo }) => {
  const initiateGoogleLogin = useGoogleLogin({
    flow: 'auth-code',
    ux_mode: 'redirect',
    redirect_uri: redirectUri,
  });
  return (
    <button
      type="button"
      data-analytics="login_google"
      onClick={() => {
        if (returnTo && returnTo !== '/') {
          sessionStorage.setItem('googleLoginReturnTo', `${window.location.origin}/app${returnTo}`);
        } else {
          sessionStorage.removeItem('googleLoginReturnTo');
        }
        initiateGoogleLogin();
      }}
      className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 text-gray-800 font-medium py-2.5 px-4 rounded-lg border border-gray-300 transition-colors shadow-sm"
    >
      <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
        <g fill="none" fillRule="evenodd">
          <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
          <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
          <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
          <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
        </g>
      </svg>
      Continue with Google
    </button>
  );
};

interface LoginProps {
  onLoginSuccess: (user: User) => void;
  returnTo?: string;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess, returnTo }) => {
  const { googleClientId } = useServerSettings();
  const [mode, setMode] = useState<'login' | 'register' | 'verify_pending' | 'forgot_password' | 'reset_password' | 'reset_success' | 'verify_success'>('login');
  const [pendingType, setPendingType] = useState<'email' | 'password_reset'>('email');
  const [loading, setLoading] = useState(false);
  const [processingOAuth, setProcessingOAuth] = useState(() => new URLSearchParams(window.location.search).has('code'));
  const [usernameInput, setUsernameInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [tokenInput, setTokenInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [agreedToEula, setAgreedToEula] = useState(false);

  const handleSignIn = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (usernameInput.length < 2) { setError("Please enter your username or email."); return; }
    if (!passwordInput) { setError("Please enter your password."); return; }
    setLoading(true);
    try {
      const data = await authAPI.login(usernameInput, passwordInput);
      onLoginSuccess(data);
    } catch (err: any) {
      setError(err.message || "Login failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!agreedToEula) { setError("You must agree to the License Agreement to register."); return; }
    if (usernameInput.length < 2) { setError("Username must be at least 2 characters."); return; }
    const emailError = validateEmail(emailInput);
    if (emailError) { setError(emailError); return; }
    const passwordError = validatePassword(passwordInput);
    if (passwordError) { setError(passwordError); return; }
    setLoading(true);
    try {
      await authAPI.register({ username: usernameInput, email: emailInput, password: passwordInput });
      setPendingType('email');
      setTokenInput('');
      setMode('verify_pending');
    } catch (err: any) {
      setError(err.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const emailError = validateEmail(emailInput);
    if (emailError) { setError(emailError); return; }
    setLoading(true);
    try {
      await authAPI.requestPasswordReset(emailInput);
      setPendingType('password_reset');
      setTokenInput('');
      setMode('verify_pending');
    } catch (err: any) {
      setError(err.message || "Request failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const passwordError = validatePassword(passwordInput);
    if (passwordError) { setError(passwordError); return; }
    setLoading(true);
    try {
      await authAPI.confirmPasswordReset(resetToken, passwordInput);
      setMode('reset_success');
    } catch (err: any) {
      setError(err.message || "Password reset failed. The token may have expired.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitToken = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!tokenInput.trim()) { setError("Please enter the token from your email."); return; }
    if (pendingType === 'email') {
      setLoading(true);
      try {
        await authAPI.verifyEmail(tokenInput.trim());
        setMode('verify_success');
      } catch (err: any) {
        setError(err.message || "Email verification failed. The token may have expired.");
      } finally {
        setLoading(false);
      }
    } else {
      setResetToken(tokenInput.trim());
      setTokenInput('');
      setPasswordInput('');
      setMode('reset_password');
    }
  };

  const switchMode = (next: 'login' | 'register') => {
    setMode(next);
    setError(null);
    setUsernameInput('');
    setEmailInput('');
    setPasswordInput('');
    setAgreedToEula(false);
  };

  // Compute the redirect URI once — must be identical when initiating the
  // login and when exchanging the auth code on the backend.
  const googleRedirectUri = `${window.location.origin}/app/login`;

  // Handle Google's redirect callback: detect ?code= in URL on mount.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (!code) return;

    // Remove the code from the URL immediately to prevent re-processing on re-render.
    window.history.replaceState({}, '', window.location.pathname);

    setError(null);
    setLoading(true);
    authAPI.googleLoginWithCode(code, googleRedirectUri)
      .then((user) => {
        // Restore the URL the user was on before the Google OAuth redirect (e.g. a shared session link).
        const savedReturnUrl = sessionStorage.getItem('googleLoginReturnTo');
        sessionStorage.removeItem('googleLoginReturnTo');
        onLoginSuccess(user);
        if (savedReturnUrl) {
          try {
            const url = new URL(savedReturnUrl);
            if (!url.pathname.startsWith('/app/login')) {
              window.location.replace(savedReturnUrl);
            }
          } catch {
            // Ignore invalid stored URLs
          }
        }
      })
      .catch((err: any) => setError(err.message || 'Google sign-in failed. Please try again.'))
      .finally(() => { setLoading(false); setProcessingOAuth(false); });
  // googleRedirectUri is derived from window.location.origin which is stable — safe to omit.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onLoginSuccess]);

  if (processingOAuth) {
    return (
      <div className="fixed inset-0 bg-[#020617] flex items-center justify-center">
        <Loader2 size={48} className="text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-[#020617] font-sans overflow-hidden">
      {/* Premium Background Atmosphere (Fixed) */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none opacity-50"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] bg-indigo-600/10 blur-[100px] rounded-full pointer-events-none"></div>

      {/* Scrollable Content Wrapper */}
      <div className="absolute inset-0 overflow-y-auto">
        <div className="min-h-full flex flex-col items-center justify-center p-4 py-8">
          <div className="w-full max-w-[420px] z-10">
            <div className="text-center mb-8 md:mb-10 animate-slide-up">
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-2 tracking-tight">AiWorks</h1>
              <p className="text-slate-400 text-xs md:text-sm font-medium tracking-wide">Sample APP</p>
            </div>

            <div className="bg-slate-900/40 backdrop-blur-2xl border border-white/5 p-6 md:p-10 rounded-[2rem] md:rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative overflow-hidden group">
              {/* Subtle top light effect */}
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent"></div>

              {/* Verify pending – paste token from email */}
              {mode === 'verify_pending' && (
                <div className="flex flex-col gap-4 py-2">
                  <div className="flex flex-col items-center gap-3">
                    <CheckCircle className="text-blue-400" size={40} />
                    <h2 className="text-xl font-bold text-white">Check your email</h2>
                    <p className="text-slate-400 text-sm text-center leading-relaxed">
                      We have sent you an email with a token. Please check your inbox (and spam folder) and paste the token below.
                    </p>
                  </div>
                  <form onSubmit={handleSubmitToken} className="space-y-4 mt-2">
                    <div className="space-y-2">
                      <label className="text-[10px] md:text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">Token</label>
                      <input
                        type="text"
                        value={tokenInput}
                        onChange={(e) => setTokenInput(e.target.value)}
                        placeholder="Paste your token here"
                        className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl py-3 md:py-3.5 px-4 text-base text-white focus:outline-none focus:border-blue-500 transition-all placeholder:text-slate-700"
                        autoFocus
                      />
                    </div>
                    {error && (
                      <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs animate-pulse">
                        {error}
                      </div>
                    )}
                    <button
                      type="submit"
                      data-analytics="submit_token"
                      disabled={loading}
                      className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 md:py-4 rounded-2xl transition-all shadow-xl shadow-blue-600/20 flex items-center justify-center gap-3 group active:scale-[0.98]"
                    >
                      {loading ? <Loader2 className="animate-spin" size={20} /> : <>Submit Token <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" /></>}
                    </button>
                    <button
                      type="button"
                      data-analytics="back_to_signin"
                      onClick={() => switchMode('login')}
                      className="w-full text-slate-500 hover:text-slate-300 text-sm mt-1"
                    >
                      Back to Sign In
                    </button>
                  </form>
                </div>
              )}

              {/* Reset success */}
              {mode === 'reset_success' && (
                <div className="flex flex-col items-center gap-4 py-4">
                  <CheckCircle className="text-green-400" size={40} />
                  <h2 className="text-xl font-bold text-white">Password reset!</h2>
                  <p className="text-slate-400 text-sm text-center leading-relaxed">
                    Your password has been reset successfully. You can now sign in with your new password.
                  </p>
                  <button
                    type="button"
                    data-analytics="signin"
                    onClick={() => switchMode('login')}
                    className="mt-2 text-blue-400 hover:text-blue-300 text-sm underline"
                  >
                    Sign In
                  </button>
                </div>
              )}

              {/* Email verify success */}
              {mode === 'verify_success' && (
                <div className="flex flex-col items-center gap-4 py-4">
                  <CheckCircle className="text-green-400" size={40} />
                  <h2 className="text-xl font-bold text-white">Email verified!</h2>
                  <p className="text-slate-400 text-sm text-center leading-relaxed">
                    Your email has been verified successfully. You can now sign in with your credentials.
                  </p>
                  <button
                    type="button"
                    data-analytics="signin"
                    onClick={() => switchMode('login')}
                    className="mt-2 text-blue-400 hover:text-blue-300 text-sm underline"
                  >
                    Sign In
                  </button>
                </div>
              )}

              {/* Reset password form */}
              {mode === 'reset_password' && (
                <>
                  <div className="mb-6 md:mb-8">
                    <h2 className="text-xl md:text-2xl font-bold text-white mb-2">Set New Password</h2>
                    <p className="text-slate-400 text-sm leading-relaxed">Enter your new password below.</p>
                  </div>
                  <form onSubmit={handleResetPassword} className="space-y-4 md:space-y-5">
                    <div className="space-y-2">
                      <label className="text-[10px] md:text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">New Password</label>
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
                        <input
                          type="password"
                          value={passwordInput}
                          onChange={(e) => setPasswordInput(e.target.value)}
                          placeholder="Choose a new password (min 8 chars)"
                          className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl py-3 md:py-3.5 pl-12 pr-4 text-base text-white focus:outline-none focus:border-blue-500 transition-all placeholder:text-slate-700"
                          required
                          autoFocus
                        />
                      </div>
                    </div>
                    {error && (
                      <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs animate-pulse">
                        {error}
                      </div>
                    )}
                    <button
                      type="submit"
                      data-analytics="reset_password"
                      disabled={loading}
                      className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 md:py-4 rounded-2xl transition-all shadow-xl shadow-blue-600/20 flex items-center justify-center gap-3 group active:scale-[0.98] disabled:opacity-70 mt-4"
                    >
                      {loading ? <Loader2 className="animate-spin" size={20} /> : <>Reset Password <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" /></>}
                    </button>
                  </form>
                </>
              )}

              {/* Forgot password form */}
              {mode === 'forgot_password' && (
                <>
                  <div className="mb-6 md:mb-8">
                    <h2 className="text-xl md:text-2xl font-bold text-white mb-2">Reset Password</h2>
                    <p className="text-slate-400 text-sm leading-relaxed">Enter your email and we'll send you a reset token.</p>
                  </div>
                  <form onSubmit={handleForgotPassword} className="space-y-4 md:space-y-5">
                    <div className="space-y-2">
                      <label className="text-[10px] md:text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">Email</label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
                        <input
                          type="email"
                          value={emailInput}
                          onChange={(e) => setEmailInput(e.target.value)}
                          placeholder="Enter your email"
                          className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl py-3 md:py-3.5 pl-12 pr-4 text-base text-white focus:outline-none focus:border-blue-500 transition-all placeholder:text-slate-700"
                          required
                          autoFocus
                        />
                      </div>
                    </div>
                    {error && (
                      <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs animate-pulse">
                        {error}
                      </div>
                    )}
                    <button
                      type="submit"
                      data-analytics="request_password_reset"
                      disabled={loading}
                      className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 md:py-4 rounded-2xl transition-all shadow-xl shadow-blue-600/20 flex items-center justify-center gap-3 group active:scale-[0.98] disabled:opacity-70 mt-4"
                    >
                      {loading ? <Loader2 className="animate-spin" size={20} /> : <>Send Reset Token <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" /></>}
                    </button>
                    <button
                      type="button"
                      data-analytics="back_to_signin"
                      onClick={() => switchMode('login')}
                      className="w-full text-slate-500 hover:text-slate-300 text-sm mt-2"
                    >
                      Back to Sign In
                    </button>
                  </form>
                </>
              )}

              {/* Login / Register tabs */}
              {(mode === 'login' || mode === 'register') && (
                <>

                  {googleClientId && (
                    <>
                      <GoogleLoginButton redirectUri={googleRedirectUri} returnTo={returnTo} />
                      <div className="flex items-center gap-3 my-5">
                        <div className="flex-1 h-px bg-slate-800" />
                        <span className="text-xs text-slate-600 font-medium uppercase tracking-widest">or</span>
                        <div className="flex-1 h-px bg-slate-800" />
                      </div>
                    </>
                  )}

                  {/* Mode tabs */}
                  <div className="flex mb-6 md:mb-8 bg-slate-950/50 rounded-2xl p-1 gap-1">
                    <button
                      type="button"
                      data-analytics="switch_to_signin"
                      onClick={() => switchMode('login')}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${mode === 'login' ? 'bg-blue-600 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                      Sign In
                    </button>
                    <button
                      type="button"
                      data-analytics="switch_to_register"
                      onClick={() => switchMode('register')}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${mode === 'register' ? 'bg-blue-600 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                      Register
                    </button>
                  </div>

                  <div className="mb-6 md:mb-8">
                    <h2 className="text-xl md:text-2xl font-bold text-white mb-2">{mode === 'login' ? 'Welcome' : 'Create Account'}</h2>
                    <p className="text-slate-400 text-sm leading-relaxed">
                      {mode === 'login' ? 'Enter your details to access the app.' : 'Register for access.'}
                    </p>
                  </div>

                  <form onSubmit={mode === 'login' ? handleSignIn : handleRegister} className="space-y-4 md:space-y-5">
                    <div className="space-y-2">
                      <label className="text-[10px] md:text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">Username</label>
                      <div className="relative">
                        <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
                        <input
                          data-testid="input-username"
                          type="text"
                          value={usernameInput}
                          onChange={(e) => setUsernameInput(e.target.value)}
                          placeholder="Enter your username"
                          className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl py-3 md:py-3.5 pl-12 pr-4 text-base text-white focus:outline-none focus:border-blue-500 transition-all placeholder:text-slate-700"
                          required
                          autoFocus
                        />
                      </div>
                    </div>

                    {mode === 'register' && (
                      <div className="space-y-2">
                        <label className="text-[10px] md:text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">Email</label>
                        <div className="relative">
                          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
                          <input
                            type="email"
                            value={emailInput}
                            onChange={(e) => setEmailInput(e.target.value)}
                            placeholder="Enter your email"
                            className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl py-3 md:py-3.5 pl-12 pr-4 text-base text-white focus:outline-none focus:border-blue-500 transition-all placeholder:text-slate-700"
                            required
                          />
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="text-[10px] md:text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">Password</label>
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
                        <input
                          data-testid="input-password"
                          type="password"
                          value={passwordInput}
                          onChange={(e) => setPasswordInput(e.target.value)}
                          placeholder={mode === 'register' ? 'Choose a password (min 8 chars)' : 'Enter your password'}
                          className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl py-3 md:py-3.5 pl-12 pr-4 text-base text-white focus:outline-none focus:border-blue-500 transition-all placeholder:text-slate-700"
                          required
                        />
                      </div>
                    </div>

                    {mode === 'register' && (
                      <div className="flex items-start gap-3 pt-1">
                        <input
                          type="checkbox"
                          id="eula-agree"
                          checked={agreedToEula}
                          onChange={(e) => setAgreedToEula(e.target.checked)}
                          className="mt-0.5 w-4 h-4 rounded accent-blue-600 cursor-pointer flex-shrink-0"
                        />
                        <label htmlFor="eula-agree" className="text-xs text-slate-400 leading-relaxed cursor-pointer">
                          I have read and agree to the{' '}
                          <a href="/eula" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                            License Agreement
                          </a>
                          {' '}and the{' '}
                          <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                            Privacy Policy
                          </a>
                        </label>
                      </div>
                    )}

                    {error && (
                      <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs animate-pulse">
                        {error}
                      </div>
                    )}

                    <button
                      data-analytics="login_submit"
                      data-testid="btn-login"
                      type="submit"
                      disabled={loading}
                      className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 md:py-4 rounded-2xl transition-all shadow-xl shadow-blue-600/20 flex items-center justify-center gap-3 group active:scale-[0.98] disabled:opacity-70 mt-4"
                    >
                      {loading ? (
                        <Loader2 className="animate-spin" size={20} />
                      ) : (
                        <>
                          {mode === 'login' ? 'Enter' : 'Create Account'}
                          <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                        </>
                      )}
                    </button>

                    {mode === 'login' && (
                      <button
                        type="button"
                        data-analytics="forgot_password"
                        onClick={() => { setMode('forgot_password'); setError(null); setEmailInput(''); }}
                        className="w-full text-slate-500 hover:text-slate-300 text-sm mt-1"
                      >
                        Forgot password?
                      </button>
                    )}
                  </form>
                </>
              )}
            </div>

            {/* Legal links footer */}
            <div className="mt-6 text-center text-[11px] text-slate-600 space-x-3">
              <Link to="/eula" target="_blank" rel="noopener noreferrer" className="hover:text-slate-400 transition-colors">
                License Agreement
              </Link>
              <span>·</span>
              <Link to="/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-slate-400 transition-colors">
                Privacy Policy
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
