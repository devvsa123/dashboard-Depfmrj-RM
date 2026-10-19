import { useMemo, useState } from 'react';
import { Truck, PackageCheck, Clock, AlertTriangle, ChevronDown, ChevronRight, FileWarning, Settings2 } from 'lucide-react';
import SectionLabel from '../SectionLabel';
import DocumentoExpedicaoCard from './DocumentoExpedicaoCard';
import { montarFilasExpedicao } from '../../utils/programacao/expedicao';
import { NIVEIS_COBRANCA, rotaDescrita } from '../../utils/programacao/rotas';
import { formatarBr, hojeIso } from '../../utils/programacao/semana';

const TOM_TEXTO = { emerald: 'text-emerald-600', amber: 'text-amber-600', red: 'text-red-600', slate: 'text-slate-500', indigo: 'text-indigo-600' };
const TOM_BADGE = {
  emerald: 'bg-emerald-100 text-emerald-700',
  amber: 'bg-amber-100 text-amber-700',
  red: 'bg-red-100 text-red-700',
  slate: 'bg-slate-100 text-slate-500',
  indigo: 'bg-indigo-100 text-indigo-700'
};

const FILAS = [
  { key: 'stc', label: 'Prontificar STC', desc: 'Termina quando a STC está lançada em todas as RM não canceladas do CAM' },
  { key: 'gtc', label: 'Fornecer GTC', desc: 'Entrega nossa, por dia de rota — só termina em EXPEDIDO' },
  { key: 'cobranca', label: 'Cobrar a retirada', desc: 'Documento já lançado, aguardando o CDAM (ou a empresa) vir buscar — o que não depende de nós' }
];

const ListaRms = ({ rms, limite = 12 }) => {
  const [tudo, setTudo] = useState(false);
  const mostra = tudo ? rms : rms.slice(0, limite);
  return (
    <div className="px-5 pb-4">
      <div className="flex flex-wrap gap-1.5">
        {mostra.map(l => (
          <span key={l.rm} className="px-2 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-bold text-slate-600" title={l.movimento ? `conferida em ${formatarBr(l.movimento)}` : ''}>
            {l.rm}
            {l.dias != null && <span className="text-slate-400 font-medium"> · {l.dias}d</span>}
          </span>
        ))}
      </div>
      {rms.length > limite && (
        <button onClick={() => setTudo(t => !t)} className="mt-2 text-[11px] font-bold text-indigo-500 hover:text-indigo-700">
          {tudo ? 'mostrar menos' : `ver as outras ${rms.length - limite}`}
        </button>
      )}
    </div>
  );
};

