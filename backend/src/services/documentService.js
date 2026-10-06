const { randomUUID } = require('node:crypto');

function createError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function toMetadata(document) {
  const { storedName, ...metadata } = document;
  return metadata;
}

function createDocumentService(repository) {
  return {
    async upload(file, owner) {
      if (!file) throw createError('FILE_REQUIRED');
      try {
        if (file.size === 0) throw createError('FILE_REQUIRED');
        const document = repository.save({
          id: randomUUID(),
          originalName: file.originalName,
          size: file.size,
          uploadedAt: new Date().toISOString(),
          owner,
          storedName: file.storedName,
        });
        return toMetadata(document);
      } catch (error) {
        try {
          await repository.removeFile(file.storedName);
        } catch {
          throw createError('STORAGE_ERROR');
        }
        throw error.code === 'FILE_REQUIRED' ? error : createError('STORAGE_ERROR');
      }
    },
    list(owner) {
      return repository.findByOwner(owner).map(toMetadata);
    },
    async download(id, owner) {
      const document = repository.findById(id);
      if (!document || document.owner !== owner) throw createError('DOCUMENT_NOT_FOUND');
      try {
        const filePath = await repository.findFile(document.storedName);
        return { filePath, originalName: document.originalName };
      } catch (error) {
        if (error.code === 'ENOENT') throw createError('DOCUMENT_NOT_FOUND');
        throw createError('STORAGE_ERROR');
      }
    },
  };
}

module.exports = createDocumentService;