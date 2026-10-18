// Dados de exemplo para as telas do manual: parecidos com a realidade,
// sem nenhum pedido verdadeiro.
const HOJE = new Date('2026-10-16T12:00:00Z');
const br = (d) => `${String(d.getUTCDate()).padStart(2,'0')}/${String(d.getUTCMonth()+1).padStart(2,'0')}/${d.getUTCFullYear()} 10:00:00`;
const menos = (n) => { const x = new Date(HOJE); x.setUTCDate(x.getUTCDate()-n); return x; };
const CAMS = ['CDU - COM1ºDN','CDU BAMRJ','PDU - Com7ºDN','PDU - CeIMBe','PEU - Colégio Naval','PDU - BNRJ','PEU - EAMPE','PDU - CeIMMa'];
const ITENS = ['CALCA OPERATIVA AZUL-FERRETE M','GANDOLA OPERATIVA AZUL-FERRETE G','SAPATO PRETO COM CADARCO 42','CAMISETA BRANCA M/M G','BERMUDA CINZA 40','TENIS EDUCACAO FISICA 41'];

export const linhas = [];
// histórico expedido: dá a capacidade medida por dia da semana
for (let i = 0; i < 2600; i++) {
  const d = menos(1 + (i % 300));
  const dia = d.getUTCDay();
  const peso = [0,0.9,1.1,0.95,1.05,0.45,0,0][dia] || 0;
  if (Math.random() > peso) continue;
  linhas.push({ STATUS:'EXPEDIDO', PEDIDO:String(14000000+i), TIPO_RM:'RMT',
    STC: i%3 ? `GTC ${100+(i%60)}/2026` : `${200+(i%40)}/2026`,
    CAM: CAMS[i%CAMS.length], PI:'190012345', NOMENCLATURA: ITENS[i%ITENS.length],
    DATA_ENTRADA: br(menos(30+(i%60))), DATA_SEPARACAO: br(d) });
}
// fila em aberto
for (let i = 0; i < 520; i++) {
  linhas.push({ STATUS: i%9===0 ? 'RESERVADO' : 'PLANEJAMENTO', PEDIDO:String(15700000+i), TIPO_RM:'RMT', STC:'',
    CAM: CAMS[i%CAMS.length], PI:'190012345', NOMENCLATURA: ITENS[i%ITENS.length],
    DATA_ENTRADA: br(menos(8+(i%120))), DATA_SEPARACAO: br(menos(8+(i%120))) });
}
// algumas já conferidas e prontificadas, para a aba Andamento ter cor
for (let i = 0; i < 60; i++) {
  linhas.push({ STATUS:'CONFERIDO', PEDIDO:String(15800000+i), TIPO_RM:'RMT',
    STC: i%2 ? `GTC ${300+i}/2026` : '', CAM: CAMS[i%CAMS.length], PI:'190012345',
    NOMENCLATURA: ITENS[i%ITENS.length], DATA_ENTRADA: br(menos(25+i)), DATA_SEPARACAO: br(menos(2+(i%5))) });
}
export const RMS_MENSAGEM = Array.from({length:18},(_,i)=>String(15700000+i*7));
