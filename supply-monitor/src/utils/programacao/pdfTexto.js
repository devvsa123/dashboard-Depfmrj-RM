import { jsPDF } from 'jspdf';

// -----------------------------------------------------------------------
// Geração de PDF por TEXTO, e não por fotografia da tela.
//
// Por que mudou: os documentos nasceram em raster — o html2canvas desenha
// a página inteira num canvas só e o PDF recebe a imagem. Com os números
// reais da operação o documento da Expedição passa de 50.000 px de
// altura, e o Chrome não aloca canvas acima de 16.384 px por lado. A
// captura volta vazia (páginas em branco) ou estoura a memória e trava a
// aba. Não era ajuste de escala: era teto do navegador, e ele só ia ser
// batido com mais frequência conforme a base crescesse.
//
// Desenhando texto: o arquivo cai de dezenas de MB para centenas de KB,
// não há limite de altura, a geração é imediata e — o que mais importa
// num documento que lista milhares de RMs — o número fica selecionável e
// localizável pelo Ctrl+F de quem recebe.
//
// Em troca, perde-se o CSS. Daí este módulo: um motor de página mínimo
// com o vocabulário que os dois documentos usam — seção, parágrafo,
// tabela, grade de RMs, assinatura — cuidando sozinho da quebra de
// página e repetindo o cabeçalho das tabelas que atravessam páginas.
// -----------------------------------------------------------------------

const PAGINA = { largura: 210, altura: 297 };
const MARGEM = { esq: 12, dir: 12, topo: 12, base: 16 };
export const LARGURA_UTIL = PAGINA.largura - MARGEM.esq - MARGEM.dir;

// pt para mm, que é a unidade do documento.
const mm = (pt) => pt * 0.3528;

export const TINTA = [15, 23, 42];
export const SUAVE = [100, 116, 139];
export const CLARO = [148, 163, 184];
export const LINHA = [203, 213, 225];
export const TRACO = [51, 65, 85];
export const AZUL = [30, 58, 138];
export const ZEBRA = [248, 250, 252];
export const FUNDO_TOTAL = [226, 232, 240];
export const VERMELHO = [185, 28, 28];
export const AMBAR = [180, 83, 9];

