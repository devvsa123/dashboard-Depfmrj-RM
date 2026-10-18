import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const B='/tmp/claude-0/-home-user-dashboard-RM/cb697cce-6a7a-5768-b881-b44ba89f3a46/scratchpad/manual';
const arquivo = process.argv[2], saida = process.argv[3], rodape = process.argv[4];
const run = async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage();
  await p.goto(`file://${B}/${arquivo}`, { waitUntil: 'networkidle' });
  await p.pdf({
    path: `${B}/${saida}`, format: 'A4', printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate: `<div style="width:100%;font-size:8pt;color:#94a3b8;font-family:Helvetica,Arial,sans-serif;padding:0 16mm;display:flex;justify-content:space-between">
      <span>${rodape}</span><span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span></div>`,
    margin: { top: '18mm', bottom: '20mm', left: '16mm', right: '16mm' }
  });
  await b.close();
  console.log('gerado:', saida);
};
run().catch(e => { console.error('FALHOU', e.message); process.exit(1); });
