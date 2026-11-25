import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(await readFile(resolve(root, 'acervo/publicacao/assets-conferidos.json'), 'utf8'));
const internal = JSON.parse(await readFile(resolve(root, 'catalogo/recursos.json'), 'utf8'));
if (manifest.recursos.length !== internal.recursos.length) throw new Error('O número de anexos não corresponde ao inventário.');
const decisionsPath = resolve(root, 'catalogo/permissoes.json');
const permissions = JSON.parse(await readFile(decisionsPath, 'utf8'));
for (const item of manifest.recursos) {
  const title = item.titulo.toLocaleLowerCase('pt-BR').replace(/\p{L}/u, (letter) => letter.toLocaleUpperCase('pt-BR'));
  permissions.recursos[item.id] = {
    status: 'autorizado',
    url: item.url,
    titulo: title,
    fonte: 'Coleção ' + item.colecao,
    titular: 'Titular indicado pela coleção ' + item.colecao,
    dataRevisao: '2026-11-24',
    licencaOuAutorizacao: 'Redistribuição aprovada conforme confirmação do responsável pelo projeto em 24/11/2026.'
  };
}
await writeFile(decisionsPath, JSON.stringify(permissions, null, 2) + '\n', 'utf8');
console.log('Registradas ' + manifest.recursos.length + ' decisões de publicação.');
