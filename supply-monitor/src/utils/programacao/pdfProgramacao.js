import { PDF_CONTENT_WIDTH_PX } from '../pdfReport';

// Gera o PDF A4 da programação semanal. Mesma geometria do relatório
// mensal (ver pdfReport.js) — inclusive a largura útil, que o documento
// fora da tela precisa respeitar — mudando só o rodapé.
const MARGIN_MM = [12, 12, 16, 12];

export { PDF_CONTENT_WIDTH_PX };

export const gerarPdfProgramacao = async (elemento, { filename, rodape }) => {
  if (!elemento) throw new Error('Documento da programação não encontrado.');

  const html2pdf = (await import('html2pdf.js')).default;

  const worker = html2pdf().set({
    margin: MARGIN_MM,
    filename,
    image: { type: 'jpeg', quality: 0.95 },
    html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak: { mode: ['css', 'legacy'] }
  }).from(elemento);

  await worker.toPdf().get('pdf').then((pdf) => {
    const totalPages = pdf.internal.getNumberOfPages();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setTextColor(148, 163, 184);
      pdf.text(rodape, 12, pageHeight - 7);
      pdf.text(`Página ${i} de ${totalPages}`, pageWidth - 12, pageHeight - 7, { align: 'right' });
    }
  }).save();
};
