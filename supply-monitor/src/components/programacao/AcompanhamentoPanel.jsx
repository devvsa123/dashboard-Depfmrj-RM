import { useMemo, useState } from 'react';
import { Activity, AlertTriangle, PlusCircle, X, FileText, TrendingUp } from 'lucide-react';
import InfoButton from '../InfoButton';
import { analisarAndamento, ESTADOS, ESTADO_INFO } from '../../utils/programacao/acompanhamento';
import { rotuloVersao } from '../../utils/programacao/versoes';
import { formatarBr, formatarCurto, DIAS_CURTOS } from '../../utils/programacao/semana';

const TOM = {
  red: 'bg-red-50 border-red-100 text-red-700',
  emerald: 'bg-emerald-50 border-emerald-100 text-emerald-700',
  indigo: 'bg-indigo-50 border-indigo-100 text-indigo-700',
  slate: 'bg-slate-50 border-slate-200 text-slate-600',
  amber: 'bg-amber-50 border-amber-100 text-amber-700'
};
const TOM_TEXTO = { red: 'text-red-600', emerald: 'text-emerald-600', indigo: 'text-indigo-600', slate: 'text-slate-500', amber: 'text-amber-600' };

const ListaModal = ({ titulo, subtitulo, linhas, onClose, handleDownloadExcel }) => {
  if (!linhas) return null;
  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white w-full max-w-3xl max-h-[85vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="min-w-0">
            <h3 className="text-lg font-black text-slate-800 truncate">{titulo}</h3>
            <p className="text-sm text-slate-500 font-medium mt-1">{subtitulo}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => handleDownloadExcel(linhas, titulo.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_').slice(0, 60))}
              className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl text-sm font-bold hover:bg-indigo-100"
            >
              Baixar
            </button>
            <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-500"><X size={22} /></button>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-6">
          <table className="w-full text-sm text-left text-slate-600">
            <thead className="text-xs text-slate-400 uppercase bg-slate-50 sticky top-0">
              <tr>
                <th className="px-3 py-2">RM</th>
                <th className="px-3 py-2">CAM</th>
                <th className="px-3 py-2">Programada</th>
                <th className="px-3 py-2">Documento</th>
                <th className="px-3 py-2">Situação</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l, i) => (
                <tr key={`${l.rm}-${i}`} className="border-b border-slate-50">
                  <td className="px-3 py-2 font-bold text-slate-800">{l.rm}</td>
                  <td className="px-3 py-2 text-xs">{l.cam}</td>
                  <td className="px-3 py-2 text-xs">{l.diaProgramado ? formatarBr(l.diaProgramado) : '—'}</td>
                  <td className="px-3 py-2 text-xs">{l.documento || '—'}</td>
                  <td className={`px-3 py-2 text-xs font-bold ${TOM_TEXTO[ESTADO_INFO[l.estado]?.tom] || ''}`}>
                    {ESTADO_INFO[l.estado]?.label || l.estado}
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

// Como está indo a semana: compara a versão publicada com o WMS de agora.
const AcompanhamentoPanel = ({ versoes, semanaRef, indiceWms, diffPendente, publicar, handleDownloadExcel }) => {
  const [versaoNum, setVersaoNum] = useState(null);
  const [modal, setModal] = useState(null);
  const [publicando, setPublicando] = useState(false);

  const versao = useMemo(() => {
    if (!versoes.length) return null;
    const achada = versoes.find(v => v.numero === versaoNum);
    return achada || versoes[versoes.length - 1];
  }, [versoes, versaoNum]);

  const analise = useMemo(
    () => (versao ? analisarAndamento({ snapshot: versao.snapshot, indiceWms, semanaRef }) : null),
    [versao, indiceWms, semanaRef]
  );

  if (!versoes.length) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200 p-10 text-center">
        <FileText className="text-slate-300 mx-auto mb-3" size={36} />
        <p className="text-sm font-bold text-slate-600">Nenhuma programação publicada para esta semana.</p>
        <p className="text-xs text-slate-400 font-medium mt-1">O acompanhamento compara o que foi publicado com o que o WMS mostra agora.</p>
      </div>
    );
  }
  if (!analise) return null;

  const camsTodos = [...analise.porCam, ...analise.camsSoAMais];

  return (
    <div className="space-y-5">
      <ListaModal {...(modal || {})} linhas={modal?.linhas} onClose={() => setModal(null)} handleDownloadExcel={handleDownloadExcel} />

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Activity className="text-indigo-500" size={20} />
          <h3 className="text-lg font-black text-slate-800">Andamento da Semana</h3>
          <InfoButton
            title="De onde sai o acompanhamento"
            description="A comparação é entre a versão publicada — que fica guardada inteira no banco, RM por RM — e o que o WMS mostra agora. Não usamos o PDF: ele é imagem, não tem texto dentro, e o banco já tem o mesmo conteúdo de forma exata. Uma RM conta como cumprida quando chega a CONFERIDO, que é onde termina o trabalho do depósito. Se além disso já tem STC ou GTC no pedido, a Expedição também prontificou."
          />
        </div>
        <select
          value={versao.numero}
          onChange={e => setVersaoNum(Number(e.target.value))}
          className="px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold outline-none focus:border-indigo-500 bg-white"
        >
          {[...versoes].reverse().map(v => (
            <option key={v.numero} value={v.numero}>{rotuloVersao(v.numero)}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { t: 'Programadas', v: analise.totalPlanejado, tom: 'text-slate-900' },
          { t: 'Cumpridas', v: analise.cumpridas, tom: 'text-emerald-600' },
          { t: 'Em aberto', v: analise.naoCumpridas, tom: analise.naoCumpridas ? 'text-red-600' : 'text-slate-900' },
          { t: 'Cumprimento', v: `${analise.taxa}%`, tom: analise.taxa >= 90 ? 'text-emerald-600' : analise.taxa >= 70 ? 'text-amber-600' : 'text-red-600' },
          { t: 'Prontificadas', v: analise.prontificadas, tom: 'text-indigo-600' }
        ].map(c => (
          <div key={c.t} className="bg-white p-4 rounded-2xl border border-slate-200">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{c.t}</p>
            <p className={`text-2xl font-black leading-none mt-1.5 ${c.tom}`}>{c.v}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Situação das RMs programadas</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {Object.values(ESTADOS).map(e => {
            const lista = analise.porEstado[e];
            if (!lista.length) return null;
            const info = ESTADO_INFO[e];
            return (
              <button
                key={e}
                onClick={() => setModal({ titulo: info.label, subtitulo: `${lista.length} RM(s) · ${info.descricao}`, linhas: lista })}
                className={`p-4 rounded-2xl border text-left transition-all hover:shadow-sm ${TOM[info.tom]}`}
              >
                <p className="text-2xl font-black leading-none">{lista.length}</p>
                <p className="text-xs font-black mt-1">{info.label}</p>
                <p className="text-[11px] font-medium opacity-70 mt-0.5 leading-tight">{info.descricao}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
        {analise.porDia.map(d => {
          const pct = d.planejado ? Math.round((d.cumprido / d.planejado) * 100) : 0;
          return (
            <div key={d.dia} className="bg-white p-4 rounded-2xl border border-slate-200">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                {DIAS_CURTOS[new Date(d.dia + 'T00:00:00Z').getUTCDay()]} {formatarCurto(d.dia)}
              </p>
              <p className="text-2xl font-black text-slate-900 leading-none mt-1.5">{d.cumprido}<span className="text-sm text-slate-400 font-bold">/{d.planejado}</span></p>
              <div className="h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden">
                <div className={`h-full rounded-full ${pct >= 90 ? 'bg-emerald-500' : pct >= 70 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {analise.aMais.length > 0 && (
        <button
          onClick={() => setModal({ titulo: 'Separadas fora da programação', subtitulo: `${analise.aMais.length} RM(s) trabalhadas na semana sem estar na grade`, linhas: analise.aMais })}
          className="w-full bg-white rounded-3xl shadow-sm border border-amber-200 p-5 flex items-center gap-4 text-left hover:shadow-md transition-all"
        >
          <span className="p-2.5 rounded-xl bg-amber-50 text-amber-600 shrink-0"><PlusCircle size={20} /></span>
          <div className="min-w-0">
            <p className="font-black text-slate-800">{analise.aMais.length} RM(s) separadas fora da programação</p>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Trabalhadas dentro da semana sem constar na grade publicada. Clique para ver quais.
            </p>
          </div>
        </button>
      )}

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center gap-2">
          <TrendingUp className="text-indigo-500" size={20} />
          <h3 className="text-lg font-black text-slate-800">Cumprimento por CAM</h3>
        </div>
        <div className="overflow-x-auto max-h-[420px]">
          <table className="w-full text-sm text-left text-slate-600">
            <thead className="text-xs text-slate-400 uppercase bg-slate-50 sticky top-0">
              <tr>
                <th className="px-4 py-3">CAM</th>
                <th className="px-3 py-3 text-right">Programado</th>
                <th className="px-3 py-3 text-right">Cumprido</th>
                <th className="px-3 py-3 text-right">Em aberto</th>
                <th className="px-3 py-3 text-right">Fora do plano</th>
                <th className="px-3 py-3 text-right">%</th>
              </tr>
            </thead>
            <tbody>
              {camsTodos.map((c, i) => {
                const pct = c.planejado ? Math.round((c.cumprido / c.planejado) * 100) : null;
                return (
                  <tr key={c.cam} className={`border-b border-slate-50 ${i % 2 ? 'bg-slate-50/40' : ''}`}>
                    <td className="px-4 py-2.5 font-bold text-slate-800">{c.cam}</td>
                    <td className="px-3 py-2.5 text-right">{c.planejado || <span className="text-slate-200">—</span>}</td>
                    <td className="px-3 py-2.5 text-right font-bold text-emerald-600">{c.cumprido || <span className="text-slate-200">—</span>}</td>
                    <td className="px-3 py-2.5 text-right font-bold text-red-500">{c.pendente || <span className="text-slate-200">—</span>}</td>
                    <td className="px-3 py-2.5 text-right font-bold text-amber-600">{c.aMais || <span className="text-slate-200">—</span>}</td>
                    <td className={`px-3 py-2.5 text-right font-black ${pct === null ? 'text-slate-200' : pct >= 90 ? 'text-emerald-600' : pct >= 70 ? 'text-amber-600' : 'text-red-600'}`}>
                      {pct === null ? '—' : `${pct}%`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {diffPendente && diffPendente.totalMudancas > 0 && (
        <div className="bg-white rounded-3xl shadow-sm border border-indigo-200 p-6 space-y-3">
          <p className="font-black text-slate-800 flex items-center gap-2">
            <AlertTriangle size={18} className="text-indigo-500" /> Ajustar a programação ao que realmente aconteceu
          </p>
          <p className="text-sm text-slate-500 font-medium leading-relaxed">
            A grade já se refez sozinha a partir do WMS: o que foi separado saiu da fila e o que não foi continua nela.
            Publicando uma alteração agora, a programação passa a refletir a realidade — e o documento sai com o Anexo B
            explicando a diferença.
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-bold text-slate-500">
            {diffPendente.entraram.length > 0 && <span>{diffPendente.entraram.length} entrariam</span>}
            {diffPendente.sairam.length > 0 && <span>{diffPendente.sairam.length} sairiam</span>}
            {diffPendente.remanejadas.length > 0 && <span>{diffPendente.remanejadas.length} mudariam de dia</span>}
          </div>
          <button
            onClick={async () => { setPublicando(true); await publicar(); setPublicando(false); }}
            disabled={publicando}
            className="px-5 py-2 rounded-xl bg-indigo-600 text-white font-bold text-sm shadow-sm hover:bg-indigo-700 disabled:opacity-40 transition-all active:scale-95"
          >
            {publicando ? 'Publicando...' : `Publicar ${rotuloVersao(versoes.length)}`}
          </button>
        </div>
      )}
    </div>
  );
};

export default AcompanhamentoPanel;
