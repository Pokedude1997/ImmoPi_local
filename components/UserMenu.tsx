import React from 'react';
import { User, LogOut } from 'lucide-react';
import { useAuth } from './AuthProvider';

export const UserMenu: React.FC = () => {
  const { user, logout, isAdmin } = useAuth();

  if (!user) {
    return null;
  }

  return (
    <div className="flex items-center gap-4 p-4 border-t border-slate-100 bg-slate-50">
      <div className="flex-1">
        <div className="text-sm font-medium text-slate-700">
          {user.username}
        </div>
        <div className="text-xs text-slate-500">
          {isAdmin ? 'Admin' : 'User'}
        </div>
      </div>
      <button
        onClick={logout}
        className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium"
        title="Logout"
      >
        <LogOut className="w-4 h-4" />
        <span className="hidden sm:inline">Logout</span>
      </button>
    </div>
  );
};
