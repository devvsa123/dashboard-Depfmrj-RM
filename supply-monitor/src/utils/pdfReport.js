// Gera o PDF A4 do relatório mensal a partir do <ReportDocument> já
// renderizado (fora da tela). Usa html2pdf.js (html2canvas + jsPDF por
// baixo dos panos), carregado sob demanda para não pesar no carregamento
// inicial do app. Numera as páginas no rodapé.

// [topo, esquerda, baixo, direita] em mm. A margem de baixo é maior para o
// rodapé numerado (escrito depois, direto no PDF) não encostar no conteúdo.
const MARGIN_MM = [12, 12, 16, 12];
const A4_WIDTH_MM = 210;

// Largura útil da página, em px de CSS (96 dpi) — é exatamente a largura
// do container que o html2pdf cria para capturar o documento. O elemento
// fora da tela precisa ser renderizado NESSA largura: os gráficos do
// recharts viram SVG com largura fixa em pixels no momento em que são
// desenhados, então se a largura viva for diferente da largura do
// container da captura, o gráfico sai cortado na borda direita do PDF.
export const PDF_CONTENT_WIDTH_PX = Math.round((A4_WIDTH_MM - MARGIN_MM[1] - MARGIN_MM[3]) / 25.4 * 96);

export const generateMonthlyReportPdf = async (element, { filename }) => {
  if (!element) throw new Error('Elemento do relatório não encontrado.');

  const html2pdf = (await import('html2pdf.js')).default;

  const worker = html2pdf().set({
    margin: MARGIN_MM,
    filename,
    image: { type: 'jpeg', quality: 0.95 },
    html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    // Sem quebra forçada por seção: cada seção do relatório é marcada com
    // break-inside: avoid (ver ReportDocument.jsx), e o modo 'css' empurra
    // para a página seguinte apenas a seção que ficaria partida ao meio.
    // Assim as seções se acomodam e enchem a folha, em vez de uma seção
    // por página deixando metade do espaço em branco.
    pagebreak: { mode: ['css', 'legacy'] }
  }).from(element);

  await worker.toPdf().get('pdf').then((pdf) => {
    const totalPages = pdf.internal.getNumberOfPages();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setTextColor(148, 163, 184);
      pdf.text('Supply Monitor Integrado — Relatório de Indicadores', 12, pageHeight - 7);
      pdf.text(`Página ${i} de ${totalPages}`, pageWidth - 12, pageHeight - 7, { align: 'right' });
    }
  }).save();
};
