// Gera o PDF A4 do relatório mensal a partir do <ReportDocument> já
// renderizado (fora da tela). Usa html2pdf.js (html2canvas + jsPDF por
// baixo dos panos), carregado sob demanda para não pesar no carregamento
// inicial do app. Numera as páginas no rodapé.
export const generateMonthlyReportPdf = async (element, { filename }) => {
  if (!element) throw new Error('Elemento do relatório não encontrado.');

  const html2pdf = (await import('html2pdf.js')).default;

  const worker = html2pdf().set({
    margin: 10,
    filename,
    image: { type: 'jpeg', quality: 0.95 },
    html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    // 'before' força uma quebra de página explícita antes de cada bloco
    // .pdf-section (ver ReportDocument.jsx) — um formato fixo e previsível,
    // em vez de depender só da heurística de 'legacy'/'css' pra decidir
    // onde cortar.
    pagebreak: { mode: ['css', 'legacy'], before: ['.pdf-section'] }
  }).from(element);

  await worker.toPdf().get('pdf').then((pdf) => {
    const totalPages = pdf.internal.getNumberOfPages();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setTextColor(148, 163, 184);
      pdf.text('Supply Monitor Integrado — Relatório de Indicadores', 10, pageHeight - 6);
      pdf.text(`Página ${i} de ${totalPages}`, pageWidth - 10, pageHeight - 6, { align: 'right' });
    }
  }).save();
};
