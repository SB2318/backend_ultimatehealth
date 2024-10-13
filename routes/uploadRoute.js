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

module.exports = uploadRoute;

// Upload Profile Image

// Upload Article Image
// Case I -> ImageUtils, will added at the time of post creation
// Case II -> Article Image url will attached with content.
// Id review reject, then all the corresponding image will be deleted from storage.

// Upload Article Content
// Later
// Upload Audio
