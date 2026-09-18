import { useMemo, useState } from 'react';
import { FileDown, Loader2, AlertCircle } from 'lucide-react';
import InfoButton from './InfoButton';
import { generateMonthlyReportPdf } from '../utils/pdfReport';
import ReportDocument from './report/ReportDocument';

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

const monthLabelOf = (monthKey) => capitalize(new Date(`${monthKey}-01T00:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }));

const monthBoundsOf = (monthKey) => {
  const [y, m] = monthKey.split('-').map(Number);
  const start = `${monthKey}-01`;
  const end = new Date(y, m, 0).toISOString().split('T')[0];
  return { start, end };
};

const formatBr = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('pt-BR');

// Botão para gerar o PDF (A4) do mês escolhido, pronto para arquivar como
// anexo de ata. Aplica o período daquele mês (reaproveitando o mesmo
// mecanismo do seletor de período) e garante uma comparação com o período
// anterior, para que os dados corretos cheguem ao <ReportDocument>. O que é
// de fato capturado em PDF não é a tela do dashboard, e sim o documento
// estático renderizado fora da tela por <ReportDocument> — ver o motivo no
// comentário daquele componente.
const MonthlyReportCard = ({ chartData, applyCustomRange, comparisonMode, setComparisonMode, reportRef, reportProps }) => {
  const availableMonths = useMemo(() => {
    const months = new Set(chartData.map(d => d.date.substring(0, 7)));
    return Array.from(months).sort().reverse();
  }, [chartData]);

  const [selectedMonth, setSelectedMonth] = useState(availableMonths[0] || '');
  const [isGenerating, setIsGenerating] = useState(false);
  const [exportError, setExportError] = useState('');

  if (availableMonths.length === 0) return null;

  const monthLabel = monthLabelOf(selectedMonth);
  const { start, end } = selectedMonth ? monthBoundsOf(selectedMonth) : {};
  const periodLabel = start ? `${formatBr(start)} a ${formatBr(end)}` : '';

  let comparisonLabel = null;
  if (comparisonMode !== 'none' && reportProps.periodComparison?.referenceDates) {
    const { startDate, endDate } = reportProps.periodComparison.referenceDates;
    const suffix = comparisonMode === 'yearOverYear' ? 'mesmo período, ano anterior' : 'período imediatamente anterior';
    comparisonLabel = `${formatBr(startDate)} a ${formatBr(endDate)} (${suffix})`;
  }

  const handleGenerateReport = async () => {
    if (!selectedMonth) return;
    setIsGenerating(true);
    setExportError('');
    try {
      const { start, end } = monthBoundsOf(selectedMonth);
      applyCustomRange(start, end);
      if (comparisonMode === 'none') setComparisonMode('previous');

      // Aguarda o React recalcular todos os indicadores para o novo período
      // antes de capturar o documento — o <ReportDocument> desabilita as
      // animações dos gráficos, então não é preciso esperar por elas.
      await new Promise(resolve => setTimeout(resolve, 2500));

      await generateMonthlyReportPdf(reportRef.current, {
        filename: `Relatorio_Indicadores_${selectedMonth}.pdf`
      });
    } catch (err) {
      console.error(err);
      setExportError('Não foi possível gerar o PDF. Tente novamente.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div className="flex items-center gap-2">
        <FileDown className="text-indigo-500 shrink-0" size={20} />
        <div>
          <p className="text-sm font-black text-slate-800">Relatório Mensal (PDF)</p>
          <p className="text-xs text-slate-500 font-medium">Gera um documento A4 com os indicadores do mês escolhido, comparado ao período anterior — pronto para anexar à ata.</p>
        </div>
        <InfoButton
          title="Relatório Mensal"
          description="Gera um documento formal (não uma captura da tela): título, seções numeradas, tabelas e gráficos estáticos com os indicadores do mês escolhido."
        />
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <select
          value={selectedMonth}
          onChange={e => setSelectedMonth(e.target.value)}
          disabled={isGenerating}
          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-indigo-500 disabled:opacity-50"
        >
          {availableMonths.map(m => <option key={m} value={m}>{monthLabelOf(m)}</option>)}
        </select>
        <button
          onClick={handleGenerateReport}
          disabled={isGenerating}
          className="px-5 py-2 rounded-xl font-bold bg-indigo-600 text-white shadow-sm flex items-center gap-2 hover:bg-indigo-700 transition-all text-sm disabled:opacity-60 active:scale-95"
        >
          {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}
          {isGenerating ? 'Gerando PDF...' : 'Baixar Relatório'}
        </button>
      </div>
      {exportError && (
        <div className="flex items-center gap-2 text-red-600 text-xs font-bold w-full">
          <AlertCircle size={14} /> {exportError}
        </div>
      )}

      {/* Documento estático usado apenas para gerar o PDF — nunca aparece na
          tela, sempre reflete o mês escolhido acima. Fica na origem (0,0),
          em vez de jogá-lo para fora da tela com uma margem negativa enorme
          (isso já causou o html2canvas calcular posições erradas ao
          capturá-lo). Escondido via opacity+z-index, e não via
          width:0/overflow:hidden — um ancestral de tamanho zero estava
          fazendo o html2canvas capturar a largura errada (cortando as
          últimas colunas das tabelas no PDF). */}
      <div style={{ position: 'absolute', top: 0, left: 0, opacity: 0, zIndex: -1, pointerEvents: 'none' }} aria-hidden="true">
        <ReportDocument ref={reportRef} monthLabel={monthLabel} periodLabel={periodLabel} comparisonLabel={comparisonLabel} {...reportProps} />
      </div>
    </div>
  );
};

export default MonthlyReportCard;
