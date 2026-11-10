// Entrega ao dashboard as planilhas que os robôs publicam no repositório
// PRIVADO de armazenamento no GitHub.
//
// O token do GitHub fica só aqui no servidor (variáveis de ambiente da Vercel,
// SEM o prefixo VITE_): o navegador nunca o vê. Só estes endereços existem:
//
//   /api/planilhas/wms         -> planilha_estoque.xls (WMS, atualizado a cada ~5 min)
//   /api/planilhas/singra      -> planilha_rms_unificada.csv (Singra, a cada ~30 min)
//   /api/planilhas/wms-par     -> o WMS do instante em que o Singra começou a ser lido (par da interface)
//   /api/planilhas/singra-par  -> o Singra desse mesmo ciclo
//   /api/planilhas/status      -> onde cada planilha foi achada e quando foi enviada (para conferir)
//
// A planilha pode estar na raiz do repositório ou numa das pastas de
// GITHUB_STORAGE_PASTAS (padrão: dados_wms e dados_singra).
//
// O par (wms-par + singra-par) vem de GITHUB_PASTA_INTERFACE (padrão: dados_interface), gravada pelo robô do Singra:
// WMS e Singra do mesmo momento, para a aba Interface SINGRA x WMS não acusar divergência que é só defasagem
// (o WMS é atualizado muito mais vezes que o Singra). Enquanto o robô não publicou o par, essas rotas dão 404 e o
// dashboard cai de volta para wms/singra. A hora de cada metade do par vem do atualizado.json (chave = caminho).
//
// HEAD devolve só a hora do último envio (Last-Modified), sem baixar a planilha:
// é o que o dashboard usa para saber se o cache local ainda vale. GET repassa o
// arquivo em streaming (sem o limite de 4,5 MB de resposta).

const ARQUIVOS = {
  wms: { nome: 'planilha_estoque.xls', tipo: 'application/vnd.ms-excel' },
  singra: { nome: 'planilha_rms_unificada.csv', tipo: 'text/csv; charset=utf-8' },
  'wms-par': { nome: 'planilha_estoque.xls', tipo: 'application/vnd.ms-excel', par: true },
  'singra-par': { nome: 'planilha_rms_unificada.csv', tipo: 'text/csv; charset=utf-8', par: true }
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
    pastas: (e.GITHUB_STORAGE_PASTAS ?? 'dados_wms,dados_singra').split(',').map((p) => p.trim().replace(/^\/+|\/+$/g, '')).filter(Boolean),
    pastaInterface: (e.GITHUB_PASTA_INTERFACE ?? 'dados_interface').trim().replace(/^\/+|\/+$/g, '')
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
// O par da interface só existe na pasta dele: não cai para a raiz nem para as pastas dos robôs, senão devolveria o
// arquivo "ao vivo" fingindo ser o par.
const acharNoGithub = async (nome, accept, par = false) => {
  const { pastas, pastaInterface } = configuracao();
  const candidatos = par ? (pastaInterface ? [`${pastaInterface}/${nome}`] : []) : [...pastas.map((p) => `${p}/${nome}`), nome];
  for (const caminho of candidatos) {
    const r = await conteudo(caminho, accept);
    if (r.status !== 404) return { r, caminho };
  }
  return null;
};

// Hora do envio: atualizado.json do robô, se existir; senão, o último commit que mexeu no arquivo.
// No par da interface a chave do atualizado.json é o caminho (dados_interface/arquivo) e não há plano B: o histórico
// do repositório é de um commit só, então a data do commit não diz de quando é o dado.
const horaDoEnvio = async (nome, caminho, par = false) => {
  try {
    const m = await conteudo('atualizado.json', 'application/vnd.github.raw');
    if (m.ok) {
      const iso = (await m.json())?.[par ? caminho : nome]?.atualizadoEm;
      if (iso) return new Date(iso).toUTCString();
    }
    if (par) return null;
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
  const { repo, branch, pastas, pastaInterface } = configuracao();
  const planilhas = {};
  for (const [chave, { nome, par }] of Object.entries(ARQUIVOS)) {
    try {
      const achado = await acharNoGithub(nome, 'application/vnd.github.object', par); // só os dados do arquivo, sem o conteúdo
      if (!achado) { planilhas[chave] = { arquivo: nome, achado: false, erro: 'não encontrado' }; continue; }
      if (!achado.r.ok) { planilhas[chave] = { arquivo: nome, achado: false, caminho: achado.caminho, erro: `GitHub respondeu ${achado.r.status}` }; continue; }
      const info = await achado.r.json();
      planilhas[chave] = { arquivo: nome, achado: true, caminho: achado.caminho, bytes: info.size ?? null, sha: info.sha ?? null, atualizadoEm: await horaDoEnvio(nome, achado.caminho, par) };
    } catch (e) {
      planilhas[chave] = { arquivo: nome, achado: false, erro: String(e?.message || e) };
    }
  }
  return Response.json({ repo, branch, pastas, pastaInterface, planilhas }, { headers: { 'Cache-Control': 'no-store' } });
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

  const achado = await acharNoGithub(arquivo.nome, soCabecalho ? 'application/vnd.github.object' : 'application/vnd.github.raw', arquivo.par);
  if (!achado) return new Response(`${arquivo.nome} não está no repositório ${repo}${arquivo.par ? ' (o par da interface ainda não foi publicado pelo robô do Singra)' : ''}.`, { status: 404 });
  if (!achado.r.ok) return new Response(`O GitHub respondeu ${achado.r.status} para ${achado.caminho}.`, { status: 502 });

  const modificado = await horaDoEnvio(arquivo.nome, achado.caminho, arquivo.par);
  // SHA do arquivo (só no HEAD, onde a resposta do GitHub traz os dados do arquivo): identifica a versão exata,
  // sem depender de relógio. O dashboard usa junto com o Last-Modified para saber se o cache do par ainda vale.
  const sha = soCabecalho ? (await achado.r.json().catch(() => null))?.sha : null;
  const cabecalhos = {
    'Content-Type': arquivo.tipo,
    'Cache-Control': 'no-store',
    ...(modificado ? { 'Last-Modified': modificado } : {}),
    ...(sha ? { 'X-Blob-Sha': sha } : {})
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
