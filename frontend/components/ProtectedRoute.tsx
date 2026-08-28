import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useGlobal } from '../contexts/GlobalContext';

const ProtectedRoute: React.FC = () => {
  const { user, authLoading } = useAuth();
  const { isInitialDataLoading } = useGlobal();
  const location = useLocation();

  if (authLoading || isInitialDataLoading) {
    return (
      <div className="fixed inset-0 bg-[#020617] flex items-center justify-center">
        <Loader2 size={48} className="text-blue-500 animate-spin" />
      </div>
    );
  }

  if (!user) {
    // Preserve the current path so we can redirect back after login
    return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
