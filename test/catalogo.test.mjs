import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, copyFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';

const catalog = JSON.parse(readFileSync(new URL('../site/catalogo.json', import.meta.url), 'utf8'));
const index = readFileSync(new URL('../site/index.html', import.meta.url), 'utf8');
test('catálogo público tem IDs únicos e dados de acesso controlados', () => {
  assert.equal(catalog.esquema, 'horizonte-livre/catalogo-v2');
  assert.ok(catalog.colecoes.length > 0);
  assert.ok(catalog.recursos.length > 0);
  assert.equal(new Set(catalog.recursos.map((item) => item.id)).size, catalog.recursos.length);
  const collections = new Set(catalog.colecoes.map((item) => item.id));
  for (const item of catalog.recursos) {
    assert.ok(collections.has(item.colecaoId));
    assert.equal('caminhoExtraido' in item, false);
    assert.equal('caminhoNoArquivo' in item, false);
    if (item.status === 'revisao_de_direitos' || item.status === 'removido') assert.equal(item.url, null);
  }
});
test('páginas oficiais de estudo continuam acessíveis sem JavaScript', () => {
  assert.match(index, /https:\/\/www\.gov\.br\/inep\/[^"]+\/enem\/provas-e-gabaritos/);
  assert.match(index, /https:\/\/www\.gov\.br\/inep\/[^"]+\/encceja\/provas-e-gabaritos/);
  assert.match(index, /https:\/\/www\.obmep\.org\.br\/provas\.htm/);
});
test('validador aceita o catálogo incluído no projeto', () => {
  const result = spawnSync(process.execPath, ['scripts/validar.mjs'], { cwd: new URL('..', import.meta.url), encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
});
test('validador rejeita URL insegura e link para material em revisão', () => {
  const folder = mkdtempSync(join(tmpdir(), 'horizonte-catalogo-test-'));
  try {
    for (const name of ['scripts', 'site', 'catalogo']) mkdirSync(join(folder, name));
    copyFileSync(new URL('../scripts/validar.mjs', import.meta.url), join(folder, 'scripts', 'validar.mjs'));
    const sample = structuredClone(catalog);
    sample.recursos = [sample.recursos[0]];
    const resource = sample.recursos[0];
    const run = (decisions) => {
      writeFileSync(join(folder, 'site', 'catalogo.json'), JSON.stringify(sample));
      writeFileSync(join(folder, 'catalogo', 'permissoes.json'), JSON.stringify({ recursos: decisions }));
      return spawnSync(process.execPath, [join(folder, 'scripts', 'validar.mjs')], { encoding: 'utf8' });
    };
    resource.status = 'revisao_de_direitos';
    resource.url = 'https://example.org/documento';
    assert.notEqual(run({}).status, 0, 'item em revisão não pode ter URL');
    resource.status = 'autorizado';
    resource.url = 'javascript:alert(1)';
    const decision = { status: 'autorizado', url: resource.url, fonte: 'Fonte', titular: 'Autor', dataRevisao: '2026-11-24', licencaOuAutorizacao: 'Permissão registrada' };
    assert.notEqual(run({ [resource.id]: decision }).status, 0, 'URL javascript deve ser recusada');
    decision.url = resource.url = 'https://example.org/documento';
    assert.equal(run({ [resource.id]: decision }).status, 0, 'URL HTTPS autorizada deve ser aceita');
    delete decision.licencaOuAutorizacao;
    assert.notEqual(run({ [resource.id]: decision }).status, 0, 'redistribuição exige comprovação');
  } finally {
    if (resolve(folder).startsWith(resolve(tmpdir()) + sep) && folder.includes('horizonte-catalogo-test-')) {
      rmSync(folder, { recursive: true, force: true });
    }
  }
});
