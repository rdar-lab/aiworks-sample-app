import React, { useCallback, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import Login from '../components/Login';
import { useAuth } from '../contexts/AuthContext';
import { User } from '../types';

const LoginPage: React.FC = () => {
  const { user, authLoading, setUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // The page the user was trying to reach before being redirected to login (or home)
  const from = (location.state as any)?.from || '/';

  // Navigate to the intended destination whenever the user becomes authenticated.
  // Using useEffect avoids a race condition where React re-renders this component
  // with user !== null mid-render (after setUser but before the navigate call
  // completes), causing a synchronous <Navigate to="/"> to override the intended
  // redirect target.
  useEffect(() => {
    if (!authLoading && user) {
      navigate(from, { replace: true });
    }
  }, [user, authLoading, from, navigate]);

  const handleLoginSuccess = useCallback((loggedInUser: User) => {
    setUser(loggedInUser);
    // Navigation to `from` is handled by the useEffect above.
  }, [setUser]);

  if (authLoading) {
    return (
      <div className="fixed inset-0 bg-[#020617] flex items-center justify-center">
        <Loader2 size={48} className="text-blue-500 animate-spin" />
      </div>
    );
  }

  // User is authenticated — the effect above will handle the redirect.
  // Render nothing while the navigation fires to avoid a flash of the login form.
  if (user) return null;

  return <Login onLoginSuccess={handleLoginSuccess} returnTo={from} />;
};

export default LoginPage;
