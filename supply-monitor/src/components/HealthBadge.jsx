const CONFIG = {
  good: { label: 'Operação Saudável', dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  warning: { label: 'Atenção Necessária', dot: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  critical: { label: 'Situação Crítica', dot: 'bg-red-500', text: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' }
};

// Versão compacta do semáforo de saúde, para ficar visível no cabeçalho
// independente da aba aberta.
const HealthBadge = ({ health }) => {
  const cfg = CONFIG[health] || CONFIG.good;
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${cfg.bg} ${cfg.border}`}>
      <span className={`w-2 h-2 rounded-full ${cfg.dot} ${health !== 'good' ? 'animate-pulse' : ''}`} />
      <span className={`text-[11px] font-bold ${cfg.text}`}>{cfg.label}</span>
    </div>
  );
};

export default HealthBadge;
