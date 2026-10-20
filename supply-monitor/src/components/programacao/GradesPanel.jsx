import { useState } from 'react';
import { Route, CheckCircle2, AlertTriangle, HelpCircle, ChevronDown, ChevronRight } from 'lucide-react';
import InfoButton from '../InfoButton';
import { formatarBr } from '../../utils/programacao/semana';

// A prestação de contas das grades de fornecimento.
//
// O motor já respeita o dia de rota de cada CAM e a janela do CDAM, mas
// respeitar sem mostrar não serve: o programador precisa poder conferir,
// CAM por CAM, até quando a separação tinha de terminar e até que dia
// ela foi programada. Onde não bate, o material vai ficar pronto
// esperando a saída seguinte — e é melhor saber disso antes de publicar.
const GradesPanel = ({ grades = [], resumo }) => {
  const [aberto, setAberto] = useState(false);
  if (!grades.length) return null;

  const fora = grades.filter(g => g.dentro === false);
  const semGrade = grades.filter(g => g.dentro === null);
  const Chevron = aberto ? ChevronDown : ChevronRight;

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex items-center gap-2">
        <Route className="text-indigo-500" size={20} />
        <h3 className="text-lg font-black text-slate-800">Grades de Fornecimento Consideradas</h3>
        <InfoButton
          title="O que esta seção prova"
          description="Para cada CAM da semana, a grade dele — dia de rota, no caso de entrega nossa, ou janela do CDAM, no caso de retirada por terceiro —, até quando a separação precisava terminar e até que dia ela foi de fato programada. É a verificação de que as grades entraram na conta, e não uma promessa de que entraram."
        />
      </div>

      <div className="p-6 space-y-4">
        <div className="grid grid-cols-3 gap-3">
          {[
            { t: 'Dentro da grade', v: resumo?.camsNoLimite ?? 0, i: CheckCircle2, tom: 'text-emerald-600' },
            { t: 'Fora do limite', v: resumo?.camsForaDoLimite ?? 0, i: AlertTriangle, tom: (resumo?.camsForaDoLimite ?? 0) > 0 ? 'text-amber-600' : 'text-slate-900' },
            { t: 'Sem grade cadastrada', v: resumo?.camsSemGrade ?? 0, i: HelpCircle, tom: (resumo?.camsSemGrade ?? 0) > 0 ? 'text-slate-500' : 'text-slate-900' }
          ].map(c => {
            const Icon = c.i;
            return (
              <div key={c.t} className="bg-slate-50 rounded-2xl px-4 py-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon size={13} className="text-slate-400" />
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-tight">{c.t}</p>
                </div>
                <p className={`text-2xl font-black leading-none ${c.tom}`}>{c.v}</p>
              </div>
            );
          })}
        </div>

        {fora.length > 0 && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100">
            <p className="text-xs font-black text-amber-800 mb-1.5">
              {fora.length} CAM(s) programados depois da própria saída
            </p>
            <div className="space-y-0.5">
              {fora.slice(0, 5).map(g => (
                <p key={g.cam} className="text-[11px] text-amber-700 font-medium">
                  <strong>{g.sigla || g.cam}</strong> — {g.tipo === 'GTC' ? `rota em ${formatarBr(g.saida)}` : `janela até ${formatarBr(g.saida)}`};
                  {' '}separar até {formatarBr(g.limite)}, programado até {formatarBr(g.ultimoDia)} ({g.qtd} RM)
                </p>
              ))}
              {fora.length > 5 && <p className="text-[11px] text-amber-600 font-bold">e mais {fora.length - 5}…</p>}
            </div>
          </div>
        )}

        {semGrade.length > 0 && (
          <p className="text-[11px] text-slate-500 font-medium">
            {semGrade.length} CAM(s) da semana ainda não têm grade cadastrada ({semGrade.slice(0, 4).map(g => g.cam).join(', ')}
            {semGrade.length > 4 ? ` e mais ${semGrade.length - 4}` : ''}). Cadastre em CAM e Rotas para que entrem na conta.
          </p>
        )}

        <button onClick={() => setAberto(a => !a)} className="text-xs font-bold text-indigo-500 hover:text-indigo-700 flex items-center gap-1">
          <Chevron size={14} /> {aberto ? 'ocultar' : 'ver'} a grade de cada CAM
        </button>

        {aberto && (
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100">
                <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <th className="px-2 py-2 text-left">CAM</th>
                  <th className="px-2 py-2 text-left">Grade</th>
                  <th className="px-2 py-2 text-center">Separar até</th>
                  <th className="px-2 py-2 text-center">Programado até</th>
                  <th className="px-2 py-2 text-right">RMs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {grades.map(g => (
                  <tr key={g.cam} className={g.dentro === false ? 'bg-amber-50/50' : ''}>
                    <td className="px-2 py-1.5 font-bold text-slate-700 text-xs">{g.sigla || g.cam}</td>
                    <td className="px-2 py-1.5 text-slate-500 text-[11px]">
                      {g.tipo === 'GTC' ? `Rota em ${formatarBr(g.saida)}` : g.tipo === 'STC' ? `Janela até ${formatarBr(g.saida)}` : 'sem grade'}
                    </td>
                    <td className="px-2 py-1.5 text-center text-[11px] text-slate-500">{g.limite ? formatarBr(g.limite) : '—'}</td>
                    <td className={`px-2 py-1.5 text-center text-[11px] font-bold ${g.dentro === false ? 'text-amber-700' : 'text-slate-600'}`}>{formatarBr(g.ultimoDia)}</td>
                    <td className="px-2 py-1.5 text-right font-bold text-slate-700 text-xs">{g.qtd}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default GradesPanel;
