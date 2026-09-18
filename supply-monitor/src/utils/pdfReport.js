// Gera o PDF A4 do relatório mensal a partir de um elemento já renderizado
// na tela. Usa html2pdf.js (html2canvas + jsPDF por baixo dos panos),
// carregado sob demanda para não pesar no carregamento inicial do app.
// Insere um cabeçalho temporário só para o export (título, período,
// comparação, data de geração) e um rodapé com numeração de página em
// todas as páginas — para servir como anexo de ata, o documento precisa
// se explicar sozinho fora do contexto do dashboard.
export const generateMonthlyReportPdf = async (element, { filename, title, periodLabel, comparisonLabel }) => {
  if (!element) throw new Error('Elemento do relatório não encontrado.');

  const html2pdf = (await import('html2pdf.js')).default;

  const generatedAtLabel = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

  const header = document.createElement('div');
  header.style.cssText = 'padding: 4px 4px 16px; border-bottom: 2px solid #e2e8f0; margin-bottom: 20px;';
  header.innerHTML = `
    <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
      <div style="width:10px;height:10px;border-radius:9999px;background:#4f46e5;"></div>
      <h1 style="font-size:20px; font-weight:900; color:#1e293b; margin:0;">${title}</h1>
    </div>
    <p style="font-size:12px; color:#475569; margin:2px 0; font-weight:700;">Período do relatório: ${periodLabel}</p>
    ${comparisonLabel ? `<p style="font-size:12px; color:#475569; margin:2px 0; font-weight:700;">Comparado com: ${comparisonLabel}</p>` : ''}
    <p style="font-size:11px; color:#94a3b8; margin:6px 0 0;">Gerado em ${generatedAtLabel} · Supply Monitor Integrado</p>
  `;
  element.insertBefore(header, element.firstChild);

  try {
    const worker = html2pdf().set({
      margin: 10,
      filename,
      image: { type: 'jpeg', quality: 0.92 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: '#f8fafc' },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
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
        pdf.text('Supply Monitor Integrado — Relatório de Indicadores', 10, pageHeight - 6);
        pdf.text(`Página ${i} de ${totalPages}`, pageWidth - 10, pageHeight - 6, { align: 'right' });
      }
    }).save();
  } finally {
    element.removeChild(header);
  }
};
