const multer = require('multer');
const express = require('express');
const controller = require('../controllers/uploadController');
const upload = multer({ dest: 'uploads/' }); 
const authenticateToken = require('../middleware/authentcatetoken');
const adminAuthenticateToken = require("../middleware/adminAuthenticateToken");
const uploadRoute = express.Router();

// For Storage Server
uploadRoute.post('/upload-storage', upload.single('file'), controller.uploadFile);
uploadRoute.get('/getFile/:key', controller.getFile);
uploadRoute.delete('/deleteFile/:key',authenticateToken, controller.deleteFile);

/** Pocketbase */
uploadRoute.post('/upload-pocketbase/article', authenticateToken, controller.uploadFileToPocketBase);
uploadRoute.post('/upload-pocketbase/improvement', authenticateToken,  controller.uploadImprovementFileToPocketbase);
uploadRoute.post('/publish-improvement-from-pocketbase', adminAuthenticateToken, controller.publishImprovementFileFromPocketbase);
uploadRoute.get('/articles/get-article-content/:id', authenticateToken, controller.getPbFile);
uploadRoute.get('/articles/get-improve-content', authenticateToken, controller.getIMPFile);
uploadRoute.delete('/delete-improvement/:record_id', authenticateToken, controller.deleteImprovementRecordFromPocketbase);

   

module.exports = uploadRoute;


