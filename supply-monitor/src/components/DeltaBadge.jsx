import { ArrowUp, ArrowDown, Minus } from 'lucide-react';

// Selo compacto de variação vs. período anterior — usado nos KPIs do
// dashboard para dar contexto de tendência (subiu/caiu e quanto).
const DeltaBadge = ({ value, goodDirection = 'up', format = 'percent', label = 'vs. período anterior' }) => {
  if (value === null || value === undefined) {
    return <span className="text-[10px] font-bold text-slate-300">Estreite o período para comparar</span>;
  }

  const rounded = Math.round(value * 10) / 10;
  const suffix = format === 'points' ? 'p.p.' : '%';

  if (rounded === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400">
        <Minus size={10} /> estável {label}
      </span>
    );
  }

  const isUp = rounded > 0;
  const Icon = isUp ? ArrowUp : ArrowDown;
  const colorClass = goodDirection === 'neutral'
    ? 'text-slate-500'
    : (goodDirection === 'up' ? isUp : !isUp) ? 'text-emerald-600' : 'text-red-600';

  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold ${colorClass}`}>
      <Icon size={10} /> {Math.abs(rounded)}{suffix} {label}
    </span>
  );
};

export default DeltaBadge;
