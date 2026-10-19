import { useMemo, useState } from 'react';
import { Settings2, Search, AlertTriangle, EyeOff, Truck, Package, CheckCircle2, Loader2 } from 'lucide-react';
import InfoButton from '../InfoButton';
import SectionLabel from '../SectionLabel';
import { TRATAMENTOS, TRATAMENTO_INFO, DIAS_UTEIS, rotaDescrita } from '../../utils/programacao/rotas';
import { formatarBr } from '../../utils/programacao/semana';

const TOM_BADGE = {
  emerald: 'bg-emerald-100 text-emerald-700',
  indigo: 'bg-indigo-100 text-indigo-700',
  slate: 'bg-slate-100 text-slate-500',
  amber: 'bg-amber-100 text-amber-700'
};

const FILTROS = [
  { key: 'TODOS', label: 'Todos' },
  { key: TRATAMENTOS.PENDENTE, label: 'A cadastrar' },
  { key: TRATAMENTOS.GTC, label: 'GTC' },
  { key: TRATAMENTOS.STC, label: 'STC' },
  { key: TRATAMENTOS.OCULTO, label: 'Ocultos' }
];

const Editor = ({ linha, salvar, fechar }) => {
  const [c, setC] = useState({ ...linha.config });
  const muda = (campo, valor) => setC(a => ({ ...a, [campo]: valor }));
  const alternaDia = (n) => setC(a => ({
    ...a,
    diasRota: a.diasRota?.includes(n) ? a.diasRota.filter(x => x !== n) : [...(a.diasRota || []), n].sort()
  }));

  // Ao trocar o tratamento, o documento esperado acompanha — mas pode ser
  // destravado depois, para o caso de entrega por terceiro com GTC.
  const trocaTratamento = (t) => setC(a => ({
    ...a,
    tratamento: t,
    documentoEsperado: t === TRATAMENTOS.GTC ? 'GTC' : t === TRATAMENTOS.STC ? 'STC' : null
  }));

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={fechar}>
      <div className="bg-white w-full max-w-2xl max-h-[88vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-lg font-black text-slate-800">{linha.cam}</h3>
          <p className="text-sm text-slate-500 font-medium mt-1">
            {linha.rms.toLocaleString('pt-BR')} RMs na base · último movimento em {linha.ultimo ? formatarBr(linha.ultimo) : '—'}
          </p>
        </div>

        <div className="flex-1 overflow-auto p-6 space-y-5">
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Quem entrega</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {[TRATAMENTOS.GTC, TRATAMENTOS.STC, TRATAMENTOS.OCULTO].map(t => (
                <button
                  key={t}
                  onClick={() => trocaTratamento(t)}
                  className={`p-3 rounded-2xl border text-left transition-all ${c.tratamento === t ? 'border-indigo-500 bg-indigo-50 shadow-sm' : 'border-slate-200 hover:border-slate-300'}`}
                >
                  <p className="text-xs font-black text-slate-800">{TRATAMENTO_INFO[t].label}</p>
                  <p className="text-[10px] text-slate-500 font-medium mt-0.5 leading-tight">{TRATAMENTO_INFO[t].descricao}</p>
                </button>
              ))}
            </div>
          </div>

          {c.tratamento === TRATAMENTOS.GTC && (
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Dias de rota</label>
              <div className="flex flex-wrap gap-2">
                {DIAS_UTEIS.map(d => (
                  <button
                    key={d.n}
                    onClick={() => alternaDia(d.n)}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${c.diasRota?.includes(d.n) ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-400 font-medium mt-2">Pode marcar mais de um dia, se a rota passa mais de uma vez na semana.</p>
            </div>
          )}

          {c.tratamento === TRATAMENTOS.STC && (
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Janela de inserção da STC (dias do mês)</label>
              <div className="flex items-center gap-3">
                <input type="number" min="1" max="31" value={c.janelaInicio ?? ''} onChange={e => muda('janelaInicio', e.target.value ? Number(e.target.value) : null)}
                  placeholder="de" className="w-24 px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold text-center outline-none focus:border-indigo-500" />
                <span className="text-sm text-slate-400 font-bold">até</span>
                <input type="number" min="1" max="31" value={c.janelaFim ?? ''} onChange={e => muda('janelaFim', e.target.value ? Number(e.target.value) : null)}
                  placeholder="até" className="w-24 px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold text-center outline-none focus:border-indigo-500" />
              </div>
              <p className="text-[11px] text-slate-400 font-medium mt-2">O período do mês em que o CDAM pede que as STC sejam inseridas.</p>
            </div>
          )}

          {c.tratamento !== TRATAMENTOS.OCULTO && c.tratamento !== TRATAMENTOS.PENDENTE && (
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Documento lançado no WMS</label>
              <div className="flex gap-2">
                {['GTC', 'STC'].map(d => (
                  <button key={d} onClick={() => muda('documentoEsperado', d)}
                    className={`px-5 py-2 rounded-xl text-sm font-bold transition-all ${c.documentoEsperado === d ? 'bg-slate-800 text-white' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}>
                    {d}
                  </button>
                ))}
              </div>
              {c.documentoEsperado && c.documentoEsperado !== c.tratamento && (
                <p className="text-[11px] text-amber-700 font-bold mt-2 flex items-start gap-1.5">
                  <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                  Tratamento {c.tratamento} com documento {c.documentoEsperado}: a fila segue o tratamento, o documento é só conferência. É o caso da entrega a empresas.
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Sigla</label>
              <input value={c.sigla || ''} onChange={e => muda('sigla', e.target.value)} placeholder="Como aparece no quadro"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Observação</label>
              <input value={c.observacao || ''} onChange={e => muda('observacao', e.target.value)} placeholder="Opcional"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-500" />
            </div>
          </div>
        </div>

        <div className="p-5 border-t border-slate-100 flex items-center justify-end gap-2 bg-slate-50/50">
          <button onClick={fechar} className="px-4 py-2 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100">Cancelar</button>
          <button onClick={() => { salvar(c); fechar(); }} className="px-5 py-2 rounded-xl bg-indigo-600 text-white font-bold text-sm shadow-sm hover:bg-indigo-700 active:scale-95">
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
};

// Cadastro de CAM e rotas. A lista não é digitada: sai do próprio
// movimento do WMS, então cliente novo aparece sozinho como pendente.
const ConfigCamPanel = ({ linhas, resumo, salvar, carregando, salvando, erro }) => {
  const [filtro, setFiltro] = useState('TODOS');
  const [busca, setBusca] = useState('');
  const [editando, setEditando] = useState(null);

  const visiveis = useMemo(() => {
    const termo = busca.trim().toUpperCase();
    return linhas.filter(l => {
      if (filtro !== 'TODOS' && l.config.tratamento !== filtro) return false;
      if (termo && !l.cam.toUpperCase().includes(termo) && !(l.config.sigla || '').toUpperCase().includes(termo)) return false;
      return true;
    });
  }, [linhas, filtro, busca]);

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {editando && <Editor linha={editando} salvar={salvar} fechar={() => setEditando(null)} />}

      <SectionLabel title="CAM e Rotas" description="Quem entrega cada cliente e quando — a base da fila da Expedição" />

      {erro && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-red-50 border border-red-100 text-red-700 text-sm font-medium">
          <AlertTriangle size={18} className="shrink-0 mt-0.5" /> {erro}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { t: 'CAMs na base', v: resumo.total, i: Package, tom: 'text-slate-900' },
          { t: 'GTC — nós entregamos', v: resumo.gtc, i: Truck, tom: 'text-emerald-600' },
          { t: 'STC — terceiro retira', v: resumo.stc, i: Truck, tom: 'text-indigo-600' },
          { t: 'Ocultos', v: resumo.ocultos, i: EyeOff, tom: 'text-slate-400' },
          { t: 'A cadastrar', v: resumo.pendentes, i: AlertTriangle, tom: resumo.pendentes ? 'text-amber-600' : 'text-slate-900' }
        ].map(c => {
          const Icon = c.i;
          return (
            <div key={c.t} className="bg-white p-4 rounded-2xl border border-slate-200">
              <div className="flex items-center gap-1.5 mb-1">
                <Icon size={13} className="text-slate-400" />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-tight">{c.t}</p>
              </div>
              <p className={`text-2xl font-black leading-none ${c.tom}`}>{c.v}</p>
            </div>
          );
        })}
      </div>

      {resumo.incompletos > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-100 text-amber-800 text-sm font-medium">
          <AlertTriangle size={18} className="shrink-0 mt-0.5" />
          {resumo.incompletos} CAM(s) com tratamento definido mas sem rota: GTC sem dia da semana, ou STC sem janela do mês. Sem isso eles não entram na programação da Expedição.
        </div>
      )}

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Settings2 className="text-indigo-500" size={20} />
            <h3 className="text-lg font-black text-slate-800">Cadastro</h3>
            <InfoButton
              title="Como esta lista é montada"
              description="Os CAMs não são digitados: a lista vem do próprio movimento do WMS, ordenada por volume. Um cliente novo aparece sozinho como 'a cadastrar', e um que parou de ser usado pode ser ocultado sem sumir do histórico. Para cada um você define quem entrega — GTC quando o depósito leva, em dia fixo da semana; STC quando terceiro retira, numa janela do mês — e o documento que é lançado no WMS. Quase sempre os dois são iguais, mas não precisam ser: a entrega a empresas é retirada por terceiro e mesmo assim sai com GTC."
            />
            {salvando && <span className="text-[11px] font-bold text-indigo-500 flex items-center gap-1.5"><Loader2 size={13} className="animate-spin" /> salvando</span>}
          </div>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar CAM..."
              className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-indigo-500 w-full md:w-64" />
          </div>
        </div>

        <div className="px-6 py-3 border-b border-slate-100 flex flex-wrap gap-2">
          {FILTROS.map(f => (
            <button key={f.key} onClick={() => setFiltro(f.key)}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${filtro === f.key ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}>
              {f.label}
            </button>
          ))}
        </div>

        {carregando ? (
          <p className="px-6 py-10 text-center text-sm text-slate-400 font-bold flex items-center justify-center gap-2">
            <Loader2 size={16} className="animate-spin text-indigo-500" /> Carregando cadastro...
          </p>
        ) : (
          <div className="overflow-x-auto max-h-[560px]">
            <table className="w-full text-sm text-left text-slate-600">
              <thead className="text-xs text-slate-400 uppercase bg-slate-50 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3">CAM</th>
                  <th className="px-3 py-3">Sigla</th>
                  <th className="px-3 py-3">Quem entrega</th>
                  <th className="px-3 py-3">Rota</th>
                  <th className="px-3 py-3">Doc.</th>
                  <th className="px-3 py-3 text-right">RMs</th>
                  <th className="px-3 py-3">Último mov.</th>
                </tr>
              </thead>
              <tbody>
                {visiveis.map((l, i) => {
                  const info = TRATAMENTO_INFO[l.config.tratamento];
                  const divergente = l.config.documentoEsperado && l.config.documentoEsperado !== l.config.tratamento
                    && l.config.tratamento !== 'OCULTO' && l.config.tratamento !== 'PENDENTE';
                  return (
                    <tr key={l.cam} onClick={() => setEditando(l)}
                      className={`border-b border-slate-50 cursor-pointer hover:bg-indigo-50/60 transition-colors ${i % 2 ? 'bg-slate-50/40' : ''} ${l.config.tratamento === 'OCULTO' ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-2.5 font-bold text-slate-800">{l.cam}</td>
                      <td className="px-3 py-2.5 text-xs">{l.config.sigla || <span className="text-slate-200">—</span>}</td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-black ${TOM_BADGE[info.tom]}`}>{info.curto}</span>
                      </td>
                      <td className={`px-3 py-2.5 text-xs font-medium ${l.completo ? '' : 'text-amber-600 font-bold'}`}>
                        {l.config.tratamento === 'PENDENTE' ? <span className="text-slate-300">—</span> : rotaDescrita(l.config)}
                      </td>
                      <td className="px-3 py-2.5 text-xs">
                        {l.config.documentoEsperado
                          ? <span className={divergente ? 'font-black text-amber-600' : 'font-bold text-slate-500'}>{l.config.documentoEsperado}</span>
                          : <span className="text-slate-200">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold text-slate-700">{l.rms.toLocaleString('pt-BR')}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-400">{l.ultimo ? formatarBr(l.ultimo) : '—'}</td>
                    </tr>
                  );
                })}
                {visiveis.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400 italic">Nenhum CAM nesse filtro.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        <div className="px-6 py-3 border-t border-slate-100 text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
          <CheckCircle2 size={13} /> Clique numa linha para definir quem entrega e a rota.
        </div>
      </div>
    </div>
  );
};

export default ConfigCamPanel;
