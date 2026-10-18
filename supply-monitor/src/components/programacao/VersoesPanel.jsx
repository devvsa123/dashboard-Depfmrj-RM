import { useState } from 'react';
import { History, Send, AlertTriangle, CheckCircle2, Undo2 } from 'lucide-react';
import InfoButton from '../InfoButton';
import { rotuloVersao } from '../../utils/programacao/versoes';
import { PROGRAMADORES } from '../../utils/programacao/equipe';
import { formatarBr } from '../../utils/programacao/semana';

const dataHora = (iso) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
};

// Publicar congela a programação da semana. A partir da segunda, cada
// publicação é uma ALTERAÇÃO, e o documento sai com o Anexo B dizendo o
// que mudou — é o que permite reprogramar no meio da semana sem que quem
// recebe perca o fio.
const VersoesPanel = ({ versoes, ultimaVersao, diffPendente, publicar, removerUltimaVersao, programador, resultado }) => {
  const [por, setPor] = useState(programador || '');
  const [confirmando, setConfirmando] = useState(false);

  const proxima = versoes.length;
  const temProposta = Boolean(resultado && resultado.resumo.totalProgramado > 0);
  const semMudancas = Boolean(ultimaVersao && diffPendente && diffPendente.totalMudancas === 0);

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex items-center gap-2">
        <History className="text-indigo-500" size={20} />
        <h3 className="text-lg font-black text-slate-800">Versões da Semana</h3>
        <InfoButton
          title="Como funcionam as alterações"
          description="A primeira publicação da semana é a Original. Se surgir uma demanda nova no meio da semana, você registra, confere a grade refeita e publica de novo: a versão vira Alteração nº 1, e o documento passa a trazer o Anexo B com as RMs que entraram, as que saíram, as que mudaram de dia e a demanda que motivou tudo. O que já foi publicado não muda — cada versão fica guardada como foi."
        />
      </div>

      <div className="p-6 space-y-4">
        {!ultimaVersao ? (
          <p className="text-sm text-slate-500 font-medium">
            A programação desta semana ainda não foi publicada. A primeira publicação sai como <strong className="text-slate-800">Original</strong>.
          </p>
        ) : semMudancas ? (
          <p className="text-sm text-emerald-600 font-bold flex items-center gap-2">
            <CheckCircle2 size={16} /> Nada mudou desde a {rotuloVersao(ultimaVersao.numero).toLowerCase()}.
          </p>
        ) : (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100 space-y-1.5">
            <p className="text-sm font-black text-amber-800 flex items-center gap-2">
              <AlertTriangle size={16} /> Há mudanças não publicadas
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-bold text-amber-700">
              {diffPendente.entraram.length > 0 && <span>{diffPendente.entraram.length} RM(s) entraram</span>}
              {diffPendente.sairam.length > 0 && <span>{diffPendente.sairam.length} RM(s) saíram</span>}
              {diffPendente.remanejadas.length > 0 && <span>{diffPendente.remanejadas.length} RM(s) mudaram de dia</span>}
              {diffPendente.bloqueiosNovos.length > 0 && <span>{diffPendente.bloqueiosNovos.length} dia(s) bloqueado(s)</span>}
              {diffPendente.demandasNovas.length > 0 && <span>{diffPendente.demandasNovas.length} demanda(s) nova(s)</span>}
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <select value={por} onChange={e => setPor(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold outline-none focus:border-indigo-500 bg-white">
            <option value="">Quem publica...</option>
            {PROGRAMADORES.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <button
            onClick={() => { publicar(por); setConfirmando(false); }}
            disabled={!temProposta || !por || semMudancas}
            className="flex-1 px-5 py-2 rounded-xl bg-indigo-600 text-white font-bold text-sm shadow-sm flex items-center justify-center gap-2 hover:bg-indigo-700 disabled:opacity-40 transition-all active:scale-95"
          >
            <Send size={16} /> Publicar {rotuloVersao(proxima)}
          </button>
        </div>

        {versoes.length > 0 && (
          <div className="divide-y divide-slate-50 border-t border-slate-100 pt-2">
            {[...versoes].reverse().map(v => (
              <div key={v.numero} className="py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-black text-slate-800">{rotuloVersao(v.numero)}</p>
                  <p className="text-[11px] text-slate-400 font-medium">
                    {dataHora(v.publicadaEm)} · {v.por || '—'} · {v.snapshot.resumo.totalProgramado} RMs
                  </p>
                </div>
                {v.numero === versoes.length - 1 && (
                  confirmando ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => { removerUltimaVersao(); setConfirmando(false); }} className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold">Confirmar</button>
                      <button onClick={() => setConfirmando(false)} className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-xs font-bold">Cancelar</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmando(true)} title="Desfazer esta publicação" className="p-2 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 shrink-0">
                      <Undo2 size={16} />
                    </button>
                  )
                )}
              </div>
            ))}
          </div>
        )}

        {ultimaVersao && (
          <p className="text-[11px] text-slate-400 font-medium">
            Semana publicada pela última vez em {formatarBr(ultimaVersao.publicadaEm.split('T')[0])}.
          </p>
        )}
      </div>
    </div>
  );
};

export default VersoesPanel;
