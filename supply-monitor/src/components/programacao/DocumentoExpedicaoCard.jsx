import { useRef, useState } from 'react';
import { FileDown, Loader2, AlertCircle } from 'lucide-react';
import InfoButton from '../InfoButton';
import ExpedicaoDocument from './ExpedicaoDocument';
import { gerarPdfProgramacao, PDF_CONTENT_WIDTH_PX } from '../../utils/programacao/pdfProgramacao';
import { formatarBr, rotuloSemana, hojeIso } from '../../utils/programacao/semana';

// Diferente do documento da programação, este não sai de uma versão
// publicada: ele é uma fotografia do estado de agora. A Expedição não
// negocia grade com ninguém — ela precisa saber o que está parado hoje,
// então o que vale é o WMS do momento da emissão, com a data impressa.
const DocumentoExpedicaoCard = ({ filas, projecao, semanaRef, programador, encarregado, setEncarregado, versao }) => {
  const ref = useRef(null);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState('');
  const emitidoEm = formatarBr(hojeIso());

  const gerar = async () => {
    setGerando(true);
    setErro('');
    try {
      await new Promise(r => setTimeout(r, 600));
      // Mesmo sufixo do documento da separação: os dois saem juntos e
      // precisam poder ser reconhecidos como o par de uma mesma versão.
      const sufixo = versao ? `_${versao.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '')}` : '';
      await gerarPdfProgramacao(ref.current, {
        filename: `Programacao_Expedicao_${semanaRef}${sufixo}.pdf`,
        rodape: `DepFMRJ — Programação da Expedição — ${rotuloSemana(semanaRef)}${versao ? ` — ${versao}` : ''} — emitido em ${emitidoEm}`
      });
    } catch (e) {
      console.error(e);
      setErro('Não foi possível gerar o PDF. Tente novamente.');
    } finally {
      setGerando(false);
    }
  };

  const { resumo } = filas;

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 space-y-4">
      <div className="flex items-center gap-2">
        <FileDown className="text-indigo-500" size={20} />
        <h3 className="text-lg font-black text-slate-800">Documento da Expedição</h3>
        {versao && <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">{versao}</span>}
        <InfoButton
          title="O que sai no PDF"
          description="O roteiro de entrega da semana por dia de rota, a prontificação de STC por janela do CDAM, as pendências de retirada que já passaram do prazo e os CAMs ainda sem rota cadastrada — mais o Anexo A, com a relação das RMs por CAM. É uma fotografia do WMS no momento da emissão, com a data impressa no rodapé."
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Programador do DepFMRJ</label>
          <div className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-700">{programador || '—'}</div>
        </div>
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Encarregado do Abastecimento</label>
          <input value={encarregado} onChange={e => setEncarregado(e.target.value)} placeholder="Posto e nome" className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold outline-none focus:border-indigo-500" />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-[11px] text-slate-400 font-medium">
          {projecao?.temPlano
            ? `${projecao.resumo.total} RM(s) na agenda da semana — ${projecao.resumo.atrasadas} já conferidas e ${projecao.resumo.doPlano} vindas da separação`
            : `${resumo.aProntificar + resumo.gtcAEntregar} RM(s) de trabalho da Expedição · semana ainda não publicada`}
          {' '}· emitido em {emitidoEm}
        </p>
        <button
          onClick={gerar}
          disabled={gerando}
          className="px-5 py-2 rounded-xl bg-indigo-600 text-white font-bold text-sm shadow-sm flex items-center gap-2 hover:bg-indigo-700 disabled:opacity-40 transition-all active:scale-95"
        >
          {gerando ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}
          {gerando ? 'Gerando PDF...' : 'Baixar documento'}
        </button>
      </div>

      {!projecao?.temPlano && (
        <p className="text-[11px] text-amber-700 font-bold bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
          A semana ainda não foi publicada. Publique a programação da separação e os dois documentos passam a sair como
          um par, da mesma versão.
        </p>
      )}

      {erro && <p className="flex items-center gap-2 text-red-600 text-xs font-bold"><AlertCircle size={14} /> {erro}</p>}

      {/* Fora da tela, fixado na largura útil da página A4 — ver pdfReport.js. */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: PDF_CONTENT_WIDTH_PX, opacity: 0, zIndex: -1, pointerEvents: 'none' }} aria-hidden="true">
        <ExpedicaoDocument
          ref={ref}
          filas={filas}
          projecao={projecao}
          semanaRef={semanaRef}
          programador={programador}
          encarregado={encarregado}
          emitidoEm={emitidoEm}
          versao={versao}
        />
      </div>
    </div>
  );
};

export default DocumentoExpedicaoCard;
