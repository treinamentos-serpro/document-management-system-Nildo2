const express = require('express');

function createDocumentRouter(controller, upload) {
  const router = express.Router();

  router.post('/upload', controller.requireOwner, (req, res, next) => {
    upload.single('file')(req, res, (error) => {
      if (!error) return next();
      if (error.code === 'LIMIT_FILE_SIZE') error.code = 'FILE_TOO_LARGE';
      else if (error.code === 'LIMIT_FILE_COUNT') error.code = 'TOO_MANY_FILES';
      else if (error.code?.startsWith('E')) error.code = 'STORAGE_ERROR';
      else error.code = 'INVALID_UPLOAD';
      next(error);
    });
  }, controller.upload);
  router.get('/documents', controller.requireOwner, controller.list);
  router.get('/documents/:id/download', controller.requireOwner, controller.download);
  router.use(controller.handleError);

  return router;
}

module.exports = createDocumentRouter;