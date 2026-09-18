import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { PackageCheck, Truck, Warehouse } from 'lucide-react';
import InfoButton from './InfoButton';

// Um pedido expedido pelo WMS ainda passa por duas etapas fora do WMS antes
// de estar 100% resolvido: alguém precisa retirar o material fisicamente, e
// a OMS precisa dar baixa (arrecadar) no SINGRA. Este cartão mostra onde
// cada pedido está nessa esteira, sob a ótica de pedidos e de documentos
// (STC/GTC) — e o volume já finalizado, mês a mês.
const HandoffTile = (props) => {
  const Icon = props.icon;
  const { title, description, summary, tone } = props;
  return (
    <div className={`p-5 rounded-2xl border ${tone.border} ${tone.bg}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className={`p-1.5 rounded-lg ${tone.iconBg} ${tone.iconText}`}><Icon size={16} /></span>
        <p className={`text-[11px] font-black uppercase tracking-wide ${tone.text}`}>{title}</p>
        <InfoButton title={title} description={description} />
      </div>
      <p className="text-3xl font-black text-slate-800 leading-none">{summary.pedidoCount} <span className="text-xs text-slate-400 font-bold">pedido(s)</span></p>
      <p className="text-xs text-slate-500 font-bold mt-2 pt-2 border-t border-slate-200">{summary.stcCount} STC · {summary.gtcCount} GTC</p>
      {summary.pedidoCount > 0 && (
        <p className="text-xs text-slate-400 font-medium mt-1">Idade média de {summary.avgDaysOpen} dias · mais antigo com {summary.oldestDaysOpen} dias</p>
      )}
    </div>
  );
};

const OmsHandoffCard = ({ interfaceAnalysis, interfaceStartDate, setInterfaceStartDate, interfaceEndDate, setInterfaceEndDate }) => {
  if (!interfaceAnalysis) return null;
  const { aguardandoRetiradaSummary, aguardandoArrecadacaoSummary, arrecadadoOmsSummary } = interfaceAnalysis;

  return (
    <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
      <div className="flex items-center gap-2 mb-6">
        <PackageCheck className="text-indigo-500" size={20} />
        <h3 className="text-lg font-black text-slate-800">Retirada de Material e Arrecadação OMS</h3>
        <InfoButton
          title="Etapas Após a Expedição"
          description="Depois que o WMS expede um pedido, ele ainda passa por duas etapas fora do WMS: a retirada física do material e a arrecadação (baixa) pela OMS no SINGRA. Este painel mostra quantos pedidos e documentos (STC/GTC) estão em cada etapa agora, e quantos já foram totalmente arrecadados."
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <HandoffTile
          icon={Truck}
          title="Aguardando Retirada de Material"
          description="Pedidos já conferidos no WMS e em trânsito no SINGRA — o material está disponível, falta alguém retirar fisicamente."
          summary={aguardandoRetiradaSummary}
          tone={{ bg: 'bg-blue-50', border: 'border-blue-100', iconBg: 'bg-blue-100', iconText: 'text-blue-600', text: 'text-blue-600' }}
        />
        <HandoffTile
          icon={Warehouse}
          title="Aguardando Arrecadação OMS"
          description="Pedidos já expedidos fisicamente pelo WMS, mas ainda sem baixa (arrecadação) registrada pela OMS no SINGRA."
          summary={aguardandoArrecadacaoSummary}
          tone={{ bg: 'bg-orange-50', border: 'border-orange-100', iconBg: 'bg-orange-100', iconText: 'text-orange-600', text: 'text-orange-600' }}
        />
      </div>

      <div className="pt-6 border-t border-slate-100">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <PackageCheck size={16} className="text-emerald-500" />
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Arrecadado pela OMS (Finalizados)</p>
            <InfoButton title="Arrecadado pela OMS" description="Pedidos expedidos pelo WMS e já arrecadados pela OMS — o ciclo está 100% concluído nos dois sistemas. Como o histórico completo é muito extenso, esta contagem é filtrada por data de entrada." />
          </div>
          <div className="flex items-center gap-2">
            <input type="date" value={interfaceStartDate} onChange={e => setInterfaceStartDate(e.target.value)} className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold shadow-sm" />
            <span className="text-slate-300 text-xs font-bold">até</span>
            <input type="date" value={interfaceEndDate} onChange={e => setInterfaceEndDate(e.target.value)} className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold shadow-sm" />
          </div>
        </div>

        {arrecadadoOmsSummary.pedidoCount === 0 ? (
          <p className="text-sm text-slate-400 italic text-center py-6">Nenhum pedido arrecadado pela OMS no período selecionado.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-4 rounded-2xl border border-emerald-100 bg-emerald-50">
              <p className="text-2xl font-black text-emerald-700">{arrecadadoOmsSummary.pedidoCount}</p>
              <p className="text-[10px] font-black text-emerald-600 uppercase mt-1">Pedidos Finalizados</p>
              <p className="text-xs text-emerald-600 font-bold mt-2 pt-2 border-t border-emerald-200">{arrecadadoOmsSummary.stcCount} STC · {arrecadadoOmsSummary.gtcCount} GTC</p>
            </div>
            <div className="md:col-span-2 h-[160px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={arrecadadoOmsSummary.monthly}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fontWeight: 700 }} axisLine={false} />
                  <YAxis tick={{ fontSize: 10 }} axisLine={false} allowDecimals={false} />
                  <Tooltip formatter={(v) => [`${v} pedido(s)`, 'Arrecadado']} />
                  <Bar dataKey="count" name="Arrecadado pela OMS" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OmsHandoffCard;
