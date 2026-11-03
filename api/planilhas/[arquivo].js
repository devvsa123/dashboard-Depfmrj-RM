// Entrega ao dashboard as planilhas que os robôs publicam no repositório
// PRIVADO de armazenamento no GitHub.
//
// O token do GitHub fica só aqui no servidor (variáveis de ambiente da Vercel,
// SEM o prefixo VITE_): o navegador nunca o vê. Só estes endereços existem:
//
//   /api/planilhas/wms     -> planilha_estoque.xls (WMS)
//   /api/planilhas/singra  -> planilha_rms_unificada.csv (Singra)
//   /api/planilhas/status  -> onde cada planilha foi achada e quando foi enviada (para conferir)
//
// A planilha pode estar na raiz do repositório ou numa das pastas de
// GITHUB_STORAGE_PASTAS (padrão: dados_wms e dados_singra).
//
// HEAD devolve só a hora do último envio (Last-Modified), sem baixar a planilha:
// é o que o dashboard usa para saber se o cache local ainda vale. GET repassa o
// arquivo em streaming (sem o limite de 4,5 MB de resposta).

const ARQUIVOS = {
  wms: { nome: 'planilha_estoque.xls', tipo: 'application/vnd.ms-excel' },
  singra: { nome: 'planilha_rms_unificada.csv', tipo: 'text/csv; charset=utf-8' }
};

// Aceita GITHUB_STORAGE_REPO ou GITHUB_OWNER + GITHUB_REPO (ou GITHUB_REPO com
// dono/repositório ou o endereço completo), e GITHUB_STORAGE_TOKEN ou GITHUB_TOKEN.
const configuracao = () => {
  const e = process.env;
  const bruto = e.GITHUB_STORAGE_REPO ||
    (e.GITHUB_REPO?.includes('/') ? e.GITHUB_REPO : (e.GITHUB_OWNER && e.GITHUB_REPO ? `${e.GITHUB_OWNER}/${e.GITHUB_REPO}` : ''));
  return {
    repo: bruto.trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/i, '').replace(/\/+$/, ''),
    token: (e.GITHUB_STORAGE_TOKEN || e.GITHUB_TOKEN || '').trim(),
    branch: e.GITHUB_STORAGE_BRANCH || e.GITHUB_BRANCH || 'main',
    api: e.GITHUB_API_URL || 'https://api.github.com',
    pastas: (e.GITHUB_STORAGE_PASTAS ?? 'dados_wms,dados_singra').split(',').map((p) => p.trim().replace(/^\/+|\/+$/g, '')).filter(Boolean)
  };
};

const githubApi = (rota, accept) => {
  const { repo, token, api } = configuracao();
  return fetch(`${api}/repos/${repo}${rota}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: accept,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'dashboard-depfmrj-rm'
    }
  });
};

const conteudo = (caminho, accept) =>
  githubApi(`/contents/${caminho.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(configuracao().branch)}`, accept);

// Procura na raiz e nas pastas; devolve a resposta do primeiro caminho que existir.
const acharNoGithub = async (nome, accept) => {
  for (const caminho of [...configuracao().pastas.map((p) => `${p}/${nome}`), nome]) {
    const r = await conteudo(caminho, accept);
    if (r.status !== 404) return { r, caminho };
  }
  return null;
};

// Hora do envio: atualizado.json do robô, se existir; senão, o último commit que mexeu no arquivo.
const horaDoEnvio = async (nome, caminho) => {
  try {
    const m = await conteudo('atualizado.json', 'application/vnd.github.raw');
    if (m.ok) {
      const iso = (await m.json())?.[nome]?.atualizadoEm;
      if (iso) return new Date(iso).toUTCString();
    }
    const { branch } = configuracao();
    const c = await githubApi(`/commits?path=${encodeURIComponent(caminho)}&sha=${encodeURIComponent(branch)}&per_page=1`, 'application/vnd.github+json');
    if (!c.ok) return null;
    const data = (await c.json())?.[0]?.commit?.committer?.date;
    return data ? new Date(data).toUTCString() : null;
  } catch {
    return null;
  }
};

const status = async () => {
  const { repo, branch, pastas } = configuracao();
  const planilhas = {};
  for (const [chave, { nome }] of Object.entries(ARQUIVOS)) {
    try {
      const achado = await acharNoGithub(nome, 'application/vnd.github.object'); // só os dados do arquivo, sem o conteúdo
      if (!achado) { planilhas[chave] = { arquivo: nome, achado: false, erro: 'não encontrado' }; continue; }
      if (!achado.r.ok) { planilhas[chave] = { arquivo: nome, achado: false, caminho: achado.caminho, erro: `GitHub respondeu ${achado.r.status}` }; continue; }
      const info = await achado.r.json();
      planilhas[chave] = { arquivo: nome, achado: true, caminho: achado.caminho, bytes: info.size ?? null, atualizadoEm: await horaDoEnvio(nome, achado.caminho) };
    } catch (e) {
      planilhas[chave] = { arquivo: nome, achado: false, erro: String(e?.message || e) };
    }
  }
  return Response.json({ repo, branch, pastas, planilhas }, { headers: { 'Cache-Control': 'no-store' } });
};

const responder = async (request, soCabecalho) => {
  const chave = decodeURIComponent(new URL(request.url).pathname.split('/').pop() || '');
  const { repo, token } = configuracao();
  if (!repo || !token) {
    return new Response('Cadastre o repositório e o token do GitHub nas variáveis de ambiente da Vercel (GITHUB_OWNER + GITHUB_REPO e GITHUB_TOKEN).', { status: 500 });
  }
  if (chave === 'status') return status();

  const arquivo = ARQUIVOS[chave];
  if (!arquivo) return new Response('Planilha desconhecida.', { status: 404 });

  const achado = await acharNoGithub(arquivo.nome, soCabecalho ? 'application/vnd.github.object' : 'application/vnd.github.raw');
  if (!achado) return new Response(`${arquivo.nome} não está no repositório ${repo}.`, { status: 404 });
  if (!achado.r.ok) return new Response(`O GitHub respondeu ${achado.r.status} para ${achado.caminho}.`, { status: 502 });

  const modificado = await horaDoEnvio(arquivo.nome, achado.caminho);
  const cabecalhos = {
    'Content-Type': arquivo.tipo,
    'Cache-Control': 'no-store',
    ...(modificado ? { 'Last-Modified': modificado } : {})
  };
  if (soCabecalho) return new Response(null, { status: 200, headers: cabecalhos });
  return new Response(achado.r.body, { status: 200, headers: cabecalhos });
};

export function GET(request) {
  return responder(request, false);
}

export function HEAD(request) {
  return responder(request, true);
}
