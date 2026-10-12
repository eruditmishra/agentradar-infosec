interface StatCardProps {
  color: 'brand' | 'red' | 'amber' | 'purple' | 'green';
  label: string;
  value: string | number;
  sub?: string;
  trend?: string;
  onClick?: () => void;
}

export default function StatCard({ color, label, value, sub, trend, onClick }: StatCardProps) {
  const cMap = {
    brand: { bg: 'bg-brand/10', text: 'text-brand', trendBg: 'bg-brand/10', border: 'border-brand/20', glow: 'bg-brand' },
    red: { bg: 'bg-red/10', text: 'text-red', trendBg: 'bg-red/10', border: 'border-red/20', glow: 'bg-red' },
    amber: { bg: 'bg-amber/10', text: 'text-amber', trendBg: 'bg-amber/10', border: 'border-amber/20', glow: 'bg-amber' },
    purple: { bg: 'bg-purple/10', text: 'text-purple', trendBg: 'bg-purple/10', border: 'border-purple/20', glow: 'bg-purple' },
    green: { bg: 'bg-green/10', text: 'text-green', trendBg: 'bg-green/10', border: 'border-green/20', glow: 'bg-green' },
  };

  const c = cMap[color] || cMap.brand;

  return (
    <div
      onClick={onClick}
      className={`relative px-6 py-5 bg-white/70 backdrop-blur-[12px] border border-glass-border rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.02),inset_0_1px_0_rgba(255,255,255,1)] overflow-hidden transition-transform ${onClick ? 'cursor-pointer hover:-translate-y-0.5' : ''}`}
    >
      {/* Absolute Glow */}
      <div className={`absolute -top-6 -right-6 w-28 h-28 rounded-full blur-[32px] opacity-20 ${c.glow}`} />
      
      <div className="text-[11px] font-bold text-text-muted tracking-widest mb-4 uppercase">
        {label}
      </div>
      
      <div className={`font-display text-[42px] font-extrabold ${c.text} leading-none mb-4 tracking-tight`}>
        {value}
      </div>
      
      {sub && (
        <div className="text-[12px] text-text-muted font-medium mt-1">
          {sub}
        </div>
      )}
      
      {trend && (
        <span className={`absolute top-5 right-5 ${c.trendBg} ${c.text} border ${c.border} px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide`}>
          {trend}
        </span>
      )}
    </div>
  );
}
