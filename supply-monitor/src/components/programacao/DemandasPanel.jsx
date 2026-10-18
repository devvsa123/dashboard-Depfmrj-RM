import { useState } from 'react';
import { ClipboardPaste, Trash2, AlertTriangle, CheckCircle2, CalendarClock } from 'lucide-react';
import InfoButton from '../InfoButton';
import { ORIGENS, DIAS_EXPEDICAO_PADRAO, limiteDeSeparacao } from '../../utils/programacao/motor';
import { SITUACAO_LABEL } from '../../utils/programacao/rms';
import { formatarBr } from '../../utils/programacao/semana';

const TOM_SITUACAO = {
  EM_FILA: 'text-emerald-600',
  CONFERIDA: 'text-sky-600',
  JA_EXPEDIDA: 'text-slate-400',
  CANCELADA: 'text-red-500',
  NAO_ENCONTRADA: 'text-amber-600'
};

// Cadastro de demandas: o programador cola a relação de RMs (de uma
// mensagem, de um e-mail, de onde vier) e informa o prazo. Não tentamos
// interpretar o documento inteiro — o que importa é o número da RM e a
// data limite.
const DemandasPanel = ({ demandas, adicionarDemanda, removerDemanda }) => {
  const [texto, setTexto] = useState('');
  const [origem, setOrigem] = useState('MENSAGEM');
  const [referencia, setReferencia] = useState('');
  const [prazo, setPrazo] = useState('');
  const [diasExpedicao, setDiasExpedicao] = useState(DIAS_EXPEDICAO_PADRAO);
  const [aviso, setAviso] = useState(null);

  const enviar = () => {
    const r = adicionarDemanda({ texto, origem, referencia, prazo: prazo || null, diasExpedicao });
    if (r.erro) { setAviso({ tipo: 'erro', texto: r.erro }); return; }
    setAviso({ tipo: 'ok', texto: `${r.encontradas} RM(s) registradas${r.duplicadas ? ` — ${r.duplicadas} repetida(s) no texto foram ignoradas` : ''}.` });
    setTexto(''); setReferencia(''); setPrazo('');
  };

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex items-center gap-2">
        <ClipboardPaste className="text-indigo-500" size={20} />
        <h3 className="text-lg font-black text-slate-800">Demandas com Prazo</h3>
        <InfoButton
          title="Como registrar uma demanda"
          description="Cole a relação de RMs direto da mensagem, do e-mail ou de onde ela veio — o sistema procura os números de 8 dígitos e ignora o resto do texto, então não precisa limpar nada. Informe o prazo que a origem cobrou (a data de emissão da STC, por exemplo) e quantos dias úteis a expedição precisa depois da separação. O motor agenda de trás para frente a partir daí. Sem prazo, a demanda entra como prioridade sobre a fila por antiguidade, mas sem data limite."
        />
      </div>

      <div className="p-6 space-y-4 border-b border-slate-100 bg-slate-50/50">
        <textarea
          value={texto}
          onChange={e => setTexto(e.target.value)}
          rows={4}
          placeholder={'Cole aqui a relação de RMs.\nEx: 8.472 190019908 BERMUDA CINZA 40 15.757.540 EA 100;'}
          className="w-full p-3 rounded-xl border border-slate-200 text-sm font-mono outline-none focus:border-indigo-500 resize-y"
        />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Origem</label>
            <select value={origem} onChange={e => setOrigem(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold outline-none focus:border-indigo-500 bg-white">
              {ORIGENS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Referência</label>
            <input value={referencia} onChange={e => setReferencia(e.target.value)} placeholder="Msg CSUPAB R151612Z/OUT/2026" className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-500" />
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Prazo (EMI STC)</label>
            <input type="date" value={prazo} onChange={e => setPrazo(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold outline-none focus:border-indigo-500" />
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Dias p/ expedição</label>
            <input type="number" min="0" value={diasExpedicao} onChange={e => setDiasExpedicao(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold outline-none focus:border-indigo-500" />
          </div>
        </div>
        {prazo && (
          <p className="text-xs text-indigo-600 font-bold flex items-center gap-1.5">
            <CalendarClock size={14} /> A separação precisa terminar até {formatarBr(limiteDeSeparacao(prazo, Number(diasExpedicao)))} para a expedição cumprir o prazo de {formatarBr(prazo)}.
          </p>
        )}
        <div className="flex items-center justify-between gap-3">
          {aviso ? (
            <p className={`text-xs font-bold flex items-center gap-1.5 ${aviso.tipo === 'erro' ? 'text-red-600' : 'text-emerald-600'}`}>
              {aviso.tipo === 'erro' ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />} {aviso.texto}
            </p>
          ) : <span />}
          <button onClick={enviar} disabled={!texto.trim()} className="px-5 py-2 rounded-xl bg-indigo-600 text-white font-bold text-sm shadow-sm hover:bg-indigo-700 disabled:opacity-40 transition-all active:scale-95">
            Registrar demanda
          </button>
        </div>
      </div>

      <div className="divide-y divide-slate-50">
        {demandas.length === 0 && (
          <p className="px-6 py-8 text-center text-sm text-slate-400 italic">Nenhuma demanda registrada. A semana será montada só pela fila de mais antigas.</p>
        )}
        {demandas.map(d => {
          const c = d.conferencia;
          const limite = d.prazo ? limiteDeSeparacao(d.prazo, d.diasExpedicao) : null;
          return (
            <div key={d.id} className="px-6 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-black text-slate-800 text-sm truncate">
                    {d.referencia || ORIGENS.find(o => o.key === d.origem)?.label}
                  </p>
                  <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                    {ORIGENS.find(o => o.key === d.origem)?.label} · {d.rms.length} RM(s) coladas
                    {d.prazo && ` · prazo ${formatarBr(d.prazo)} · separar até ${formatarBr(limite)}`}
                  </p>
                </div>
                <button onClick={() => removerDemanda(d.id)} className="p-2 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 shrink-0"><Trash2 size={16} /></button>
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2">
                {Object.keys(SITUACAO_LABEL).map(k => (
                  c[k].length > 0 && (
                    <span key={k} className={`text-[11px] font-bold ${TOM_SITUACAO[k]}`}>
                      {c[k].length} · {SITUACAO_LABEL[k]}
                    </span>
                  )
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DemandasPanel;