// Uma linha por CAM: o que falta, há quanto tempo e quando é a próxima
// saída. O CAM é a unidade porque é assim que a Expedição carrega.
const GrupoCam = ({ g, modo }) => {
  const [aberto, setAberto] = useState(false);
  const rms = modo === 'gtc' ? [...g.aProntificar, ...g.aEntregar] : g.aProntificar;
  const Chevron = aberto ? ChevronDown : ChevronRight;
  return (
    <div className="border-b border-slate-50 last:border-0">
      <button onClick={() => setAberto(a => !a)} className="w-full px-5 py-3.5 flex items-center gap-3 hover:bg-slate-50/70 text-left">
        <Chevron size={16} className="text-slate-300 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-slate-800 truncate">{g.config.sigla || g.cam}</p>
          <p className="text-[11px] text-slate-400 font-medium truncate">{g.cam}</p>
        </div>

        {modo === 'stc' && (
          <div className="hidden sm:block text-right w-28 shrink-0">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Para fechar</p>
            <p className={`text-sm font-black ${g.faltamFechar ? 'text-amber-600' : 'text-emerald-600'}`}>
              {g.faltamFechar ? `faltam ${g.faltamFechar}` : 'fechado'}
            </p>
          </div>
        )}

        <div className="hidden md:block text-right w-32 shrink-0">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{modo === 'stc' ? 'Janela' : 'Próxima saída'}</p>
          <p className="text-xs font-bold text-slate-600">
            {g.proximaSaida ? formatarBr(g.proximaSaida) : rotaDescrita(g.config)}
          </p>
        </div>

        <div className="text-right w-20 shrink-0">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Mais antiga</p>
          <p className={`text-sm font-black ${g.maisAntiga > 15 ? 'text-red-600' : g.maisAntiga > 7 ? 'text-amber-600' : 'text-slate-700'}`}>
            {g.maisAntiga != null ? `${g.maisAntiga}d` : '—'}
          </p>
        </div>

        <div className="text-right w-16 shrink-0">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">RMs</p>
          <p className="text-lg font-black text-slate-900 leading-none">{rms.length}</p>
        </div>
      </button>

      {aberto && (
        <div className="bg-slate-50/70">
          {g.aProntificar.length > 0 && (
            <>
              <p className="px-5 pt-3 pb-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Sem documento — {g.aProntificar.length}
              </p>
              <ListaRms rms={g.aProntificar} />
            </>
          )}
          {modo === 'gtc' && g.aEntregar.length > 0 && (
            <>
              <p className="px-5 pt-1 pb-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Com GTC lançada, a entregar — {g.aEntregar.length}
              </p>
              <ListaRms rms={g.aEntregar} />
            </>
          )}
          {modo === 'stc' && g.inseridas.length > 0 && (
            <p className="px-5 pb-4 text-[11px] font-medium text-slate-500">
              {g.inseridas.length} RM(s) com documento lançado, aguardando a retirada — ver na fila de cobrança.
            </p>
          )}
          {g.naSeparacao > 0 && (
            <p className="px-5 pb-4 text-[11px] font-medium text-slate-400">
              + {g.naSeparacao} RM(s) ainda na separação; entram nesta fila quando forem conferidas.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

// Fila da Expedição: o que acontece depois do CONFERIDO. Três filas com
// fins diferentes — prontificar, entregar e cobrar — porque só as duas
// primeiras dependem de nós.
const ExpedicaoPanel = ({ indiceWms, porCam, semanaRef, programador, encarregado, setEncarregado }) => {
  const [fila, setFila] = useState('stc');
  const filas = useMemo(() => montarFilasExpedicao(indiceWms, porCam, hojeIso()), [indiceWms, porCam]);
  const { resumo } = filas;

  // A fila da STC é ordenada pela janela do mês: quem fecha primeiro
  // aparece primeiro. A da GTC, pelo dia da rota, pelo mesmo motivo.
  const porSaida = (a, b) => {
    if (a.proximaSaida && b.proximaSaida && a.proximaSaida !== b.proximaSaida) return a.proximaSaida.localeCompare(b.proximaSaida);
    if (a.proximaSaida && !b.proximaSaida) return -1;
    if (!a.proximaSaida && b.proximaSaida) return 1;
    return (b.maisAntiga ?? 0) - (a.maisAntiga ?? 0);
  };

  const stcComTrabalho = useMemo(
    () => filas.stc.filter(g => g.aProntificar.length > 0).sort(porSaida),
    [filas.stc]
  );
  const gtcComTrabalho = useMemo(
    () => filas.gtc.filter(g => g.aProntificar.length + g.aEntregar.length > 0).sort(porSaida),
    [filas.gtc]
  );
  const semRota = useMemo(() => filas.semCadastro.slice().sort((a, b) => (b.maisAntiga ?? 0) - (a.maisAntiga ?? 0)), [filas.semCadastro]);

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <SectionLabel title="Fila da Expedição" description="O que acontece depois do CONFERIDO — prontificar, entregar e cobrar" />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { t: 'A prontificar', v: resumo.aProntificar, i: PackageCheck, tom: resumo.aProntificar ? 'text-amber-600' : 'text-slate-900' },
          { t: 'GTC a entregar', v: resumo.gtcAEntregar, i: Truck, tom: 'text-emerald-600' },
          { t: 'Aguardando retirada', v: resumo.stcACobrar, i: Clock, tom: 'text-indigo-600' },
          { t: 'Vencidas +15 dias', v: resumo.vermelhos, i: AlertTriangle, tom: resumo.vermelhos ? 'text-red-600' : 'text-slate-900' },
          { t: 'CAMs a fechar', v: resumo.camsAFechar, i: FileWarning, tom: 'text-slate-900' }
        ].map(c => {
          const Icon = c.i;
          return (
            <div key={c.t} className="bg-white p-4 rounded-2xl border border-slate-200">
              <div className="flex items-center gap-1.5 mb-1">
                <Icon size={13} className="text-slate-400" />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-tight">{c.t}</p>
              </div>
              <p className={`text-2xl font-black leading-none ${c.tom}`}>{c.v.toLocaleString('pt-BR')}</p>
            </div>
          );
        })}
      </div>

      {resumo.camsSemCadastro > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-100 text-amber-800 text-sm font-medium">
          <Settings2 size={18} className="shrink-0 mt-0.5" />
          <span>
            {resumo.camsSemCadastro} CAM(s) com material parado na Expedição e ainda sem cadastro de rota — não dá para dizer quem entrega nem quando até classificá-los em CAM e Rotas:{' '}
            <strong>{semRota.slice(0, 6).map(g => g.cam).join(', ')}</strong>{semRota.length > 6 ? ` e mais ${semRota.length - 6}` : ''}.
          </span>
        </div>
      )}

      <div className="flex p-1 bg-white rounded-2xl border border-slate-200 w-fit shadow-sm">
        {FILAS.map(f => (
          <button
            key={f.key}
            onClick={() => setFila(f.key)}
            className={`px-5 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${fila === f.key ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h3 className="text-lg font-black text-slate-800">{FILAS.find(f => f.key === fila).label}</h3>
          <p className="text-sm text-slate-500 font-medium mt-0.5">{FILAS.find(f => f.key === fila).desc}</p>
        </div>

        {fila === 'stc' && (
          stcComTrabalho.length === 0
            ? <p className="px-6 py-10 text-center text-sm text-slate-400 italic">Nenhum CAM de STC com material esperando documento.</p>
            : stcComTrabalho.map(g => <GrupoCam key={g.cam} g={g} modo="stc" />)
        )}

        {fila === 'gtc' && (
          gtcComTrabalho.length === 0
            ? <p className="px-6 py-10 text-center text-sm text-slate-400 italic">Nenhuma entrega nossa pendente.</p>
            : gtcComTrabalho.map(g => <GrupoCam key={g.cam} g={g} modo="gtc" />)
        )}

        {fila === 'cobranca' && (
          filas.cobranca.length === 0
            ? <p className="px-6 py-10 text-center text-sm text-slate-400 italic">Nenhum documento lançado aguardando retirada.</p>
            : (
              <>
                <div className="px-6 py-3 bg-slate-50/70 border-b border-slate-100 flex flex-wrap gap-4">
                  {NIVEIS_COBRANCA.map(n => (
                    <span key={n.key} className={`text-[11px] font-bold px-2.5 py-1 rounded-lg ${TOM_BADGE[n.tom]}`}>
                      {n.label} · {n.limite === Infinity ? '+15 dias' : `até ${n.limite} dias`}
                    </span>
                  ))}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50/50 border-b border-slate-100">
                      <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <th className="px-6 py-3 text-left">Documento</th>
                        <th className="px-4 py-3 text-left">CAM</th>
                        <th className="px-4 py-3 text-right">RMs</th>
                        <th className="px-4 py-3 text-right">Pronto desde</th>
                        <th className="px-4 py-3 text-right">Parado</th>
                        <th className="px-6 py-3 text-left">Situação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filas.cobranca.map(d => (
                        <tr key={d.documento} className="hover:bg-slate-50/70">
                          <td className="px-6 py-3 font-black text-slate-800">{d.documento}</td>
                          <td className="px-4 py-3 text-slate-600 font-medium">{d.sigla}</td>
                          <td className="px-4 py-3 text-right font-bold text-slate-700">{d.qtd}</td>
                          <td className="px-4 py-3 text-right text-slate-400 text-xs font-medium">{d.desde ? formatarBr(d.desde) : '—'}</td>
                          <td className={`px-4 py-3 text-right font-black ${TOM_TEXTO[d.nivel.tom]}`}>{d.dias}d</td>
                          <td className="px-6 py-3">
                            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg ${TOM_BADGE[d.nivel.tom]}`}>{d.nivel.label}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )
        )}
      </div>

      <p className="text-[11px] text-slate-400 font-medium px-1">
        O tempo de espera é contado da conferência, não da inserção do documento: o WMS não guarda quando a STC foi lançada.
      </p>

      {/* O documento vem por último, como na programação da semana: é a
          última coisa que se faz depois de olhar as filas. */}
      <DocumentoExpedicaoCard
        filas={filas}
        semanaRef={semanaRef}
        programador={programador}
        encarregado={encarregado}
        setEncarregado={setEncarregado}
      />
    </div>
  );
};

export default ExpedicaoPanel;
