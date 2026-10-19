import { useState } from 'react';
import { CalendarDays, AlertTriangle, Users, ChevronRight, X } from 'lucide-react';
import InfoButton from '../InfoButton';
import { DIAS_SEMANA, formatarBr, formatarCurto } from '../../utils/programacao/semana';

const TOM_ORIGEM = {
  MENSAGEM: 'bg-indigo-100 text-indigo-700',
  GERENCIA: 'bg-violet-100 text-violet-700',
  OUTRO: 'bg-slate-100 text-slate-600',
  ANTIGUIDADE: 'bg-slate-50 text-slate-500',
  ROTA: 'bg-emerald-100 text-emerald-700'
};

const DetalheDia = ({ slot, onClose }) => {
  if (!slot) return null;
  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white w-full max-w-3xl max-h-[85vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="text-lg font-black text-slate-800">
              {DIAS_SEMANA[new Date(slot.dia + 'T00:00:00Z').getUTCDay()]}, {formatarBr(slot.dia)}
            </h3>
            <p className="text-sm text-slate-500 font-medium mt-1">
              {slot.alocacoes.length} de {slot.capacidade} RMs programadas
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-500"><X size={24} /></button>
        </div>
        <div className="flex-1 overflow-auto p-6">
          <table className="w-full text-sm text-left text-slate-600">
            <thead className="text-xs text-slate-400 uppercase bg-slate-50 sticky top-0">
              <tr>
                <th className="px-3 py-2">RM</th>
                <th className="px-3 py-2">CAM</th>
                <th className="px-3 py-2">Por que está aqui</th>
              </tr>
            </thead>
            <tbody>
              {slot.alocacoes.map((a, i) => (
                <tr key={`${a.rm}-${i}`} className="border-b border-slate-50">
                  <td className="px-3 py-2 font-bold text-slate-800">{a.rm}</td>
                  <td className="px-3 py-2 text-xs">{a.cam || '—'}</td>
                  <td className="px-3 py-2 text-xs">
                    <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-black mr-2 ${TOM_ORIGEM[a.origem]}`}>
                      {a.origem === 'ANTIGUIDADE' ? 'ANTIGA' : a.origem}
                    </span>
                    {a.justificativa}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// A proposta da semana. O programador é validador: cada RM mostra por que
// está naquele dia, e os conflitos aparecem em vermelho em vez de serem
// resolvidos em silêncio pelo sistema.
const GradeSemanal = ({ resultado }) => {
  const [detalhe, setDetalhe] = useState(null);
  if (!resultado) return null;
  const { grade, porCam, alertas, resumo } = resultado;

  return (
    <div className="space-y-5">
      <DetalheDia slot={detalhe} onClose={() => setDetalhe(null)} />

      {alertas.length > 0 && (
        <div className="space-y-2">
          {alertas.map((a, i) => (
            <div key={i} className={`flex items-start gap-3 p-4 rounded-2xl border text-sm font-medium ${a.nivel === 'critico' ? 'bg-red-50 border-red-100 text-red-700' : 'bg-amber-50 border-amber-100 text-amber-700'}`}>
              <AlertTriangle size={18} className="shrink-0 mt-0.5" /> {a.texto}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {[
          { t: 'RMs na Semana', v: resumo.totalProgramado },
          { t: 'Capacidade', v: resumo.capacidadeTotal },
          { t: 'Ocupação', v: `${resumo.ocupacao}%` },
          { t: 'Com Prazo', v: resumo.comPrazo },
          { t: 'CAMs Atendidos', v: resumo.camsAtendidos },
          { t: 'Fila de Separação', v: resumo.filaTotal }
        ].map(c => (
          <div key={c.t} className="bg-white p-4 rounded-2xl border border-slate-200">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{c.t}</p>
            <p className="text-2xl font-black text-slate-900 leading-none mt-1.5">{c.v}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
        {grade.map(slot => (
          <button
            key={slot.dia}
            onClick={() => slot.alocacoes.length && setDetalhe(slot)}
            className={`text-left p-4 rounded-2xl border transition-all ${slot.bloqueio ? 'bg-red-50/60 border-red-100' : 'bg-white border-slate-200 hover:border-indigo-400 hover:shadow-sm'}`}
          >
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              {DIAS_SEMANA[new Date(slot.dia + 'T00:00:00Z').getUTCDay()]}
            </p>
            <p className="text-xs text-slate-400 font-bold">{formatarCurto(slot.dia)}</p>
            {slot.bloqueio ? (
              <>
                <p className="text-lg font-black text-red-600 leading-none mt-2">Sem separação</p>
                <p className="text-[11px] text-red-500 font-medium mt-1">{slot.bloqueio.motivo}</p>
              </>
            ) : (
              <>
                <p className="text-3xl font-black text-slate-900 leading-none mt-2">{slot.alocacoes.length}</p>
                <p className="text-[11px] text-slate-400 font-medium mt-1">
                  de {slot.capacidade} {slot.manual && <span className="text-amber-600 font-bold">(ajustado)</span>}
                </p>
                <div className="h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden">
                  <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${slot.capacidade ? Math.min(100, (slot.alocacoes.length / slot.capacidade) * 100) : 0}%` }} />
                </div>
                {slot.alocacoes.length > 0 && (
                  <p className="text-[11px] text-indigo-600 font-bold mt-2 flex items-center gap-0.5">ver RMs <ChevronRight size={12} /></p>
                )}
              </>
            )}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center gap-2">
          <Users className="text-indigo-500" size={20} />
          <h3 className="text-lg font-black text-slate-800">Atendimento por CAM</h3>
          <InfoButton
            title="O foco do documento"
            description="Esta é a tabela que vai para o documento da programação: quantas RMs cada CAM recebe em cada dia da semana. É por ela que a chefia e os clientes leem a semana."
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-slate-600">
            <thead className="text-xs text-slate-400 uppercase bg-slate-50">
              <tr>
                <th className="px-4 py-3">CAM</th>
                {grade.map(s => <th key={s.dia} className="px-3 py-3 text-center">{formatarCurto(s.dia)}</th>)}
                <th className="px-4 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {porCam.map((linha, idx) => (
                <tr key={linha.cam} className={`border-b border-slate-50 ${idx % 2 ? 'bg-slate-50/40' : ''}`}>
                  <td className="px-4 py-2.5 font-bold text-slate-800">{linha.cam}</td>
                  {grade.map(s => (
                    <td key={s.dia} className="px-3 py-2.5 text-center font-medium">
                      {linha.porDia[s.dia] || <span className="text-slate-200">—</span>}
                    </td>
                  ))}
                  <td className="px-4 py-2.5 text-right font-black text-slate-900">{linha.total}</td>
                </tr>
              ))}
              {porCam.length === 0 && (
                <tr><td colSpan={grade.length + 2} className="px-4 py-8 text-center text-slate-400 italic">Nada programado para esta semana.</td></tr>
              )}
            </tbody>
            {porCam.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100 font-black text-slate-800">
                  <td className="px-4 py-3">TOTAL</td>
                  {grade.map(s => <td key={s.dia} className="px-3 py-3 text-center">{s.alocacoes.length}</td>)}
                  <td className="px-4 py-3 text-right">{resumo.totalProgramado}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};

export default GradeSemanal;