export const criarDocumento = ({ rodape }) => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
  let y = MARGEM.topo;

  const fimDaPagina = () => PAGINA.altura - MARGEM.base;
  const sobra = () => fimDaPagina() - y;

  const novaPagina = () => { doc.addPage(); y = MARGEM.topo; };

  // Reserva espaço: se o que vem não cabe no resto da página, vira página.
  const reservar = (altura) => { if (y + altura > fimDaPagina()) novaPagina(); };

  const fonte = (tamanho, estilo = 'normal', cor = TINTA) => {
    doc.setFont('helvetica', estilo);
    doc.setFontSize(tamanho);
    doc.setTextColor(cor[0], cor[1], cor[2]);
  };

  // Escreve um bloco de texto, quebrando em linhas e em páginas.
  const texto = (conteudo, opcoes = {}) => {
    const { tamanho = 9, estilo = 'normal', cor = TINTA, x = MARGEM.esq,
            largura = LARGURA_UTIL, align = 'left', entrelinha = 1.35, espacoDepois = 0 } = opcoes;
    fonte(tamanho, estilo, cor);
    const linhas = doc.splitTextToSize(String(conteudo ?? ''), largura);
    const alturaLinha = mm(tamanho) * entrelinha;
    linhas.forEach(linha => {
      reservar(alturaLinha);
      fonte(tamanho, estilo, cor);
      const px = align === 'right' ? x + largura : align === 'center' ? x + largura / 2 : x;
      doc.text(linha, px, y, { align, baseline: 'top' });
      y += alturaLinha;
    });
    y += espacoDepois;
    return linhas.length;
  };

  const regua = (cor = LINHA, espessura = 0.2, espacoDepois = 2) => {
    reservar(espessura + espacoDepois);
    doc.setDrawColor(cor[0], cor[1], cor[2]);
    doc.setLineWidth(espessura);
    doc.line(MARGEM.esq, y, PAGINA.largura - MARGEM.dir, y);
    y += espessura + espacoDepois;
  };

  // Título de seção numerado. O número é parte do texto, não uma caixa.
  const secao = (numero, titulo) => {
    // Um título sozinho no pé da página não ajuda ninguém: só entra se
    // couber ele mais duas linhas do que vem a seguir.
    reservar(mm(11) * 1.2 + 10);
    texto(`${numero}. ${String(titulo).toUpperCase()}`, { tamanho: 11, estilo: 'bold', cor: AZUL, espacoDepois: 1.2 });
    regua(LINHA, 0.3, 3);
  };

  const paragrafo = (conteudo, opcoes = {}) =>
    texto(conteudo, { tamanho: 8.5, cor: SUAVE, entrelinha: 1.45, espacoDepois: 3, ...opcoes });

  // ── Tabelas ───────────────────────────────────────────────────────
  // colunas: [{ key, label, largura (fração de 0 a 1), align, forte }]
  const tabela = ({ colunas, linhas, rodape: rodapeLinha, tamanho = 8, espacoDepois = 4, titulo }) => {
    const larguras = colunas.map(c => c.largura * LARGURA_UTIL);
    const xs = [];
    let acumulado = MARGEM.esq;
    larguras.forEach(l => { xs.push(acumulado); acumulado += l; });
    const alturaLinhaTexto = mm(tamanho) * 1.25;
    const respiro = 1.1;

    const celulas = (linha) => colunas.map((c, i) => {
      fonte(tamanho, c.forte ? 'bold' : 'normal');
      return doc.splitTextToSize(String(linha[c.key] ?? ''), larguras[i] - 3);
    });

    const desenharCabecalho = () => {
      const altura = alturaLinhaTexto + respiro * 2;
      reservar(altura + alturaLinhaTexto);
      if (titulo) {
        fonte(7.5, 'bold', SUAVE);
        doc.text(String(titulo).toUpperCase(), MARGEM.esq, y, { baseline: 'top' });
        y += mm(7.5) * 1.6;
      }
      colunas.forEach((c, i) => {
        fonte(7, 'bold', TRACO);
        const px = c.align === 'right' ? xs[i] + larguras[i] - 1.5 : c.align === 'center' ? xs[i] + larguras[i] / 2 : xs[i] + 1.5;
        doc.text(String(c.label).toUpperCase(), px, y + respiro, { align: c.align || 'left', baseline: 'top' });
      });
      y += altura;
      doc.setDrawColor(TRACO[0], TRACO[1], TRACO[2]);
      doc.setLineWidth(0.4);
      doc.line(MARGEM.esq, y, PAGINA.largura - MARGEM.dir, y);
      y += 0.6;
    };

    const desenharLinha = (linha, indice, destaque) => {
      const partes = celulas(linha);
      const altura = Math.max(...partes.map(p => p.length)) * alturaLinhaTexto + respiro * 2;
      // A linha nunca é partida ao meio: se não cabe, o cabeçalho é
      // repetido na página seguinte — sem isso a tabela vira um monte de
      // números sem nome de coluna a partir da segunda página.
      if (y + altura > fimDaPagina()) { novaPagina(); desenharCabecalho(); }
      if (destaque) {
        doc.setFillColor(FUNDO_TOTAL[0], FUNDO_TOTAL[1], FUNDO_TOTAL[2]);
        doc.rect(MARGEM.esq, y, LARGURA_UTIL, altura, 'F');
      } else if (indice % 2 === 1) {
        doc.setFillColor(ZEBRA[0], ZEBRA[1], ZEBRA[2]);
        doc.rect(MARGEM.esq, y, LARGURA_UTIL, altura, 'F');
      }
      colunas.forEach((c, i) => {
        const cor = linha[`${c.key}_cor`] || (destaque || c.forte ? TINTA : SUAVE);
        fonte(tamanho, destaque || c.forte ? 'bold' : 'normal', cor);
        const px = c.align === 'right' ? xs[i] + larguras[i] - 1.5 : c.align === 'center' ? xs[i] + larguras[i] / 2 : xs[i] + 1.5;
        partes[i].forEach((parte, n) => {
          doc.text(parte, px, y + respiro + n * alturaLinhaTexto, { align: c.align || 'left', baseline: 'top' });
        });
      });
      y += altura;
      doc.setDrawColor(LINHA[0], LINHA[1], LINHA[2]);
      doc.setLineWidth(0.1);
      doc.line(MARGEM.esq, y, PAGINA.largura - MARGEM.dir, y);
    };

    desenharCabecalho();
    linhas.forEach((linha, i) => desenharLinha(linha, i, false));
    if (rodapeLinha) desenharLinha(rodapeLinha, linhas.length, true);
    y += espacoDepois;
  };

  // ── Grade de RMs ──────────────────────────────────────────────────
  // Em texto corrido, oito dígitos seguidos de outros oito viram um
  // borrão. Em coluna de largura fixa o olho desce em vez de varrer.
  const gradeDeRms = (itens, { colunas = 6, tamanho = 7.5, espacoDepois = 2 } = {}) => {
    const largura = LARGURA_UTIL / colunas;
    const alturaLinha = mm(tamanho) * 1.9;
    for (let i = 0; i < itens.length; i += colunas) {
      reservar(alturaLinha);
      const fatia = itens.slice(i, i + colunas);
      fatia.forEach((item, n) => {
        const x = MARGEM.esq + n * largura;
        fonte(tamanho, 'bold', TINTA);
        doc.text(String(item.rm), x, y + 0.6, { baseline: 'top' });
        if (item.nota) {
          const avanco = doc.getTextWidth(String(item.rm)) + 1.2;
          fonte(tamanho - 0.8, 'normal', CLARO);
          doc.text(String(item.nota), x + avanco, y + 0.8, { baseline: 'top' });
        }
      });
      doc.setDrawColor(241, 245, 249);
      doc.setLineWidth(0.1);
      doc.line(MARGEM.esq, y + alturaLinha - 0.8, PAGINA.largura - MARGEM.dir, y + alturaLinha - 0.8);
      y += alturaLinha;
    }
    y += espacoDepois;
  };

  // ── Cartões de número, em linha ───────────────────────────────────
  const numeros = (itens, { espacoDepois = 4 } = {}) => {
    const largura = (LARGURA_UTIL - (itens.length - 1) * 2) / itens.length;
    const altura = 14;
    reservar(altura + espacoDepois);
    itens.forEach((item, i) => {
      const x = MARGEM.esq + i * (largura + 2);
      doc.setDrawColor(LINHA[0], LINHA[1], LINHA[2]);
      doc.setLineWidth(0.2);
      doc.roundedRect(x, y, largura, altura, 1.2, 1.2, 'S');
      fonte(6.5, 'bold', SUAVE);
      doc.text(String(item.rotulo).toUpperCase(), x + largura / 2, y + 3, { align: 'center', baseline: 'top' });
      fonte(13, 'bold', item.cor || TINTA);
      doc.text(String(item.valor), x + largura / 2, y + 6.6, { align: 'center', baseline: 'top' });
    });
    y += altura + espacoDepois;
  };

  // ── Cabeçalho do documento ────────────────────────────────────────
  const cabecalho = ({ orgao, unidade, titulo, subtitulo, selo }) => {
    texto(orgao, { tamanho: 8, estilo: 'bold', cor: SUAVE, align: 'center', espacoDepois: 0.5 });
    texto(unidade, { tamanho: 9, estilo: 'bold', cor: TRACO, align: 'center', espacoDepois: 3 });
    texto(titulo, { tamanho: 13, estilo: 'bold', cor: TINTA, align: 'center', espacoDepois: 1 });
    texto(subtitulo, { tamanho: 9.5, estilo: 'bold', cor: SUAVE, align: 'center', espacoDepois: 2.5 });
    if (selo) {
      fonte(7.5, 'bold', AZUL);
      const larguraSelo = doc.getTextWidth(selo.toUpperCase()) + 8;
      const x = MARGEM.esq + (LARGURA_UTIL - larguraSelo) / 2;
      doc.setDrawColor(AZUL[0], AZUL[1], AZUL[2]);
      doc.setLineWidth(0.3);
      doc.roundedRect(x, y, larguraSelo, 6, 1, 1, 'S');
      doc.text(selo.toUpperCase(), MARGEM.esq + LARGURA_UTIL / 2, y + 1.8, { align: 'center', baseline: 'top' });
      y += 9;
    }
    doc.setDrawColor(TRACO[0], TRACO[1], TRACO[2]);
    doc.setLineWidth(0.6);
    doc.line(MARGEM.esq, y, PAGINA.largura - MARGEM.dir, y);
    y += 5;
  };

  const tituloDeAnexo = ({ titulo, subtitulo }) => {
    novaPagina();
    texto(titulo, { tamanho: 13, estilo: 'bold', cor: TINTA, align: 'center', espacoDepois: 1 });
    texto(subtitulo, { tamanho: 8, cor: SUAVE, align: 'center', espacoDepois: 3 });
    doc.setDrawColor(TRACO[0], TRACO[1], TRACO[2]);
    doc.setLineWidth(0.6);
    doc.line(MARGEM.esq, y, PAGINA.largura - MARGEM.dir, y);
    y += 5;
  };

  // ── Assinaturas ───────────────────────────────────────────────────
  // Nada de linha para assinar à mão: o DepFMRJ assina com token no
  // próprio PDF, então o que o documento oferece é um retângulo limpo
  // onde o carimbo digital cabe.
  const assinaturas = (blocos) => {
    const altura = 18;
    const larguraBloco = (LARGURA_UTIL - 10) / blocos.length;
    reservar(altura + 16);
    y += 4;
    const topo = y;
    blocos.forEach((bloco, i) => {
      const x = MARGEM.esq + i * (larguraBloco + 10);
      doc.setDrawColor(148, 163, 184);
      doc.setLineWidth(0.2);
      doc.setLineDashPattern([1, 1], 0);
      doc.roundedRect(x, topo, larguraBloco, altura, 1, 1, 'S');
      doc.setLineDashPattern([], 0);
      fonte(8, 'bold', TINTA);
      doc.text(String(bloco.nome || '—').toUpperCase(), x + larguraBloco / 2, topo + altura + 2, { align: 'center', baseline: 'top' });
      fonte(7, 'normal', SUAVE);
      doc.text(bloco.papel, x + larguraBloco / 2, topo + altura + 6, { align: 'center', baseline: 'top' });
    });
    y = topo + altura + 11;
    texto('Documento assinado digitalmente por certificado em token. O carimbo de assinatura deve ser aposto nas áreas acima.',
      { tamanho: 6.5, cor: CLARO, align: 'center' });
  };

  // ── Rodapé, carimbado no fim em todas as páginas ──────────────────
  const salvar = (nomeDoArquivo) => {
    const total = doc.internal.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(CLARO[0], CLARO[1], CLARO[2]);
      doc.text(rodape, MARGEM.esq, PAGINA.altura - 7, { baseline: 'alphabetic' });
      doc.text(`Página ${i} de ${total}`, PAGINA.largura - MARGEM.dir, PAGINA.altura - 7, { align: 'right', baseline: 'alphabetic' });
    }
    doc.save(nomeDoArquivo);
  };

  return {
    doc,
    cabecalho, tituloDeAnexo, secao, paragrafo, texto, regua,
    tabela, gradeDeRms, numeros, assinaturas,
    novaPagina, reservar, salvar,
    get y() { return y; },
    set y(valor) { y = valor; },
    sobra
  };
};
