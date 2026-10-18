import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { linhas, RMS_MENSAGEM } from './dados.mjs';
const IMG = '/tmp/claude-0/-home-user-dashboard-RM/cb697cce-6a7a-5768-b881-b44ba89f3a46/scratchpad/manual/img';
const banco = { demandas: [], bloqueios: [], capacidade_overrides: [], config: [], programacoes: [], saude: [] };

const run = async () => {
  const b = await chromium.launch({ headless: true });
  const ctx = await b.newContext({ viewport:{width:1440,height:1000}, deviceScaleFactor:2, acceptDownloads:true });
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log('PAGEERROR:', e.message));
  await p.route('**/*', route => {
    const req = route.request(); const u = req.url();
    if (u.startsWith('http://localhost:5183')) return route.continue();
    if (u.includes('supabase.co')) {
      if (u.includes('/auth/v1/token')) return route.fulfill({ status:200, contentType:'application/json', body: JSON.stringify({
        access_token:'t', token_type:'bearer', expires_in:3600, expires_at:Math.floor(Date.now()/1000)+3600, refresh_token:'r',
        user:{ id:'u-1', aud:'authenticated', role:'authenticated', email:'pinheiro@marinha.mil.br', user_metadata:{nome:'SG Pinheiro'}, app_metadata:{}, created_at:new Date().toISOString() }})});
      if (u.includes('/auth/v1/user')) return route.fulfill({ status:200, contentType:'application/json', body: JSON.stringify({ id:'u-1', aud:'authenticated', role:'authenticated', email:'pinheiro@marinha.mil.br', user_metadata:{nome:'SG Pinheiro'}, app_metadata:{}, created_at:new Date().toISOString() })});
      const tabela = (u.match(/\/rest\/v1\/(\w+)/)||[])[1];
      if (tabela && req.method()==='GET') {
        let d = banco[tabela] || [];
        const m = u.match(/semana=eq\.([\d-]+)/);
        if (m && tabela==='programacoes') d = d.filter(x => x.semana === m[1]);
        return route.fulfill({ status:200, contentType:'application/json', body: JSON.stringify(d) });
      }
      if (tabela && req.method()==='POST') { const c=JSON.parse(req.postData()||'[]'); (Array.isArray(c)?c:[c]).forEach(x=>banco[tabela].push(x)); return route.fulfill({status:201,contentType:'application/json',body:'[]'}); }
      return route.fulfill({ status:200, contentType:'application/json', body:'[]' });
    }
    if (u.includes('planilha_estoque')) return route.fulfill({ status:200, headers:{'last-modified':'Fri, 16 Oct 2026 17:00:00 GMT'}, body:'x' });
    if (u.includes('planilha_rms_unificada')) return route.fulfill({ status:200, headers:{'last-modified':'Fri, 16 Oct 2026 17:00:00 GMT'}, contentType:'text/csv', body:'RM;SITUACAO\n' });
    return route.abort();
  });
  await p.addInitScript((tr) => {
    window.__TEST_ROWS__ = tr;
    window.XLSX = { read:()=>({SheetNames:['S'],Sheets:{S:{}}}), utils:{ sheet_to_json:()=>window.__TEST_ROWS__, json_to_sheet:()=>({}), book_new:()=>({}), book_append_sheet:()=>{} }, writeFile:()=>{} };
    try { localStorage.clear(); } catch { /* */ }
  }, linhas);

  const tirar = async (nome, loc) => {
    const alvo = loc || p;
    await alvo.screenshot({ path: `${IMG}/${nome}.png` });
    console.log('  ✓', nome);
  };
  const card = (titulo) => p.locator(`h3:has-text("${titulo}")`).locator('xpath=ancestor::div[contains(@class,"rounded-3xl")][1]');

  await p.goto('http://localhost:5183/', { waitUntil:'domcontentloaded' });
  await p.waitForSelector('text=Programação', { timeout:60000 });
  await p.waitForTimeout(2500);

  console.log('capturando:');
  // 01 — abas do dashboard
  await tirar('01-abas', p.locator('div.flex.p-1.bg-white.rounded-2xl').first());

  await p.click('button:has-text("Programação")');
  await p.waitForTimeout(1200);
  // 02 — login
  await tirar('02-login', p.locator('form'));

  await p.fill('input[type="email"]','pinheiro@marinha.mil.br');
  await p.fill('input[type="password"]','••••••');
  await tirar('02b-login-preenchido', p.locator('form'));
  await p.click('button:has-text("Entrar")');
  await p.waitForSelector('text=Montar a semana', { timeout:30000 });
  await p.waitForTimeout(2500);

  // 03 — sub-abas e identificação
  await tirar('03-subabas', p.locator('div.flex.items-center.justify-between.gap-3.flex-wrap').first());
  // 04 — seletor de semana
  await tirar('04-semana', p.locator('text=Semana Programada').locator('xpath=ancestor::div[contains(@class,"rounded-3xl")][1]'));
  // 05 — resumo
  await tirar('05-resumo', p.locator('div.grid').filter({ hasText:'RMS NA SEMANA' }).first());
  // 06 — cartões dos dias
  await tirar('06-dias', p.locator('div.grid').filter({ hasText:'SEGUNDA' }).first());
  // 07 — tabela por CAM
  await tirar('07-cam', card('Atendimento por CAM'));

  // 08 — detalhe de um dia
  await p.locator('button:has-text("ver RMs")').first().click();
  await p.waitForTimeout(900);
  await tirar('08-detalhe-dia', p.locator('div.fixed.inset-0 > div').first());
  await p.locator('div.fixed.inset-0 button').last().click();
  await p.waitForTimeout(600);

  // Numa janela estreita a grade de dois painéis vira uma coluna, e cada
  // cartão passa a ter a altura do próprio conteúdo — sem o vazio que
  // aparece quando um cartão estica para acompanhar o vizinho.
  await p.setViewportSize({ width: 1100, height: 1000 });
  await p.waitForTimeout(800);

  // 09 — demandas vazio
  await tirar('09-demandas-vazio', card('Demandas com Prazo'));
  // 10 — demandas preenchido
  await p.fill('textarea', RMS_MENSAGEM.join('\n'));
  await p.fill('input[placeholder*="Msg CSUPAB"]','Msg CSUPAB R151612Z/OUT/2026');
  await p.locator('input[type="date"]').first().fill('2026-11-06');
  await p.waitForTimeout(500);
  await tirar('10-demanda-preenchida', card('Demandas com Prazo'));
  await p.click('button:has-text("Registrar demanda")');
  await p.waitForTimeout(1500);
  await tirar('11-demanda-registrada', card('Demandas com Prazo'));

  // 12 — capacidade
  await tirar('12-capacidade', card('Capacidade por Dia da Semana'));
  // 13 — dias sem separação
  await p.locator('input[type="date"]').nth(1).fill('2026-10-28');
  await p.fill('input[placeholder*="feriado"]','Feriado — Dia do Servidor Público');
  await p.click('button:has-text("Bloquear")');
  await p.waitForTimeout(1200);
  await tirar('13-bloqueio', card('Dias sem Separação'));

  // 14 — grade depois do bloqueio
  await tirar('14-dias-apos-bloqueio', p.locator('div.grid').filter({ hasText:'SEGUNDA' }).first());

  // 15 — versões antes de publicar
  await tirar('15-versoes-antes', card('Versões da Semana'));
  await p.fill('input[placeholder="Posto e nome"]','CC (IM) MARQUES');
  await p.waitForTimeout(400);
  await tirar('16-documento-antes', card('Documento da Programação'));

  await p.click('button:has-text("Publicar Original")');
  await p.waitForTimeout(2000);
  await tirar('17-versoes-depois', card('Versões da Semana'));
  await tirar('18-documento-depois', card('Documento da Programação'));

  // 19 — alteração pendente
  await p.fill('textarea','15700500\n15700501\n15700502\n15700503\n15700504\n15700505');
  await p.fill('input[placeholder*="Msg CSUPAB"]','Msg EMERGENCIAL — incorporação antecipada');
  await p.locator('input[type="date"]').first().fill('2026-11-03');
  await p.click('button:has-text("Registrar demanda")');
  await p.waitForTimeout(1800);
  await tirar('19-versoes-pendente', card('Versões da Semana'));

  // 20 — aba Andamento (volta à janela larga: tem tabela)
  await p.setViewportSize({ width: 1440, height: 1000 });
  await p.waitForTimeout(800);
  await p.click('button:has-text("Andamento")');
  await p.waitForSelector('text=Andamento da Semana', { timeout:20000 });
  await p.waitForTimeout(1500);
  await tirar('20-andamento-topo', p.locator('div.grid').filter({ hasText:'PROGRAMADAS' }).first());
  await tirar('21-andamento-estados', p.locator('text=Situação das RMs programadas').locator('xpath=ancestor::div[contains(@class,"rounded-3xl")][1]'));
  await tirar('22-andamento-cam', card('Cumprimento por CAM'));
  const ajuste = p.locator('text=Ajustar a programação ao que realmente aconteceu').locator('xpath=ancestor::div[contains(@class,"rounded-3xl")][1]');
  if (await ajuste.count()) await tirar('23-ajustar', ajuste);

  console.log('\nbanco simulado: versões publicadas =', banco.programacoes.length, '| demandas =', banco.demandas.length);
  await b.close();
};
run().catch(e => { console.error('FALHOU', e.message); process.exit(1); });
