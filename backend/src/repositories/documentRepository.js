const path = require('node:path');
const { mkdir, unlink, stat, access } = require('node:fs/promises');
const { constants } = require('node:fs');

function createDocumentRepository(storageDirectory) {
  const directory = path.resolve(storageDirectory);
  const documents = new Map();

  function getFilePath(storedName) {
    if (!storedName || path.basename(storedName) !== storedName || /[\\/]/.test(storedName)) {
      throw new Error('Nome de armazenamento inválido.');
    }
    const filePath = path.resolve(directory, storedName);
    if (path.dirname(filePath) !== directory) {
      throw new Error('Caminho de armazenamento inválido.');
    }
    return filePath;
  }

  return {
    async prepareStorage() {
      await mkdir(directory, { recursive: true });
      return directory;
    },
    save(document) {
      documents.set(document.id, { ...document });
      return { ...document };
    },
    findById(id) {
      const document = documents.get(id);
      return document ? { ...document } : undefined;
    },
    findByOwner(owner) {
      return [...documents.values()]
        .filter((document) => document.owner === owner)
        .sort((first, second) => second.uploadedAt.localeCompare(first.uploadedAt)
          || first.id.localeCompare(second.id))
        .map((document) => ({ ...document }));
    },
    async findFile(storedName) {
      const filePath = getFilePath(storedName);
      const info = await stat(filePath);
      if (!info.isFile()) {
        const error = new Error('Arquivo não encontrado.');
        error.code = 'ENOENT';
        throw error;
      }
      await access(filePath, constants.R_OK);
      return filePath;
    },
    async removeFile(storedName) {
      try {
        await unlink(getFilePath(storedName));
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    },
  };
}

module.exports = createDocumentRepository;