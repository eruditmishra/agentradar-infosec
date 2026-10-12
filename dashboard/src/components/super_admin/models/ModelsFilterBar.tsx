import { Search, Filter, X } from 'lucide-react';
import type { ModelFilters } from '../../../types/discovery';

interface ModelsFilterBarProps {
  filters: ModelFilters;
  activeFilters: {
    search: string;
    provider: string;
    status: string;
    riskLevel: string;
  };
  onChange: (key: string, value: string) => void;
  onClear: () => void;
}

export default function ModelsFilterBar({ filters, activeFilters, onChange, onClear }: ModelsFilterBarProps) {
  const hasActiveFilters = Object.values(activeFilters).some(v => v !== '');

  return (
    <div className="bg-glass-white backdrop-blur-glass border border-glass-border rounded-r12 shadow-glass p-4 mb-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="font-semibold text-text-primary text-[13px] flex items-center gap-2">
          <Filter size={14} className="text-brand" />
          Filter & Search
        </div>
        {hasActiveFilters && (
          <button 
            onClick={onClear}
            className="text-[11px] font-bold text-red flex items-center gap-1 hover:underline"
          >
            <X size={12} /> Clear All
          </button>
        )}
      </div>
      
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={14} className="text-text-muted" />
          </div>
          <input
            type="text"
            placeholder="Search models..."
            value={activeFilters.search}
            onChange={(e) => onChange('search', e.target.value)}
            className="block w-full pl-9 pr-3 py-1.5 border border-glass-border-dim rounded-r8 bg-white/50 text-[12px] placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand transition-colors"
          />
        </div>

        {/* Dropdowns */}
        <select value={activeFilters.provider} onChange={e => onChange('provider', e.target.value)} className="py-1.5 px-3 border border-glass-border-dim rounded-r8 bg-white/50 text-[12px] text-text-secondary focus:outline-none focus:ring-1 focus:ring-brand cursor-pointer">
          <option value="">All Providers</option>
          {filters.providers.map(p => <option key={p} value={p}>{p}</option>)}
        </select>

        <select value={activeFilters.status} onChange={e => onChange('status', e.target.value)} className="py-1.5 px-3 border border-glass-border-dim rounded-r8 bg-white/50 text-[12px] text-text-secondary focus:outline-none focus:ring-1 focus:ring-brand cursor-pointer capitalize">
          <option value="">All Statuses</option>
          {filters.statuses.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <select value={activeFilters.riskLevel} onChange={e => onChange('riskLevel', e.target.value)} className="py-1.5 px-3 border border-glass-border-dim rounded-r8 bg-white/50 text-[12px] text-text-secondary focus:outline-none focus:ring-1 focus:ring-brand cursor-pointer capitalize">
          <option value="">All Risk Levels</option>
          {filters.riskLevels.map(r => <option key={r} value={r}>{r}</option>)}
        </select>

      </div>
    </div>
  );
}
