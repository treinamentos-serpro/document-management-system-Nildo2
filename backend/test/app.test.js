const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { mkdtemp, mkdir, readdir, readFile, writeFile, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { once } = require('node:events');

let server;
let baseUrl;
let storageDirectory;
const previousStorageDirectory = process.env.DMS_STORAGE_DIR;
const previousLimit = process.env.MAX_FILE_SIZE_BYTES;

before(async () => {
  storageDirectory = await mkdtemp(path.join(tmpdir(), 'dms-test-'));
  process.env.DMS_STORAGE_DIR = storageDirectory;
  process.env.MAX_FILE_SIZE_BYTES = '64';
  const app = require('../src/app');
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
      server.closeAllConnections();
    });
  }
  if (storageDirectory) await rm(storageDirectory, { recursive: true, force: true });
  if (previousStorageDirectory === undefined) delete process.env.DMS_STORAGE_DIR;
  else process.env.DMS_STORAGE_DIR = previousStorageDirectory;
  if (previousLimit === undefined) delete process.env.MAX_FILE_SIZE_BYTES;
  else process.env.MAX_FILE_SIZE_BYTES = previousLimit;
});

function upload(content, owner, count = 1, field = 'file') {
  const form = new FormData();
  for (let index = 0; index < count; index += 1) {
    form.append(field, new Blob([content]), 'relatorio.txt');
  }
  return fetch(`${baseUrl}/upload`, {
    method: 'POST',
    headers: owner === undefined ? {} : { 'X-User-Id': owner },
    body: form,
  });
}

test('mantém o endpoint de saúde', async () => {
  const response = await fetch(`${baseUrl}/health`);
  assert.strictEqual(response.status, 200);
  assert.deepStrictEqual(await response.json(), { status: 'ok' });
});

test('envia, lista por proprietário e baixa os mesmos bytes', async () => {
  const content = 'documento de teste';
  const response = await upload(content, ' usuario-1 ');
  assert.strictEqual(response.status, 201);
  const { data: document } = await response.json();
  assert.match(document.id, /^[0-9a-f-]{36}$/);
  assert.strictEqual(document.originalName, 'relatorio.txt');
  assert.strictEqual(document.size, Buffer.byteLength(content));
  assert.strictEqual(document.owner, 'usuario-1');
  assert.strictEqual(new Date(document.uploadedAt).toISOString(), document.uploadedAt);
  assert.strictEqual(document.storedName, undefined);

  const storedFiles = await readdir(storageDirectory);
  assert.strictEqual(storedFiles.length, 1);
  assert.notStrictEqual(storedFiles[0], document.originalName);
  assert.strictEqual(await readFile(path.join(storageDirectory, storedFiles[0]), 'utf8'), content);

  const list = await fetch(`${baseUrl}/documents`, { headers: { 'X-User-Id': 'usuario-1' } });
  assert.strictEqual(list.status, 200);
  assert.deepStrictEqual(await list.json(), { data: [document] });
  const otherList = await fetch(`${baseUrl}/documents`, { headers: { 'X-User-Id': 'usuario-2' } });
  assert.deepStrictEqual(await otherList.json(), { data: [] });

  const url = `${baseUrl}/documents/${document.id}/download`;
  const download = await fetch(url, { headers: { 'X-User-Id': 'usuario-1' } });
  assert.strictEqual(download.status, 200);
  assert.match(download.headers.get('content-disposition'), /attachment;.*relatorio.txt/);
  assert.strictEqual(await download.text(), content);
  const denied = await fetch(url, { headers: { 'X-User-Id': 'usuario-2' } });
  assert.strictEqual(denied.status, 404);
  assert.strictEqual((await denied.json()).error.code, 'DOCUMENT_NOT_FOUND');

  await rm(path.join(storageDirectory, storedFiles[0]));
  const missingFile = await fetch(url, { headers: { 'X-User-Id': 'usuario-1' } });
  assert.strictEqual(missingFile.status, 404);
  assert.strictEqual((await missingFile.json()).error.code, 'DOCUMENT_NOT_FOUND');
});

