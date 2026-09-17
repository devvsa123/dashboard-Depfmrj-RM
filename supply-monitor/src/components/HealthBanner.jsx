import { CheckCircle2, AlertTriangle, OctagonAlert } from 'lucide-react';
import InfoButton from './InfoButton';

const CONFIG = {
  good: {
    label: 'Operação Saudável',
    description: 'Nenhum indicador fora da meta no momento.',
    icon: CheckCircle2,
    bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-500'
  },
  warning: {
    label: 'Atenção Necessária',
    icon: AlertTriangle,
    bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', dot: 'bg-amber-500'
  },
  critical: {
    label: 'Situação Crítica',
    icon: OctagonAlert,
    bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', dot: 'bg-red-500'
  }
};

// Semáforo único no topo do dashboard: resume, num relance, se a operação
// está saudável, precisa de atenção ou está crítica — e por quê.
const HealthBanner = ({ health, alerts }) => {
  const cfg = CONFIG[health] || CONFIG.good;
  const Icon = cfg.icon;
  const description = health === 'good'
    ? cfg.description
    : `${alerts.length} ${alerts.length === 1 ? 'ponto' : 'pontos'} de atenção identificado${alerts.length === 1 ? '' : 's'} — veja abaixo.`;

  return (
    <div className={`flex items-center gap-4 p-5 rounded-3xl border ${cfg.bg} ${cfg.border}`}>
      <div className={`relative flex items-center justify-center w-12 h-12 rounded-2xl ${cfg.bg} border ${cfg.border} shrink-0`}>
        <Icon className={cfg.text} size={26} />
        {health !== 'good' && <span className={`absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full ${cfg.dot} animate-pulse border-2 border-white`} />}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-1.5">
          <p className={`text-base font-black ${cfg.text}`}>{cfg.label}</p>
          <InfoButton
            title="Como calculamos"
            description="Comparamos o Nível de Serviço, a idade da fila, o pedido mais antigo e as divergências entre WMS e SINGRA com as metas cadastradas em 'Metas e Progresso'. Verde: tudo dentro da meta. Amarelo: pelo menos um indicador abaixo da meta. Vermelho: pelo menos um indicador muito abaixo da meta."
          />
        </div>
        <p className="text-sm text-slate-500 font-medium">{description}</p>
      </div>
    </div>
  );
};

export default HealthBanner;
