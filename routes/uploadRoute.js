const multer = require('multer');
const express = require('express');
const controller = require('../controllers/uploadController');
const upload = multer({ dest: 'uploads/' }); 
const authenticateToken = require('../middleware/authentcatetoken');
const uploadRoute = express.Router();

// For Storage Server
uploadRoute.post('/upload-storage', upload.single('file'), controller.uploadFile);
uploadRoute.get('/getFile/:key', controller.getFile);
uploadRoute.delete('/deleteFile/:key',authenticateToken, controller.deleteFile);

/** Pocketbase */
uploadRoute.post('/upload-pocketbase/article', authenticateToken, upload.single('html_file'),controller.uploadFileToPocketBase);
uploadRoute.post('/upload-pocketbase/improvement', authenticateToken,  upload.single('edited_html_file'), controller.uploadImprovementFileToPocketbase);
uploadRoute.post('/publish-improvement-from-pocketbase', authenticateToken, controller.publishImprovementFileFromPocketbase);
uploadRoute.get('/get-pbf-file/:id', authenticateToken, controller.getPbFile);
uploadRoute.get('/get-imp-file/:id', authenticateToken, controller.getIMPFile);

   

module.exports = uploadRoute;


