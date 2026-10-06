const path = require('node:path');

const errors = {
  USER_ID_REQUIRED: [400, 'Informe o identificador do usuário.'],
  FILE_REQUIRED: [400, 'Envie um arquivo não vazio no campo file.'],
  TOO_MANY_FILES: [400, 'Envie apenas um arquivo por requisição.'],
  INVALID_UPLOAD: [400, 'O formato do upload é inválido.'],
  FILE_TOO_LARGE: [413, 'O arquivo excede o limite permitido.'],
  DOCUMENT_NOT_FOUND: [404, 'Documento não encontrado.'],
  STORAGE_ERROR: [500, 'Não foi possível acessar o armazenamento local.'],
  INTERNAL_ERROR: [500, 'Não foi possível concluir a operação.'],
};

function safeDownloadName(originalName) {
  return path.basename(path.win32.basename(originalName)).replace(/[\x00-\x1f\x7f]/g, '') || 'documento';
}

function createDocumentController(service) {
  return {
    requireOwner(req, res, next) {
      const owner = req.get('X-User-Id')?.trim();
      if (!owner) return next(Object.assign(new Error(), { code: 'USER_ID_REQUIRED' }));
      res.locals.owner = owner;
      next();
    },
    async upload(req, res) {
      const file = req.file && {
        originalName: req.file.originalname,
        size: req.file.size,
        storedName: req.file.filename,
      };
      const document = await service.upload(file, res.locals.owner);
      res.status(201).json({ data: document });
    },
    list(req, res) {
      res.json({ data: service.list(res.locals.owner) });
    },
    async download(req, res, next) {
      const document = await service.download(req.params.id, res.locals.owner);
      res.download(document.filePath, safeDownloadName(document.originalName), (error) => {
        if (!error) return;
        error.code = error.code === 'ENOENT' ? 'DOCUMENT_NOT_FOUND' : 'STORAGE_ERROR';
        next(error);
      });
    },
    handleError(error, req, res, next) {
      if (res.headersSent) return next(error);
      const code = Object.hasOwn(errors, error.code) ? error.code : 'INTERNAL_ERROR';
      const [status, message] = errors[code];
      res.status(status).json({ error: { code, message } });
    },
  };
}

module.exports = createDocumentController;