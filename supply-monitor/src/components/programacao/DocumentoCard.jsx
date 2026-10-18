import { useRef, useState, useMemo } from 'react';
import { FileDown, Loader2, AlertCircle, AlertTriangle } from 'lucide-react';
import InfoButton from '../InfoButton';
import ProgramacaoDocument from './ProgramacaoDocument';
import { gerarPdfProgramacao, PDF_CONTENT_WIDTH_PX } from '../../utils/programacao/pdfProgramacao';
import { formatarBr, rotuloSemana } from '../../utils/programacao/semana';
import { compararVersoes, rotuloVersao } from '../../utils/programacao/versoes';

// O documento sai sempre da versão PUBLICADA, nunca da proposta na tela —
// senão o PDF impresso poderia divergir do que foi publicado.
const DocumentoCard = ({ versoes, ultimaVersao, diffPendente, semanaRef, programador, encarregado, setEncarregado }) => {
  const ref = useRef(null);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState('');

  const anterior = versoes.length > 1 ? versoes[versoes.length - 2] : null;
  const diff = useMemo(
    () => (anterior && ultimaVersao ? compararVersoes(anterior.snapshot, ultimaVersao.snapshot) : null),
    [anterior, ultimaVersao]
  );

  const versao = ultimaVersao ? rotuloVersao(ultimaVersao.numero) : null;
  const emitidoEm = ultimaVersao ? formatarBr(ultimaVersao.publicadaEm.split('T')[0]) : '';
  const temPendencia = Boolean(diffPendente && diffPendente.totalMudancas > 0);

  const gerar = async () => {
    setGerando(true);
    setErro('');
    try {
      await new Promise(r => setTimeout(r, 600));
      const sufixo = ultimaVersao.numero === 0 ? 'Original' : `Alteracao_${ultimaVersao.numero}`;
      await gerarPdfProgramacao(ref.current, {
        filename: `Programacao_Semanal_${semanaRef}_${sufixo}.pdf`,
        rodape: `DepFMRJ — Programação Semanal — ${rotuloSemana(semanaRef)} — ${versao}`
      });
    } catch (e) {
      console.error(e);
      setErro('Não foi possível gerar o PDF. Tente novamente.');
    } finally {
      setGerando(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 space-y-4">
      <div className="flex items-center gap-2">
        <FileDown className="text-indigo-500" size={20} />
        <h3 className="text-lg font-black text-slate-800">Documento da Programação</h3>
        <InfoButton
          title="O que sai no PDF"
          description="Um documento A4 com o resumo da semana, a grade de atendimento por CAM, os dias sem separação, as demandas com prazo e as observações — mais o Anexo A, que detalha por dia o que será atendido e por quê. A partir da segunda versão entra também o Anexo B, com o que mudou em relação à anterior. O documento sai sempre da versão publicada, não do que está na tela: publique antes de baixar."
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Programador do DepFMRJ</label>
          <div className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-700">
            {programador || '—'}
          </div>
        </div>
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Encarregado do Abastecimento</label>
          <input value={encarregado} onChange={e => setEncarregado(e.target.value)} placeholder="Posto e nome" className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold outline-none focus:border-indigo-500" />
        </div>
      </div>

      {temPendencia && (
        <p className="flex items-start gap-2 text-amber-700 text-xs font-bold p-3 rounded-xl bg-amber-50 border border-amber-100">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          A grade na tela tem {diffPendente.totalMudancas} mudança(s) ainda não publicada(s). O PDF sairá com a {versao?.toLowerCase()}, que é a versão publicada.
        </p>
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-[11px] text-slate-400 font-medium">
          {ultimaVersao
            ? `${versao} · ${ultimaVersao.snapshot.resumo.totalProgramado} RMs · ${ultimaVersao.snapshot.resumo.camsAtendidos} CAMs${diff ? ` · Anexo B com ${diff.totalMudancas} mudança(s)` : ''}`
            : 'Publique a programação da semana para poder baixar o documento.'}
        </p>
        <button
          onClick={gerar}
          disabled={!ultimaVersao || gerando}
          className="px-5 py-2 rounded-xl bg-indigo-600 text-white font-bold text-sm shadow-sm flex items-center gap-2 hover:bg-indigo-700 disabled:opacity-40 transition-all active:scale-95"
        >
          {gerando ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}
          {gerando ? 'Gerando PDF...' : 'Baixar documento'}
        </button>
      </div>

      {erro && <p className="flex items-center gap-2 text-red-600 text-xs font-bold"><AlertCircle size={14} /> {erro}</p>}

      {/* Documento estático, só para a captura do PDF. Fica na origem com
          opacidade zero e fixado na largura útil da página A4 — renderizar
          numa largura e capturar em outra corta o conteúdo na borda
          direita (ver pdfReport.js). */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: PDF_CONTENT_WIDTH_PX, opacity: 0, zIndex: -1, pointerEvents: 'none' }} aria-hidden="true">
        <ProgramacaoDocument
          ref={ref}
          snapshot={ultimaVersao?.snapshot}
          diff={diff}
          semanaRef={semanaRef}
          programador={programador}
          encarregado={encarregado}
          versao={versao}
          emitidoEm={emitidoEm}
        />
      </div>
    </div>
  );
};

export default DocumentoCard;
