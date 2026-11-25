import { createReadStream } from 'node:fs';
import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const target = resolve(root, 'acervo/publicacao');
const input = JSON.parse(await readFile(resolve(root, 'catalogo/recursos.json'), 'utf8'));
const collections = new Map(input.colecoes.map((collection) => [collection.id, collection.titulo]));
const folder = resolve(root, 'acervo/triagem') + sep;
await mkdir(target, { recursive: true });

function sentenceCase(value) {
  const normalized = String(value).replace(/@[\p{L}\p{N}_.-]+/gu, '').replace(/\s+/g, ' ').trim().toLocaleLowerCase('pt-BR');
  return normalized ? normalized.replace(/\p{L}/u, (letter) => letter.toLocaleUpperCase('pt-BR')) : 'Material de estudo';
}
function slug(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
async function sha256(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}
const items = [];
for (const [index, resource] of input.recursos.entries()) {
  const source = resolve(root, ...resource.caminhoExtraido.split('/'));
  if (!source.startsWith(folder)) throw new Error('Arquivo fora da triagem: ' + resource.id);
  const title = sentenceCase(resource.titulo);
  const label = slug(collections.get(resource.colecaoId) || 'colecao') + '-' + slug(title).slice(0, 75);
  const filename = (label[0].toUpperCase() + label.slice(1)).replace(/-+$/g, '') + '-' + resource.id.toLowerCase() + resource.extensao.toLowerCase();
  const destination = resolve(target, filename);
  if (!destination.startsWith(target + sep)) throw new Error('Nome de destino inseguro.');
  try {
    await copyFile(source, destination, 1); // COPYFILE_EXCL
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    if ((await sha256(source)) !== (await sha256(destination))) throw new Error('Arquivo existente diferente: ' + filename);
  }
  const file = await stat(destination);
  if (file.size !== resource.tamanhoBytes) throw new Error('Tamanho diferente: ' + filename);
  items.push({ id: resource.id, titulo: title, colecao: collections.get(resource.colecaoId), arquivo: filename, bytes: file.size, sha256: await sha256(destination) });
  if ((index + 1) % 25 === 0 || index + 1 === input.recursos.length) console.log('Preparados ' + (index + 1) + '/' + input.recursos.length);
}
if (new Set(items.map((item) => item.arquivo.toLowerCase())).size !== items.length) throw new Error('Nomes de arquivos repetidos.');
await writeFile(resolve(target, 'manifesto-local.json'), JSON.stringify({ recursos: items }, null, 2) + '\n');
console.log('Cópias preparadas em ' + target);
