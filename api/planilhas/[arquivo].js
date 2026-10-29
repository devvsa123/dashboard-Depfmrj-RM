// Entrega ao dashboard as planilhas que os robôs publicam no repositório
// PRIVADO de armazenamento no GitHub (depfmrj-RPA-storage).
//
// O token do GitHub fica só aqui no servidor (variáveis GITHUB_STORAGE_REPO e
// GITHUB_STORAGE_TOKEN na Vercel, SEM o prefixo VITE_): o navegador nunca o vê.
// Só os dois arquivos abaixo podem ser pedidos.
//
//   /api/planilhas/wms     -> planilha_estoque.xls (WMS)
//   /api/planilhas/singra  -> planilha_rms_unificada.csv (Singra)
//
// HEAD devolve só a hora do último envio do robô (Last-Modified), sem baixar a
// planilha: é o que o dashboard usa para saber se o cache local ainda vale.
// GET repassa o arquivo em streaming (sem o limite de 4,5 MB de resposta).

const ARQUIVOS = {
  wms: { nome: 'planilha_estoque.xls', tipo: 'application/vnd.ms-excel' },
  singra: { nome: 'planilha_rms_unificada.csv', tipo: 'text/csv; charset=utf-8' }
};

const configuracao = () => ({
  repo: process.env.GITHUB_STORAGE_REPO,
  token: process.env.GITHUB_STORAGE_TOKEN,
  branch: process.env.GITHUB_STORAGE_BRANCH || 'main',
  api: process.env.GITHUB_API_URL || 'https://api.github.com'
});

const doGithub = (caminho) => {
  const { repo, token, branch, api } = configuracao();
  return fetch(`${api}/repos/${repo}/contents/${encodeURIComponent(caminho)}?ref=${encodeURIComponent(branch)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.raw', // conteúdo direto (arquivos de até 100 MB)
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'dashboard-depfmrj-rm'
    }
  });
};

// atualizado.json é gravado pelo robô junto com as planilhas
const horaDoEnvio = async (nome) => {
  try {
    const r = await doGithub('atualizado.json');
    if (!r.ok) return null;
    const iso = (await r.json())?.[nome]?.atualizadoEm;
    return iso ? new Date(iso).toUTCString() : null;
  } catch {
    return null;
  }
};

const responder = async (request, soCabecalho) => {
  const chave = decodeURIComponent(new URL(request.url).pathname.split('/').pop() || '');
  const arquivo = ARQUIVOS[chave];
  if (!arquivo) return new Response('Planilha desconhecida.', { status: 404 });

  const { repo, token } = configuracao();
  if (!repo || !token) {
    return new Response('Cadastre GITHUB_STORAGE_REPO e GITHUB_STORAGE_TOKEN nas variáveis de ambiente da Vercel.', { status: 500 });
  }

  const modificado = await horaDoEnvio(arquivo.nome);
  const cabecalhos = {
    'Content-Type': arquivo.tipo,
    'Cache-Control': 'no-store',
    ...(modificado ? { 'Last-Modified': modificado } : {})
  };
  if (soCabecalho) return new Response(null, { status: 200, headers: cabecalhos });

  const r = await doGithub(arquivo.nome);
  if (!r.ok) {
    return new Response(`O GitHub respondeu ${r.status} para ${arquivo.nome}.`, { status: r.status === 404 ? 404 : 502 });
  }
  return new Response(r.body, { status: 200, headers: cabecalhos });
};

export function GET(request) {
  return responder(request, false);
}

export function HEAD(request) {
  return responder(request, true);
}