test('exige identidade nas três rotas sem gravar arquivos', async () => {
  for (const response of [
    await upload('teste'),
    await fetch(`${baseUrl}/documents`),
    await fetch(`${baseUrl}/documents`, { headers: { 'X-User-Id': '   ' } }),
    await fetch(`${baseUrl}/documents/inexistente/download`),
  ]) {
    assert.strictEqual(response.status, 400);
    assert.strictEqual((await response.json()).error.code, 'USER_ID_REQUIRED');
  }
  assert.deepStrictEqual(await readdir(storageDirectory), []);
});

test('rejeita uploads inválidos e remove arquivos parciais', async () => {
  const cases = [
    ['', 1, 'file', 400, 'FILE_REQUIRED'],
    ['teste', 0, 'file', 400, 'FILE_REQUIRED'],
    ['teste', 2, 'file', 400, 'TOO_MANY_FILES'],
    ['x'.repeat(65), 1, 'file', 413, 'FILE_TOO_LARGE'],
    ['teste', 1, 'unexpected', 400, 'INVALID_UPLOAD'],
  ];
  for (const [content, count, field, status, code] of cases) {
    const response = await upload(content, 'usuario-1', count, field);
    assert.strictEqual(response.status, status);
    assert.strictEqual((await response.json()).error.code, code);
    assert.deepStrictEqual(await readdir(storageDirectory), []);
  }
});

test('retorna 404 para documento inexistente', async () => {
  const response = await fetch(`${baseUrl}/documents/inexistente/download`, {
    headers: { 'X-User-Id': 'usuario-1' },
  });
  assert.strictEqual(response.status, 404);
  assert.strictEqual((await response.json()).error.code, 'DOCUMENT_NOT_FOUND');
});

test('o app backend é exportado', () => {
  const app = require('../src/app');
  assert.ok(app, 'o app deve estar definido');
  assert.strictEqual(typeof app, 'function', 'o app Express deve ser uma função');
});

test('retorna erro seguro quando o diretório de armazenamento não está disponível', async () => {
  await rm(storageDirectory, { recursive: true });
  await writeFile(storageDirectory, 'não é um diretório');
  try {
    const response = await upload('teste', 'usuario-1');
    assert.strictEqual(response.status, 500);
    const body = await response.json();
    assert.strictEqual(body.error.code, 'STORAGE_ERROR');
    assert.ok(!JSON.stringify(body).includes(storageDirectory));
  } finally {
    await rm(storageDirectory);
    await mkdir(storageDirectory);
  }
});

test('remove o arquivo quando o registro dos metadados falha', async () => {
  const createDocumentService = require('../src/services/documentService');
  let removedName;
  const service = createDocumentService({
    save() {
      throw new Error('falha interna');
    },
    async removeFile(storedName) {
      removedName = storedName;
    },
  });
  await assert.rejects(service.upload({
    originalName: 'relatorio.txt', storedName: 'gerado', size: 10,
  }, 'usuario-1'), { code: 'STORAGE_ERROR' });
  assert.strictEqual(removedName, 'gerado');
});

test('ordena metadados por data e identificador sem misturar proprietários', async () => {
  const createDocumentRepository = require('../src/repositories/documentRepository');
  const repository = createDocumentRepository(storageDirectory);
  repository.save({ id: 'antigo', owner: 'usuario-1', uploadedAt: '2026-10-05T12:00:00.000Z' });
  repository.save({ id: 'b', owner: 'usuario-1', uploadedAt: '2026-10-06T12:00:00.000Z' });
  repository.save({ id: 'a', owner: 'usuario-1', uploadedAt: '2026-10-06T12:00:00.000Z' });
  repository.save({ id: 'outro', owner: 'usuario-2', uploadedAt: '2026-10-06T13:00:00.000Z' });
  assert.deepStrictEqual(repository.findByOwner('usuario-1').map((document) => document.id), [
    'a', 'b', 'antigo',
  ]);
  await assert.rejects(repository.findFile('../arquivo'), /armazenamento inválido/);
});
