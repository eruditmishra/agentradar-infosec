import { useState, useRef, useEffect } from 'react';
import { User, LogOut, ChevronDown } from 'lucide-react';
import useStore from '../../store/useStore';

export default function Header() {
  const user = useStore((s) => s.user);
  const logout = useStore((s) => s.logout);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="h-16 border-b border-slate-200 bg-white/80 backdrop-blur-md flex items-center justify-end px-6 relative z-20 shrink-0">
      <div className="relative" ref={dropdownRef}>
        <button 
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center gap-2.5 hover:bg-slate-50 p-1.5 pr-3 rounded-full border border-slate-200 transition-colors bg-white shadow-sm"
        >
          <div className="w-8 h-8 bg-brand/10 text-brand rounded-full flex items-center justify-center font-bold text-sm border border-brand/20">
            {user?.name?.charAt(0)?.toUpperCase() || <User size={16} />}
          </div>
          <span className="text-sm font-semibold text-slate-700">{user?.name || 'Admin'}</span>
          <ChevronDown size={14} className="text-slate-400" />
        </button>

        {dropdownOpen && (
          <div className="absolute right-0 mt-2 w-52 bg-white border border-slate-200 rounded-xl shadow-lg py-1 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-50">
            <div className="px-4 py-3 border-b border-slate-100 mb-1 bg-slate-50/50">
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-0.5">Signed in as</p>
              <p className="text-sm font-bold text-slate-800 truncate" title={user?.email}>{user?.email || 'admin@agentradar.ai'}</p>
            </div>
            <button 
              onClick={() => {
                setDropdownOpen(false);
                logout();
              }}
              className="w-full text-left px-4 py-2.5 text-sm font-semibold text-red-600 flex items-center gap-2.5 hover:bg-red-50 transition-colors"
            >
              <LogOut size={16} />
              Sign Out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
