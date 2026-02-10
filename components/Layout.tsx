
import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Building2, 
  Users, 
  ReceiptEuro, 
  Files, 
  FileBarChart2, 
  Settings,
  Menu,
  X,
  RefreshCcw
} from 'lucide-react';
import { clsx } from 'clsx';

interface LayoutProps {
  children: React.ReactNode;
}

const NavItem = ({ to, icon: Icon, label }: { to: string; icon: any; label: string }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      clsx(
        "flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-semibold",
        isActive
          ? "bg-blue-600 text-white shadow-lg shadow-blue-200"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      )
    }
  >
    <Icon className="w-5 h-5" />
    <span>{label}</span>
  </NavLink>
);

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isSidebarOpen, setSidebarOpen] = React.useState(false);

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={clsx(
          "fixed lg:sticky top-0 left-0 h-screen w-64 bg-white border-r border-slate-200 z-30 transition-transform duration-300 ease-in-out lg:translate-x-0",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="p-8 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2 text-blue-700 font-black text-2xl tracking-tight">
            <Building2 className="w-8 h-8" />
            <span>ImmoPi</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-slate-500">
            <X className="w-6 h-6" />
          </button>
        </div>

        <nav className="p-4 space-y-1.5 overflow-y-auto max-h-[calc(100vh-100px)]">
          <NavItem to="/" icon={LayoutDashboard} label="Dashboard" />
          <NavItem to="/properties" icon={Building2} label="Properties" />
          <NavItem to="/transactions" icon={ReceiptEuro} label="Transactions" />
          <NavItem to="/recurring" icon={RefreshCcw} label="Automation" />
          <NavItem to="/documents" icon={Files} label="Documents" />
          <NavItem to="/tenants" icon={Users} label="Tenants" />
          <NavItem to="/reports" icon={FileBarChart2} label="Reports" />
          <div className="pt-4 mt-4 border-t border-slate-100">
            <NavItem to="/settings" icon={Settings} label="Settings" />
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 flex flex-col">
        {/* Mobile Header */}
        <div className="lg:hidden bg-white/80 backdrop-blur-md sticky top-0 border-b border-slate-200 p-4 flex items-center justify-between z-10">
          <button onClick={() => setSidebarOpen(true)} className="text-slate-600 p-2 hover:bg-slate-100 rounded-lg">
            <Menu className="w-6 h-6" />
          </button>
          <span className="font-bold text-slate-800 tracking-tight">ImmoPi Manager</span>
          <div className="w-10" /> {/* Spacer */}
        </div>

        <div className="flex-1 p-4 lg:p-10 max-w-7xl mx-auto w-full">
          {children}
        </div>
      </main>
    </div>
  );
};
