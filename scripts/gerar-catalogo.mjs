import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { distinguirTitulos, metadadosDoArquivo } from './titulos-catalogo.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
const internal = read('catalogo/recursos.json');
const permissions = read('catalogo/permissoes.json');
const decisions = permissions.recursos || {};

function sentenceCase(value) {
  const text = String(value).replace(/@[\p{L}\p{N}_.-]+/gu, '').replace(/\s+/g, ' ').trim().toLocaleLowerCase('pt-BR');
  return text ? text.replace(/\p{L}/u, (letter) => letter.toLocaleUpperCase('pt-BR')) : 'Material de estudo';
}

const collections = internal.colecoes.map(({ id, titulo }) => ({
  id,
  titulo: sentenceCase(titulo)
}));
const resources = internal.recursos.map((resource) => {
  const decision = decisions[resource.id];
  const status = decision?.status ?? 'revisao_de_direitos';
  const metadata = metadadosDoArquivo(resource);
  // O título armazenado na publicação inicial só repetia o nome do arquivo.
  const legacyTitle = decision?.titulo ? sentenceCase(decision.titulo) : null;
  const manualTitle = legacyTitle !== sentenceCase(resource.titulo) ? legacyTitle : null;
  return {
    id: resource.id,
    colecaoId: resource.colecaoId,
    titulo: decision?.tituloEditorial?.trim() || manualTitle || metadata.titulo,
    tipo: metadata.tipo,
    ano: metadata.ano,
    extensao: resource.extensao.replace(/^\./, '').toUpperCase(),
    tamanhoBytes: resource.tamanhoBytes,
    status,
    url: status === 'autorizado' || status === 'link_para_fonte' ? decision?.url ?? null : null
  };
});
distinguirTitulos(resources);
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
