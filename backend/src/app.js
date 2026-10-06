const express = require('express');
const multer = require('multer');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const createDocumentRepository = require('./repositories/documentRepository');
const createDocumentService = require('./services/documentService');
const createDocumentController = require('./controllers/documentController');
const createDocumentRouter = require('./routes/documentRoutes');

const app = express();
const PORT = process.env.PORT || 3000;
const maxFileSize = Number(process.env.MAX_FILE_SIZE_BYTES ?? 10485760);

if (!Number.isSafeInteger(maxFileSize) || maxFileSize <= 0) {
  throw new Error('MAX_FILE_SIZE_BYTES deve ser um inteiro positivo.');
}

const repository = createDocumentRepository(
  process.env.DMS_STORAGE_DIR || path.resolve(__dirname, '../storage'),
);
const service = createDocumentService(repository);
const controller = createDocumentController(service);
const upload = multer({
  storage: multer.diskStorage({
    destination(req, file, callback) {
      repository.prepareStorage().then(
        (directory) => callback(null, directory),
        (error) => callback(error),
      );
    },
    filename(req, file, callback) {
      callback(null, randomUUID());
    },
  }),
  limits: { fileSize: maxFileSize, files: 1 },
});

app.use(express.json());
app.use(createDocumentRouter(controller, upload));

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`DMS backend ouvindo na porta ${PORT}`);
  });
}

module.exports = app;
