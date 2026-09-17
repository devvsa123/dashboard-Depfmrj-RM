import { AlertTriangle, OctagonAlert, CheckCircle2, ChevronRight } from 'lucide-react';

const SEVERITY_CONFIG = {
  critical: { icon: OctagonAlert, bg: 'bg-red-50', border: 'border-red-100', text: 'text-red-700', badge: 'bg-red-600' },
  warning: { icon: AlertTriangle, bg: 'bg-amber-50', border: 'border-amber-100', text: 'text-amber-700', badge: 'bg-amber-500' }
};

// Lista priorizada dos problemas concretos da operação agora — pensada para
// responder "no que eu preciso agir hoje?" sem precisar garimpar as abas.
const RiskAlertsPanel = ({ alerts, onNavigate }) => {
  return (
    <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="text-indigo-500" size={20} />
        <h3 className="text-lg font-black text-slate-800">Riscos e Alertas</h3>
      </div>

      {alerts.length === 0 ? (
        <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-700">
          <CheckCircle2 size={20} />
          <p className="text-sm font-bold">Nenhum risco identificado com as metas atuais.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map(alert => {
            const cfg = SEVERITY_CONFIG[alert.severity];
            const Icon = cfg.icon;
            return (
              <button
                key={alert.id}
                onClick={() => onNavigate?.(alert.tab)}
                className={`w-full flex items-center gap-3 p-4 rounded-2xl border text-left transition-all hover:shadow-sm ${cfg.bg} ${cfg.border}`}
              >
                <Icon className={cfg.text} size={20} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-bold ${cfg.text}`}>{alert.title}</p>
                  <p className="text-xs text-slate-500 font-medium truncate">{alert.description}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black text-white uppercase tracking-wide ${cfg.badge} shrink-0`}>
                  {alert.severity === 'critical' ? 'Crítico' : 'Atenção'}
                </span>
                <ChevronRight size={16} className="text-slate-300 shrink-0" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default RiskAlertsPanel;
