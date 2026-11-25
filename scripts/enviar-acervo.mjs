import { readFile, writeFile } from 'node:fs/promises';
import { spawn, execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const folder = resolve(root, 'acervo/publicacao');
const repo = 'Heazts/horizonte-livre';
const tag = 'acervo-inicial-2026';
const releaseId = '457483806';
const manifest = JSON.parse(await readFile(resolve(folder, 'manifesto-local.json'), 'utf8'));

function listAssets() {
  const json = execFileSync('gh', ['api', 'repos/' + repo + '/releases/' + releaseId + '/assets?per_page=100', '--paginate', '--slurp'], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  return JSON.parse(json).flat();
}
function matches(item, asset) {
  return asset && asset.state === 'uploaded' && asset.size === item.bytes &&
    (!asset.digest || asset.digest === 'sha256:' + item.sha256);
}
function upload(item) {
  return new Promise((resolveUpload, reject) => {
    const child = spawn('gh', ['release', 'upload', tag, resolve(folder, item.arquivo), '--repo', repo], { windowsHide: true });
    let errors = '';
    child.stderr.on('data', (chunk) => { errors = (errors + chunk.toString()).slice(-3000); });
    child.on('error', reject);
    child.on('close', (code) => code === 0 ? resolveUpload() : reject(new Error(item.arquivo + ': ' + errors)));
  });
}
const existing = new Map(listAssets().map((asset) => [asset.name, asset]));
const work = manifest.recursos.filter((item) => {
  const asset = existing.get(item.arquivo);
  if (asset && !matches(item, asset)) throw new Error('Um arquivo remoto já existe com tamanho ou hash divergente: ' + item.arquivo);
  return !asset;
});
const release = JSON.parse(execFileSync('gh', ['release', 'view', tag, '--repo', repo, '--json', 'isDraft'], { encoding: 'utf8' }));
if (work.length && !release.isDraft) throw new Error('Envio bloqueado: a release já está publicada. Confira a autorização antes de criar uma nova release.');
console.log('Já enviados: ' + (manifest.recursos.length - work.length) + '; restantes: ' + work.length);
let next = 0;
let done = manifest.recursos.length - work.length;
const failures = [];
async function worker() {
  while (next < work.length) {
    const item = work[next++];
    let sent = false;
    for (let attempt = 1; attempt <= 3 && !sent; attempt++) {
      try {
        await upload(item);
        sent = true;
      } catch (error) {
        console.error('Tentativa ' + attempt + ' falhou para ' + item.arquivo + ': ' + error.message);
        if (attempt < 3) await new Promise((resolveWait) => setTimeout(resolveWait, attempt * 10000));
      }
    }
    if (!sent) failures.push(item.arquivo);
    done++;
    if (done % 10 === 0 || done === manifest.recursos.length) console.log('Processados ' + done + '/' + manifest.recursos.length + '; falhas: ' + failures.length);
  }
}
await Promise.all(Array.from({ length: 4 }, () => worker()));
const remote = new Map(listAssets().map((asset) => [asset.name, asset]));
const missing = manifest.recursos.filter((item) => !matches(item, remote.get(item.arquivo)));
if (missing.length || failures.length) {
  console.error('Arquivos faltantes ou com divergência: ' + missing.map((item) => item.arquivo).join(', '));
  process.exitCode = 1;
} else {
  const assets = manifest.recursos.map((item) => ({ ...item, url: remote.get(item.arquivo).browser_download_url, digestRemoto: remote.get(item.arquivo).digest || null }));
  await writeFile(resolve(folder, 'assets-conferidos.json'), JSON.stringify({ recursos: assets }, null, 2) + '\n');
  console.log('Todos os arquivos foram conferidos por tamanho e, quando disponível, SHA-256 remoto.');
}
