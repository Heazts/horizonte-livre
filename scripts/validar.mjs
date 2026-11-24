import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
const catalog = read('site/catalogo.json');
const decisions = read('catalogo/permissoes.json').recursos;
const errors = [];
const allowedStatuses = new Set(['revisao_de_direitos', 'autorizado', 'link_para_fonte', 'removido']);
const isHttps = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password;
  } catch { return false; }
};
const isDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const time = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(time.getTime()) && time.toISOString().slice(0, 10) === value;
};
if (catalog.esquema !== 'horizonte-livre/catalogo-v2') errors.push('Esquema público inválido.');
if (!Array.isArray(catalog.colecoes) || !Array.isArray(catalog.recursos)) throw new Error('Coleções e recursos devem ser listas.');
const collections = new Set();
for (const collection of catalog.colecoes) {
  if (!collection.id || !collection.titulo || collections.has(collection.id)) errors.push('Coleção inválida ou duplicada: ' + collection.id);
  collections.add(collection.id);
}
const resourceIds = new Set();
for (const resource of catalog.recursos) {
  if (!resource.id || resourceIds.has(resource.id)) errors.push('Identificador inválido ou duplicado: ' + resource.id);
  resourceIds.add(resource.id);
  if (!collections.has(resource.colecaoId)) errors.push('Coleção inexistente: ' + resource.id);
  if (!resource.titulo || !resource.tipo || !Number.isSafeInteger(resource.tamanhoBytes) || resource.tamanhoBytes < 0) errors.push('Metadados inválidos: ' + resource.id);
  if (resource.ano !== null && (!Number.isInteger(resource.ano) || resource.ano < 1998 || resource.ano > 2100)) errors.push('Ano inválido: ' + resource.id);
  if (!allowedStatuses.has(resource.status)) errors.push('Situação inválida: ' + resource.id);
  const decision = decisions[resource.id];
  if (decision && decision.status !== resource.status) errors.push('Decisão editorial não refletida no catálogo: ' + resource.id);
  if (resource.status === 'autorizado' || resource.status === 'link_para_fonte') {
    if (!decision || decision.status !== resource.status || decision.url !== resource.url || !isHttps(resource.url) ||
        !decision.fonte || !decision.titular || !isDate(decision.dataRevisao)) {
      errors.push('Acesso sem fonte, titular, data ou URL HTTPS válidos: ' + resource.id);
    }
    if (resource.status === 'autorizado' && !decision?.licencaOuAutorizacao) errors.push('Redistribuição sem licença ou autorização: ' + resource.id);
  } else if (resource.url !== null) {
    errors.push('Recurso indisponível não pode expor URL: ' + resource.id);
  }
  if (Object.keys(resource).some((key) => /caminho|arquivoOriginal/i.test(key))) errors.push('Caminho privado no catálogo: ' + resource.id);
}
for (const id of Object.keys(decisions)) if (!resourceIds.has(id)) errors.push('Decisão editorial órfã: ' + id);
if (existsSync(resolve(root, 'catalogo/recursos.json'))) {
  const internal = read('catalogo/recursos.json');
  if (internal.recursos.length !== catalog.recursos.length || internal.colecoes.length !== catalog.colecoes.length) errors.push('Contagens públicas divergem do inventário local.');
}
if (errors.length) {
  errors.forEach((error) => console.error('ERRO: ' + error));
  process.exitCode = 1;
} else {
  console.log('Catálogo válido: ' + catalog.colecoes.length + ' coleções e ' + catalog.recursos.length + ' recursos.');
}
