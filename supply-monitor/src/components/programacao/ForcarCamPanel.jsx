import { useMemo, useState } from 'react';
import { Zap, Trash2, AlertTriangle, CheckCircle2, ArrowRight } from 'lucide-react';
import InfoButton from '../InfoButton';
import { impactoDeForcar } from '../../utils/programacao/prioridade';
import { hojeIso, diasUteisDaSemana } from '../../utils/programacao/semana';

const TOM = {
  emerald: 'bg-emerald-50 border-emerald-100 text-emerald-800',
  amber: 'bg-amber-50 border-amber-100 text-amber-800'
};

// Forçar um CAM é furar a fila de propósito. O painel existe para que
// isso seja uma decisão com a conta à vista: quantas RMs entram, quantas
// saem da grade, e o que acontece com elas depois de prontas — porque
// forçar um CAM de STC com a janela fechada deixa o material pronto
// esperando no pátio, e isso precisa estar escrito antes de confirmar.
const ForcarCamPanel = ({ fila, porCam, capacidadeMedida, semanaRef, forcados, forcarCam, desforcarCam, simularForcar }) => {
  const [cam, setCam] = useState('');

  const camsDaFila = useMemo(() => {
    const mapa = new Map();
    (fila || []).forEach(f => {
      const c = f.cam || '(sem CAM)';
      mapa.set(c, (mapa.get(c) || 0) + 1);
    });
    return Array.from(mapa.entries())
      .map(([c, qtd]) => ({ cam: c, qtd }))
      .sort((a, b) => b.qtd - a.qtd);
  }, [fila]);

  const previa = useMemo(() => {
    if (!cam) return null;
    const primeiroDia = diasUteisDaSemana(semanaRef)[0];
    const entrega = impactoDeForcar({
      cam,
      config: porCam?.get(cam),
      rmsDoCam: (fila || []).filter(f => f.cam === cam),
      capacidadeSemana: capacidadeMedida?.totalSemanal || 0,
      hoje: hojeIso(),
      primeiroDia
    });
    return { ...entrega, grade: simularForcar?.(cam) };
  }, [cam, porCam, fila, capacidadeMedida, semanaRef, simularForcar]);

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex items-center gap-2">
        <Zap className="text-fuchsia-500" size={20} />
        <h3 className="text-lg font-black text-slate-800">Forçar um CAM</h3>
        <span className="text-[10px] font-bold text-slate-400 ml-auto">nesta semana</span>
        <InfoButton
          title="Quando usar"
          description="Para demanda emergencial que sai da lógica normal de fornecimento. Vale só para a semana que está na tela: ao mudar de semana, a lista volta a ser a daquela semana. O CAM forçado passa na frente de tudo, inclusive das mensagens com prazo. Antes de confirmar, o painel mostra quantas RMs entram, quantas saem da grade e o que acontece com o material depois de pronto — inclusive se a janela do CDAM já fechou e ele vai esperar no pátio."
        />
      </div>

      <div className="p-6 border-b border-slate-100 bg-slate-50/50 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={cam}
            onChange={e => setCam(e.target.value)}
            className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold outline-none focus:border-fuchsia-500 bg-white"
          >
            <option value="">Escolha o CAM...</option>
            {camsDaFila.filter(c => !forcados.includes(c.cam)).map(c => (
              <option key={c.cam} value={c.cam}>{c.cam} — {c.qtd} RM(s) em fila</option>
            ))}
          </select>
          <button
            onClick={() => { forcarCam(cam); setCam(''); }}
            disabled={!cam}
            className="px-4 py-2 rounded-xl bg-fuchsia-600 text-white font-bold text-sm flex items-center gap-1.5 hover:bg-fuchsia-700 disabled:opacity-40 transition-all active:scale-95"
          >
            <Zap size={16} /> Forçar
          </button>
        </div>

        {previa && (
          <div className="space-y-2 animate-in fade-in duration-200">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { r: 'RMs em fila', v: previa.qtd },
                { r: 'Entram na grade', v: previa.grade?.entram ?? '—' },
                { r: 'Saem da grade', v: previa.grade?.saem ?? '—' },
                { r: 'Da capacidade', v: previa.ocupacao != null ? `${previa.ocupacao}%` : '—' }
              ].map(c => (
                <div key={c.r} className="bg-white rounded-xl border border-slate-200 px-3 py-2">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-tight">{c.r}</p>
                  <p className="text-lg font-black text-slate-900 leading-tight">{c.v}</p>
                </div>
              ))}
            </div>

            <div className={`flex items-start gap-2 p-3 rounded-xl border text-xs font-medium ${TOM[previa.entrega.tom]}`}>
              {previa.entrega.tom === 'emerald'
                ? <CheckCircle2 size={15} className="shrink-0 mt-0.5" />
                : <AlertTriangle size={15} className="shrink-0 mt-0.5" />}
              {previa.entrega.texto}
            </div>

            {previa.grade?.camsAfetados?.length > 0 && (
              <p className="text-[11px] text-slate-500 font-medium px-1 flex items-start gap-1.5">
                <ArrowRight size={13} className="shrink-0 mt-0.5 text-slate-300" />
                Saem da semana para abrir espaço:{' '}
                {previa.grade.camsAfetados.slice(0, 4).map(c => `${c.cam} (${c.qtd})`).join(', ')}
                {previa.grade.camsAfetados.length > 4 ? ` e mais ${previa.grade.camsAfetados.length - 4} CAM(s)` : ''}.
              </p>
            )}
            {previa.grade && previa.grade.saem === 0 && (
              <p className="text-[11px] text-slate-500 font-medium px-1">
                Cabe sem tirar ninguém: a semana ainda tem folga de capacidade.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="divide-y divide-slate-50">
        {forcados.length === 0 && <p className="px-6 py-6 text-center text-sm text-slate-400 italic">Nenhum CAM forçado nesta semana. Ela segue a ordem normal.</p>}
        {forcados.map(c => (
          <div key={c} className="px-6 py-3 flex items-center justify-between gap-3">
            <span className="text-sm min-w-0">
              <strong className="text-slate-800">{c}</strong>
              <span className="text-slate-500"> — {(fila || []).filter(f => f.cam === c).length} RM(s) em fila, atendidas na frente</span>
            </span>
            <button onClick={() => desforcarCam(c)} className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 shrink-0"><Trash2 size={15} /></button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ForcarCamPanel;
