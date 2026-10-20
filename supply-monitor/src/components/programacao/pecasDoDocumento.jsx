// -----------------------------------------------------------------------
// Peças comuns dos documentos impressos da programação. Ficam separadas
// porque o documento da semana e o da Expedição são irmãos: mesma
// geometria de página, mesma tabela em flexbox, mesma área de assinatura.
//
// Tabelas em flexbox, e não <table>: o html2canvas respeita mal a largura
// de coluna de tabelas HTML e corta a última coluna na borda da página.
// As larguras precisam somar exatamente 100%, porque cada coluna é
// `flex: 0 0 X%`.
// -----------------------------------------------------------------------

// Por padrão a seção é indivisível: o html2pdf empurra inteira a que
// ficaria partida ao meio. A grade por CAM é a exceção — ela cresce com o
// número de clientes e, se for indivisível, uma semana com muitos CAMs
// empurra a tabela toda para a página seguinte e deixa a primeira quase
// em branco. Nela a quebra acontece entre linhas.
export const Secao = ({ children, quebravel }) => (
  <div style={{ breakInside: quebravel ? 'auto' : 'avoid', paddingTop: 5, marginBottom: 15 }}>{children}</div>
);

// O número vai no próprio texto do título, e não numa caixinha colorida.
// No navegador qualquer centralização funciona, mas o html2canvas — que
// desenha a página para virar PDF — posiciona o texto pela linha de base e
// ignora line-height, text-align vertical e alinhamento de flex, deixando
// o número encostado no canto da caixa. Sem caixa, não há o que
// desalinhar.
export const Titulo = ({ numero, texto }) => (
  <div style={{ marginBottom: 9, breakAfter: 'avoid' }}>
    <h2 className="text-sm font-black uppercase tracking-wide" style={{ color: '#0f172a' }}>
      <span style={{ color: '#1e3a8a' }}>{numero}.</span> {texto}
    </h2>
    <div className="h-px bg-slate-300" style={{ marginTop: 5 }} />
  </div>
);

const estiloCol = (col) => ({
  flex: `0 0 ${col.width}`,
  minWidth: 0,
  textAlign: col.align || 'left',
  wordBreak: 'break-word'
});

// O `titulo` entra DENTRO do bloco indivisível do cabeçalho, e não como
// um parágrafo solto antes da tabela. Solto, o html2canvas o deixa
// sozinho no pé da página com a tabela inteira na seguinte — breakAfter
// não basta aqui, só a vizinhança indivisível resolve.
export const Tabela = ({ colunas, linhas, rodape, quebravel, titulo }) => (
  <div style={{ breakInside: quebravel ? 'auto' : 'avoid', paddingBottom: 4 }}>
    <div style={{ breakInside: 'avoid', breakAfter: 'avoid' }}>
      {titulo && (
        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wide" style={{ marginBottom: 3 }}>{titulo}</p>
      )}
      <div style={{ display: 'flex', borderBottom: '1.5px solid #334155', padding: '5px 8px' }}>
        {colunas.map(c => (
          <div key={c.key} style={estiloCol(c)} className="text-slate-700 font-bold uppercase text-[9px] tracking-wide">{c.label}</div>
        ))}
      </div>
    </div>
    {linhas.map((linha, i) => (
      <div key={i} style={{ display: 'flex', backgroundColor: i % 2 === 1 ? '#f8fafc' : 'transparent', borderBottom: '1px solid #e2e8f0', padding: '4px 8px', breakInside: 'avoid' }}>
        {colunas.map(c => (
          <div key={c.key} style={estiloCol(c)} className={`text-[10px] ${c.emphasis ? 'font-bold text-slate-800' : 'text-slate-600'}`}>{linha[c.key]}</div>
        ))}
      </div>
    ))}
    {rodape && (
      <div style={{ display: 'flex', background: '#e2e8f0', padding: '5px 8px', borderTop: '1.5px solid #334155', breakInside: 'avoid' }}>
        {colunas.map(c => (
          <div key={c.key} style={estiloCol(c)} className="text-[10px] font-black text-slate-900">{rodape[c.key]}</div>
        ))}
      </div>
    )}
  </div>
);

// Relação de RMs em grade de colunas.
//
// Em texto corrido, separado por vírgula, oito dígitos seguidos de outros
// oito viram um borrão: quem confere na doca perde a linha e tem de
// recomeçar. Em coluna de largura fixa o olho desce em vez de varrer, e
// a nota de cada RM (dias de espera, documento) fica à direita dela sem
// encostar na seguinte.
export const GradeDeRms = ({ itens, colunas = 5 }) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', marginTop: 2 }}>
    {itens.map((it, i) => (
      <div
        key={`${it.rm}-${i}`}
        style={{
          flex: `0 0 ${(100 / colunas).toFixed(4)}%`,
          minWidth: 0,
          padding: '2px 8px 2px 0',
          borderBottom: '1px solid #f1f5f9',
          breakInside: 'avoid'
        }}
      >
        <span className="text-[9px] font-bold text-slate-700">{it.rm}</span>
        {it.nota && <span className="text-[8px] text-slate-400">  {it.nota}</span>}
      </div>
    ))}
  </div>
);

// Área de assinatura. Nada de linha para assinar à mão: o DepFMRJ assina
// com token no próprio PDF, então o que o documento precisa oferecer é um
// retângulo limpo onde o carimbo digital cabe, com a identificação logo
// abaixo.
export const Assinaturas = ({ programador, encarregado }) => (
  <div style={{ breakInside: 'avoid', marginTop: 18 }}>
    <div style={{ display: 'flex', gap: 28 }}>
      {[
        { nome: programador, papel: 'Programador do DepFMRJ' },
        { nome: encarregado, papel: 'Encarregado do Abastecimento' }
      ].map(bloco => (
        <div key={bloco.papel} style={{ flex: '1 1 0', minWidth: 0 }}>
          <div style={{ height: 54, border: '1px dashed #94a3b8', borderRadius: 4 }} />
          <p className="text-[10px] font-black text-slate-900 text-center uppercase" style={{ marginTop: 6 }}>{bloco.nome || '—'}</p>
          <p className="text-[9px] text-slate-500 text-center">{bloco.papel}</p>
        </div>
      ))}
    </div>
    <p className="text-[8px] text-slate-400 text-center" style={{ marginTop: 10 }}>
      Documento assinado digitalmente por certificado em token. O carimbo de assinatura deve ser aposto nas áreas acima.
    </p>
  </div>
);

