const marcas = {
  bernoulli: 'Bernoulli',
  hexag: 'Hexag',
  poliedro: 'Poliedro',
  sas: 'SAS',
  somos: 'Somos'
};

function normalizar(texto) {
  return texto.normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/@[\p{L}\p{N}_.+\-]+/gu, '')
    .replace(/[º°ª]/g, 'o')
    .replace(/_/g, ' ')
    .toLowerCase()
    .trim();
}

function unico(valores) {
  const distintos = [...new Set(valores)];
  return distintos.length === 1 ? distintos[0] : null;
}

function identificarDia(texto) {
  const ordinais = [];
  if (/\bprimeiro\s+dia\b/.test(texto)) ordinais.push(1);
  if (/\bsegundo\s+dia\b/.test(texto)) ordinais.push(2);
  if (ordinais.length) return unico(ordinais);
  const dias = [...texto.matchAll(/\bd(?:ia)?\s*0?([12])(?:o)?\b|\b0?([12])o\s*d(?:ia)?\b/g)]
    .map((resultado) => Number(resultado[1] ?? resultado[2]));
  if (!dias.length) {
    dias.push(...[...texto.matchAll(/\b0?([12])\s*d(?:ia)?\b/g)].map((resultado) => Number(resultado[1])));
  }
  return unico(dias);
}

function identificarEdicao(pastas, nome, marca) {
  for (const pasta of pastas) {
    if (/\bextra\b/.test(pasta)) return 'extra';
    if (/\bzero\b/.test(pasta)) return 0;
    const resultado = pasta.match(/^(?:(?:simulad[oa]|simualdo|simu|sas|somos)\s+)?(\d{1,2})(?:o)?(?:\s+sas)?(?:\s*-\s*|\s+)?(?:20\d{2})?(?:\s+(?:new|-\s*somos))?\s*\+*$/);
    if (resultado) return Number(resultado[1]);
  }
  if (/\bzero\b/.test(nome)) return 0;
  if (marca === 'bernoulli') {
    const resultado = nome.match(/\b(?:simu(?:lado)?|simado)\s+0?(\d{1,2})\b/) ??
      nome.match(/\b0?(\d{1,2})\s+simu(?:lado)?\b/);
    if (resultado) return Number(resultado[1]);
  }
  return null;
}

const formatos = [
  { padrao: /\banuladas\b/, titulo: 'Questões anuladas', tipo: 'Material de apoio' },
  { padrao: /\bmodelo\b.*\bfolha\b.*\bredacao\b/, titulo: 'Modelo de folha de redação', tipo: 'Redação' },
  { padrao: /\bmodelo\b.*\bgab/, titulo: 'Modelo de gabarito', tipo: 'Gabarito' },
  { padrao: /\bgab(?:arito)?\s+comentad/, titulo: 'Gabarito comentado', tipo: 'Gabarito', complemento: 'do simulado' },
  { padrao: /\bresolu[ct][ao]|(?:^|\W)res(?:\W|$)|\bcomentarios?\b/, titulo: 'Resolução', tipo: 'Resolução', complemento: 'do simulado' },
  { padrao: /\bgab(?:aritos?)?\b|\bgab[12]\b|\brespostas\b/, titulo: 'Gabarito', tipo: 'Gabarito', complemento: 'do simulado' },
  { padrao: /\bredacao\b/, titulo: 'Redação', tipo: 'Redação', complemento: 'do simulado' }
];

export function metadadosDoArquivo(recurso) {
  const [origem, ...partes] = recurso.caminhoNoArquivo.normalize('NFC').split(/[\\/]/);
  const nome = normalizar(partes.pop() ?? origem).replace(/(?:\.(?:pdf|jpe?g))+$/i, '');
  const pastas = partes.map(normalizar);
  const marca = recurso.colecaoId.split('-')[0];
  const instituicao = marcas[marca] ?? '';
  const ano = unico([...normalizar(recurso.caminhoNoArquivo).matchAll(/(?<!\d)(?:19|20)\d{2}(?!\d)/g)]
    .map((resultado) => Number(resultado[0])).filter((valor) => valor >= 1998));
  const dia = identificarDia(nome) ?? identificarDia(pastas.join(' ')) ??
    (marca === 'bernoulli' ? Number(nome.match(/\bgab([12])\b|\bgab(?: extra)?\s+([12])$/)?.slice(1).find(Boolean)) || null : null);
  const prova = nome.match(/\bprova\s+([12])\b(?!\s*-\s*20\d{2})/)?.[1];
  const cor = unico([...nome.matchAll(/\b(azul|amarelo|rosa|branco|cinza|verde|laranja)\b/g)]
    .map((resultado) => resultado[1]));
  const formato = formatos.find(({ padrao }) => padrao.test(nome));
  const edicao = identificarEdicao(pastas, nome, marca);
  const simulado = edicao === 'extra' ? 'simulado extra' : 'simulado';
  const numero = typeof edicao === 'number' ? 'nº ' + edicao : '';
  const exame = ({ unifesp: 'Unifesp', famema: 'Famema', unicamp: 'Unicamp' })[pastas.find((pasta) => /^(unifesp|famema|unicamp)$/.test(pasta))];
  const etapa = pastas.map((pasta) => pasta.match(/^([12])o\s+(prova|fase)$/)).find(Boolean);
  const detalheEtapa = etapa ? etapa[1] + 'ª ' + etapa[2] : '';
  const detalheDia = dia ? dia + 'º dia' : detalheEtapa || (prova && marca === 'bernoulli' ? 'prova ' + prova : '');
  const detalhes = [detalheDia, cor ? 'caderno ' + cor : ''].filter(Boolean);

  if (exame) {
    const titulo = [formato?.titulo ?? 'Simulado', exame, '(Hexag Medicina)'].join(' ');
    return { titulo: [titulo, ...detalhes].join(' — '), ano, tipo: formato?.tipo ?? 'Prova ou simulado' };
  }

  const eProva = /\b(?:provas?|caderno|simulad[oa]|simado|simu)\b/.test(nome) || Boolean(dia);
  const tituloBase = formato
    ? [formato.titulo, formato.complemento ? 'do ' + simulado : '', instituicao, numero]
    : [eProva ? simulado.replace(/^s/, 'S') : 'Material de estudo' + (edicao === null ? '' : ' do ' + simulado), instituicao, numero];
  const titulo = tituloBase.filter(Boolean).join(' ') + (ano ? ' (' + ano + ')' : '');
  return { titulo: [titulo, ...detalhes].join(' — '), ano, tipo: formato?.tipo ?? (eProva ? 'Prova ou simulado' : 'Material de apoio') };
}

export function distinguirTitulos(recursos) {
  const grupos = new Map();
  for (const recurso of recursos) {
    const chave = recurso.colecaoId + '\n' + normalizar(recurso.titulo);
    const grupo = grupos.get(chave) ?? [];
    grupo.push(recurso);
    grupos.set(chave, grupo);
  }
  for (const grupo of grupos.values()) {
    if (grupo.length > 1) {
      grupo.sort((a, b) => a.id.localeCompare(b.id));
      grupo.forEach((recurso, indice) => { recurso.titulo += ' — arquivo ' + (indice + 1); });
    }
  }
}
