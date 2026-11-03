import { useMemo, useState } from 'react';
import { Layers, FileSpreadsheet, Loader2, AlertCircle, X, Search } from 'lucide-react';
import InfoButton from '../InfoButton';
import { analisarFila } from '../../utils/programacao/fila';
import { exportarExcelFila } from '../../utils/programacao/planilhaProgramacao';
import { formatarBr, hojeIso } from '../../utils/programacao/semana';

// Faixa de idade: a cor acompanha a espera, não o status. Uma RM de 60
// dias é vermelha esteja ela em que situação estiver.
const TOM_FAIXA = ['text-emerald-600', 'text-emerald-600', 'text-amber-600', 'text-orange-600', 'text-red-600'];

const Barra = ({ pct, tom = 'bg-indigo-500' }) => (
  <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
    <div className={`h-full rounded-full ${tom}`} style={{ width: `${Math.max(1, pct)}%` }} />
  </div>
);

const ListaModal = ({ titulo, subtitulo, rms, onClose }) => {
  const [busca, setBusca] = useState('');
  if (!rms) return null;
  const alvo = busca.trim().toUpperCase();
  const visiveis = alvo
    ? rms.filter(l => String(l.rm).includes(alvo) || l.cam.toUpperCase().includes(alvo) || l.status.includes(alvo))
    : rms;
  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white w-full max-w-3xl max-h-[85vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-slate-100 flex items-center justify-between gap-3 bg-slate-50/50">
          <div className="min-w-0">
            <h3 className="text-lg font-black text-slate-800 truncate">{titulo}</h3>
            <p className="text-sm text-slate-500 font-medium mt-1">{subtitulo}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 shrink-0"><X size={22} /></button>
        </div>
        <div className="px-6 py-3 border-b border-slate-100 flex items-center gap-2">
          <Search size={15} className="text-slate-400" />
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Procurar RM, CAM ou situação"
            className="flex-1 text-sm font-medium outline-none"
          />
          <span className="text-[11px] font-bold text-slate-400">{visiveis.length} de {rms.length}</span>
        </div>
        <div className="flex-1 overflow-auto p-6">
          <table className="w-full text-sm text-left text-slate-600">
            <thead className="text-xs text-slate-400 uppercase bg-slate-50 sticky top-0">
              <tr>
                <th className="px-3 py-2">RM</th>
                <th className="px-3 py-2">CAM</th>
                <th className="px-3 py-2">Situação</th>
                <th className="px-3 py-2">Liberada em</th>
                <th className="px-3 py-2 text-right">Dias</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((l, i) => (
                <tr key={`${l.rm}-${i}`} className="border-b border-slate-50">
                  <td className="px-3 py-2 font-bold text-slate-800">{l.rm}</td>
                  <td className="px-3 py-2 text-xs">{l.sigla}</td>
                  <td className="px-3 py-2 text-xs">{l.status}</td>
                  <td className="px-3 py-2 text-xs">{l.entrada ? formatarBr(l.entrada) : '—'}</td>
                  <td className={`px-3 py-2 text-xs font-bold text-right ${l.dias == null ? 'text-slate-300' : l.dias > 30 ? 'text-red-600' : l.dias > 15 ? 'text-amber-600' : 'text-slate-500'}`}>
                    {l.dias == null ? '—' : l.dias}
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

// A fila de processamento: o que está no meio do caminho agora, lido só
// do arquivo do PWA. Não olha versão publicada nem semana: é um retrato
// do instante, e o arquivo é atualizado com frequência alta.
const FilaPanel = ({ indiceWms, porCam, capacidadeMedida, ultimaSync }) => {
  const [modal, setModal] = useState(null);
  const [todosOsCams, setTodosOsCams] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState('');
  const hoje = hojeIso();

  const analise = useMemo(() => analisarFila({
    indiceWms,
    hoje,
    capacidadeSemana: capacidadeMedida?.totalSemanal || null,
    porCam
  }), [indiceWms, hoje, capacidadeMedida, porCam]);

  if (!analise) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200 p-10 text-center">
        <Layers className="text-slate-300 mx-auto mb-3" size={36} />
        <p className="text-sm font-bold text-slate-600">O arquivo de situação das RMs ainda não carregou.</p>
        <p className="text-xs text-slate-400 font-medium mt-1">A análise da fila sai dele, e de mais nada.</p>
      </div>
    );
  }

  const baixar = () => {
    setErro('');
    setGerando(true);
    try {
      exportarExcelFila({ analise, emitidoEm: formatarBr(hoje) });
    } catch (e) {
      console.error(e);
      setErro(`Não foi possível gerar o Excel: ${e?.message || e}`);
    } finally {
      setGerando(false);
    }
  };

  const camsVisiveis = todosOsCams ? analise.porCliente : analise.porCliente.slice(0, 12);
  const maiorCam = analise.porCliente[0]?.qtd || 1;

  return (
    <div className="space-y-5">
      <ListaModal {...(modal || {})} rms={modal?.rms} onClose={() => setModal(null)} />

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Layers className="text-indigo-500" size={20} />
          <h3 className="text-lg font-black text-slate-800">Análise da Fila</h3>
          <InfoButton
            title="O que entra na fila"
            description="A fila é o meio do processo, lido só do arquivo de situação das RMs que vem do PWA — nada de SINGRA e nada de programação publicada. Ficam fora: Em planejamento (o primeiro status, quando o pedido chega e ainda não entrou em trabalho), Aguardando conferência, Conferido (a separação terminou e o pedido passou à Expedição) e Expedido. As canceladas não são mostradas. Qualquer outra situação é fila — de propósito, para que uma situação nova do PWA apareça na conta em vez de desaparecer dela. Quando a mesma RM tem mais de um ciclo (cancelada e reaberta), vale o ciclo mais novo. A idade é contada da data de liberação."
          />
        </div>
        <div className="flex items-center gap-3">
          <p className="text-[11px] text-slate-400 font-medium">
            arquivo do PWA{ultimaSync ? ` · ${ultimaSync}` : ''}
          </p>
          <button
            onClick={baixar}
            disabled={gerando}
            className="px-4 py-2 rounded-xl bg-white border border-emerald-200 text-emerald-700 font-bold text-sm shadow-sm flex items-center gap-2 hover:bg-emerald-50 disabled:opacity-40 transition-all active:scale-95"
          >
            {gerando ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />}
            {gerando ? 'Gerando...' : 'Baixar Excel'}
          </button>
        </div>
      </div>

      {erro && <p className="flex items-center gap-2 text-red-600 text-xs font-bold"><AlertCircle size={14} /> {erro}</p>}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { t: 'RMs na fila', v: analise.total, tom: 'text-slate-900' },
          { t: 'Clientes', v: analise.cams, tom: 'text-slate-900' },
          { t: 'Idade média', v: analise.mediaDias == null ? '—' : `${analise.mediaDias} d`, tom: analise.mediaDias > 30 ? 'text-red-600' : analise.mediaDias > 15 ? 'text-amber-600' : 'text-slate-900' },
          { t: 'Maior espera', v: analise.maisAntiga?.dias == null ? '—' : `${analise.maisAntiga.dias} d`, tom: 'text-red-600' },
          {
            t: 'Semanas para zerar',
            v: analise.semanasParaZerar == null ? '—' : String(analise.semanasParaZerar).replace('.', ','),
            tom: analise.semanasParaZerar > 4 ? 'text-red-600' : analise.semanasParaZerar > 2 ? 'text-amber-600' : 'text-emerald-600'
          }
        ].map(c => (
          <div key={c.t} className="bg-white p-4 rounded-2xl border border-slate-200">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{c.t}</p>
            <p className={`text-2xl font-black leading-none mt-1.5 ${c.tom}`}>{c.v}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 space-y-2">
        <p className="text-sm text-slate-500 font-medium">
          <strong className="text-slate-800">{analise.total} RM(s)</strong> estão em processamento agora, de {analise.cams} cliente(s),
          {analise.mediaDias != null ? <> com média de <strong className="text-slate-800">{analise.mediaDias} dias</strong> desde a liberação (mediana de {analise.medianaDias})</> : ' sem data de liberação para medir idade'}.
          {analise.maisAntiga && <> A mais antiga é a RM <strong className="text-slate-800">{analise.maisAntiga.rm}</strong> ({analise.maisAntiga.sigla}), liberada em {formatarBr(analise.maisAntiga.entrada)} — {analise.maisAntiga.dias} dias.</>}
          {analise.semanasParaZerar != null && <> Na vazão medida de {analise.capacidadeSemana} RMs por semana, a fila equivale a {String(analise.semanasParaZerar).replace('.', ',')} semana(s) de trabalho.</>}
          {analise.reemitidas > 0 && <> {analise.reemitidas} delas são reemissões — RMs que já foram canceladas e voltaram; conta o ciclo novo.</>}
          {analise.semData > 0 && <> {analise.semData} estão sem data de liberação no arquivo e ficam fora das contas de idade.</>}
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Onde a fila está parada</p>
            <p className="text-xs text-slate-400 font-medium mt-1">Situação de cada RM no arquivo do PWA. Clique para ver a lista.</p>
          </div>
          <div className="divide-y divide-slate-50">
            {analise.porStatus.map(s => (
              <button
                key={s.status}
                onClick={() => setModal({
                  titulo: s.status,
                  subtitulo: `${s.qtd} RM(s) · ${s.pct}% da fila · idade média de ${s.mediaDias ?? '—'} dias`,
                  rms: analise.linhas.filter(l => l.status === s.status)
                })}
                className="w-full px-6 py-3 text-left hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-bold text-slate-800 truncate">{s.status}</span>
                  <span className="text-sm font-black text-slate-900 shrink-0">{s.qtd}</span>
                </div>
                <div className="flex items-center gap-3 mt-1.5">
                  <div className="flex-1"><Barra pct={s.pct} /></div>
                  <span className="text-[11px] font-bold text-slate-400 shrink-0 w-28 text-right">
                    {s.pct}% · média {s.mediaDias ?? '—'} d
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-5">
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Idade da fila</p>
              <p className="text-xs text-slate-400 font-medium mt-1">Dias desde a liberação da RM.</p>
            </div>
            <div className="divide-y divide-slate-50">
              {analise.faixas.map((f, i) => (
                <button
                  key={f.label}
                  onClick={() => setModal({
                    titulo: f.label,
                    subtitulo: `${f.qtd} RM(s) · ${f.pct}% da fila`,
                    rms: analise.linhas.filter(l => l.dias != null && l.dias >= f.min && l.dias <= f.max)
                  })}
                  disabled={!f.qtd}
                  className="w-full px-6 py-3 flex items-center justify-between gap-3 text-left hover:bg-slate-50 disabled:hover:bg-white transition-colors"
                >
                  <span className="text-sm font-bold text-slate-600">{f.label}</span>
                  <span className="flex items-baseline gap-2 shrink-0">
                    <span className={`text-lg font-black ${f.qtd ? TOM_FAIXA[i] : 'text-slate-300'}`}>{f.qtd}</span>
                    <span className="text-[11px] font-bold text-slate-400 w-12 text-right">{f.pct}%</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">O que não entra na fila</p>
              <p className="text-xs text-slate-400 font-medium mt-1">
                Conferência do arquivo: {analise.totalNoArquivo} RM(s) no total, {analise.total} na fila e {analise.totalForaDaFila} fora.
              </p>
            </div>
            <div className="divide-y divide-slate-50">
              {analise.foraDaFila.map(f => (
                <div key={f.status} className="px-6 py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-600 truncate">{f.status}</p>
                    <p className="text-[11px] text-slate-400 font-medium truncate">{f.motivo}</p>
                  </div>
                  <span className="text-sm font-black text-slate-400 shrink-0">{f.qtd}</span>
                </div>
              ))}
            </div>
            {/* Dois números com o mesmo nome confundem: o da grade conta
                tudo que ainda depende do depósito, este só o meio do
                processo. Dizer isso aqui evita a pergunta. */}
            <p className="px-6 py-3 border-t border-slate-100 bg-slate-50/50 text-[11px] text-slate-400 font-medium">
              A <strong className="text-slate-500">fila de separação</strong> que alimenta a grade da semana é outra conta: ela
              inclui as Em planejamento e as Aguardando conferência, porque todas ainda dependem de trabalho do depósito.
              Esta análise mede só o que já está em processamento.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">A fila por cliente</p>
            <p className="text-xs text-slate-400 font-medium mt-1">Do maior para o menor. Clique no cliente para ver as RMs dele.</p>
          </div>
          {analise.porCliente.length > 12 && (
            <button onClick={() => setTodosOsCams(t => !t)} className="text-[11px] font-bold text-indigo-500 hover:text-indigo-700 shrink-0">
              {todosOsCams ? 'mostrar os 12 maiores' : `ver todos os ${analise.porCliente.length}`}
            </button>
          )}
        </div>
        <div className="divide-y divide-slate-50">
          {camsVisiveis.map(c => (
            <button
              key={c.cam}
              onClick={() => setModal({
                titulo: c.sigla,
                subtitulo: `${c.qtd} RM(s) na fila · idade média de ${c.mediaDias ?? '—'} dias · maior espera de ${c.maiorEspera ?? '—'} dias`,
                rms: c.rms
              })}
              className="w-full px-6 py-3 text-left hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-bold text-slate-800 truncate">{c.sigla}</span>
                <span className="flex items-baseline gap-3 shrink-0">
                  <span className={`text-[11px] font-bold ${c.maiorEspera > 30 ? 'text-red-600' : c.maiorEspera > 15 ? 'text-amber-600' : 'text-slate-400'}`}>
                    {c.mediaDias ?? '—'} d em média · {c.maiorEspera ?? '—'} d a mais antiga
                  </span>
                  <span className="text-sm font-black text-slate-900 w-10 text-right">{c.qtd}</span>
                </span>
              </div>
              <div className="mt-1.5"><Barra pct={(c.qtd / maiorCam) * 100} tom="bg-slate-300" /></div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FilaPanel;
