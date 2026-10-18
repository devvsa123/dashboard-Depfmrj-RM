import { useRef, useState } from 'react';
import { FileDown, Loader2, AlertCircle } from 'lucide-react';
import InfoButton from '../InfoButton';
import ProgramacaoDocument from './ProgramacaoDocument';
import { gerarPdfProgramacao, PDF_CONTENT_WIDTH_PX } from '../../utils/programacao/pdfProgramacao';
import { formatarBr, hojeIso, rotuloSemana } from '../../utils/programacao/semana';
import { PROGRAMADORES } from '../../utils/programacao/equipe';

const DocumentoCard = ({ resultado, semanaRef, demandas, bloqueios, programador, setProgramador, encarregado, setEncarregado }) => {
  const ref = useRef(null);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState('');

  const versao = 'Original';
  const emitidoEm = formatarBr(hojeIso());

  const gerar = async () => {
    setGerando(true);
    setErro('');
    try {
      // Dá um respiro para o documento fora da tela terminar de montar com
      // os dados atuais antes da captura.
      await new Promise(r => setTimeout(r, 600));
      await gerarPdfProgramacao(ref.current, {
        filename: `Programacao_Semanal_${semanaRef}.pdf`,
        rodape: `DepFMRJ — Programação Semanal — ${rotuloSemana(semanaRef)}`
      });
    } catch (e) {
      console.error(e);
      setErro('Não foi possível gerar o PDF. Tente novamente.');
    } finally {
      setGerando(false);
    }
  };

  const pronto = Boolean(resultado && resultado.resumo.totalProgramado > 0);

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 space-y-4">
      <div className="flex items-center gap-2">
        <FileDown className="text-indigo-500" size={20} />
        <h3 className="text-lg font-black text-slate-800">Documento da Programação</h3>
        <InfoButton
          title="O que sai no PDF"
          description="Um documento A4 com o resumo da semana, a grade de atendimento por CAM, os dias sem separação, as demandas com prazo e as observações — mais o Anexo A, que detalha por dia o que será atendido e por quê. A área de assinatura vem em branco, para receber o carimbo do certificado em token no próprio PDF."
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Programador do DepFMRJ</label>
          <select value={programador} onChange={e => setProgramador(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold outline-none focus:border-indigo-500 bg-white">
            <option value="">Selecione...</option>
            {PROGRAMADORES.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Encarregado do Abastecimento</label>
          <input value={encarregado} onChange={e => setEncarregado(e.target.value)} placeholder="Posto e nome" className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold outline-none focus:border-indigo-500" />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-[11px] text-slate-400 font-medium">
          {pronto ? `${resultado.resumo.totalProgramado} RMs · ${resultado.resumo.camsAtendidos} CAMs · ${versao}` : 'Nada programado para esta semana ainda.'}
        </p>
        <button
          onClick={gerar}
          disabled={!pronto || gerando}
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
          resultado={resultado}
          semanaRef={semanaRef}
          demandas={demandas}
          bloqueios={bloqueios}
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
