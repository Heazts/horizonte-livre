import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
const internal = read('catalogo/recursos.json');
const permissions = read('catalogo/permissoes.json');
const decisions = permissions.recursos || {};

function yearFromPath(path) {
  const matches = [...String(path).matchAll(/(?<!\d)(?:19|20)\d{2}(?!\d)/g)].map((match) => Number(match[0]));
  const unique = [...new Set(matches)].filter((year) => year >= 1998 && year <= 2100);
  return unique.length === 1 ? unique[0] : null;
}

function typeFromName(path) {
  const name = String(path).toLocaleLowerCase('pt-BR');
  if (/gabarito|gab(?:arito)?[\s_.-]/.test(name)) return 'Gabarito';
  if (/resolu[çc][ãa]o|resolvid/.test(name)) return 'Resolução';
  if (/reda[çc][ãa]o/.test(name)) return 'Redação';
  if (/prova|caderno|simulad|\bsimu\b/.test(name)) return 'Prova ou simulado';
  return 'Material de apoio';
}

const collections = internal.colecoes.map(({ id, titulo }) => ({
  id,
  titulo: titulo.replace(/\s+/g, ' ').trim()
}));
const resources = internal.recursos.map((resource) => {
  const decision = decisions[resource.id];
  const status = decision?.status ?? 'revisao_de_direitos';
  const title = String(resource.titulo).replace(/@[\p{L}\p{N}_.-]+/gu, '').replace(/\s+/g, ' ').trim() || 'Material sem título';
  return {
    id: resource.id,
    colecaoId: resource.colecaoId,
    titulo: title,
    tipo: typeFromName(resource.caminhoNoArquivo),
    ano: yearFromPath(resource.caminhoNoArquivo),
    extensao: resource.extensao.replace(/^\./, '').toUpperCase(),
    tamanhoBytes: resource.tamanhoBytes,
    status,
    url: status === 'autorizado' || status === 'link_para_fonte' ? decision?.url ?? null : null
  };
});
const unknownDecisions = Object.keys(decisions).filter((id) => !resources.some((resource) => resource.id === id));
if (unknownDecisions.length) throw new Error('Decisões editoriais sem recurso correspondente: ' + unknownDecisions.join(', '));
const publicCatalog = {
  esquema: 'horizonte-livre/catalogo-v2',
  colecoes: collections,
  recursos: resources
};
const serialized = JSON.stringify(publicCatalog, null, 2) + '\n';
const output = resolve(root, 'site/catalogo.json');
if (process.argv.includes('--check')) {
  if (readFileSync(output, 'utf8') !== serialized) throw new Error('O catálogo público está desatualizado. Execute npm run catalogo.');
  console.log('Catálogo público corresponde ao inventário local.');
} else {
  writeFileSync(output, serialized, 'utf8');
  console.log('Catálogo gerado: ' + collections.length + ' coleções e ' + resources.length + ' recursos.');
}
