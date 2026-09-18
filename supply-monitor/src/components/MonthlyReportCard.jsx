import { useMemo, useState } from 'react';
import { FileDown, Loader2, AlertCircle } from 'lucide-react';
import InfoButton from './InfoButton';
import { generateMonthlyReportPdf } from '../utils/pdfReport';

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
// anexo de ata: aplica o período daquele mês (reaproveitando o mesmo
// mecanismo do seletor de período), garante uma comparação com o período
// anterior, espera o dashboard recalcular e os gráficos assentarem, e
// então captura o conteúdo já renderizado em um PDF.
const MonthlyReportCard = ({ chartData, applyCustomRange, comparisonMode, setComparisonMode, reportRef }) => {
  const availableMonths = useMemo(() => {
    const months = new Set(chartData.map(d => d.date.substring(0, 7)));
    return Array.from(months).sort().reverse();
  }, [chartData]);

  const [selectedMonth, setSelectedMonth] = useState(availableMonths[0] || '');
  const [isGenerating, setIsGenerating] = useState(false);
  const [exportError, setExportError] = useState('');

  if (availableMonths.length === 0) return null;

  const handleGenerateReport = async () => {
    if (!selectedMonth) return;
    setIsGenerating(true);
    setExportError('');
    try {
      const { start, end } = monthBoundsOf(selectedMonth);
      applyCustomRange(start, end);
      if (comparisonMode === 'none') setComparisonMode('previous');

      // Aguarda o React recalcular todos os indicadores para o novo período
      // e as animações dos gráficos (Recharts) terminarem antes de capturar
      // a tela — senão o PDF pode sair com gráficos pela metade.
      await new Promise(resolve => setTimeout(resolve, 1800));

      const monthLabel = monthLabelOf(selectedMonth);
      const comparisonSuffix = comparisonMode === 'yearOverYear' ? ' (mesmo período, ano anterior)' : ' (período imediatamente anterior)';
      await generateMonthlyReportPdf(reportRef.current, {
        filename: `Relatorio_Indicadores_${selectedMonth}.pdf`,
        title: `Relatório de Indicadores — ${monthLabel}`,
        periodLabel: `${formatBr(start)} a ${formatBr(end)}`,
        comparisonLabel: comparisonMode === 'none' ? null : `Período de referência${comparisonSuffix}`
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
          description="Ao gerar, o dashboard muda para o mês escolhido (você verá a tela atualizar) e então baixa um PDF com tudo o que está sendo exibido na aba Indicadores naquele momento, formatado para A4."
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
    </div>
  );
};

export default MonthlyReportCard;
