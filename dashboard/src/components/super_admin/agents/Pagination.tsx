import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  total: number;
  pageSize: number;
  onChange: (newPage: number) => void;
}

export default function Pagination({ page, total, pageSize, onChange }: PaginationProps) {
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-glass-border">
      <div className="text-[12px] text-text-muted font-medium">
        Showing <span className="font-bold text-text-primary">{(page - 1) * pageSize + 1}</span> to{' '}
        <span className="font-bold text-text-primary">{Math.min(page * pageSize, total)}</span> of{' '}
        <span className="font-bold text-text-primary">{total}</span> results
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page === 1}
          className="p-1 rounded bg-bg-root border border-glass-border-dim text-text-secondary disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/50 transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="text-[12px] font-bold text-text-secondary px-2">
          Page {page} of {totalPages}
        </div>
        <button
          onClick={() => onChange(page + 1)}
          disabled={page >= totalPages}
          className="p-1 rounded bg-bg-root border border-glass-border-dim text-text-secondary disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/50 transition-colors"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
