//const AWS = require('aws-sdk');
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const axios = require('axios');
const sharp = require('sharp');
const path = require('path');
const os = require('os');
const { FormData } = require('formdata-node')
const { fileFromPath } = require('formdata-node/file-from-path')
const expressAsyncHandler = require('express-async-handler');
const { getHTMLFileContent, authenticateAdmin, getPocketbaseClient } = require('../utils/pocketbaseUtil');

require('dotenv').config();

const s3Client = new S3Client({
    region: 'ap-south-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

//const pb = new Pocketbase(process.env.DATASORCE_URL);


// upload file
const uploadFile = async (req, res) => {

    const file = req.file;

    if (!file) {
        return res.status(400).json({ message: 'No file uploaded.' });
    }
    //console.log("Here comessss", file);

    try {
        // Handle Image file upload
        if (file.mimetype.startsWith('image/')) {

            // Optimize storage, create buffer and convert image in one format 
            await sharp(file.path)
                .webp({ quality: 80 })
                .toBuffer(async (err, buffer) => {
                    if (err) {
                        return res.status(500).send('Error processing image: ' + err.message);
                    }

                    const fileNameWithoutExt = path.basename(file.originalname, path.extname(file.originalname));
                    const params = {
                        Bucket: 'ultimate-health-new',
                        Key: `${fileNameWithoutExt}.webp`, // replace operation needed
                        Body: buffer,
                        ContentType: 'image/webp',
                    };

                    const command = new PutObjectCommand(params);
                    await s3Client.send(command);

                    /*
                    s3.putObject(params, (err, data) => {
                        // Delete the temporary file after upload
                        console.log(data);
                        fs.unlink(file.path, (err) => {
                            if (err) console.error('Unlink error', err);
                        });

                        console.log("Error", err);
                        if (err) {
                            return res.status(500).json({ message: 'Error uploading file to S3: ' + err.message });

                        }
                        res.status(200).send({ message: 'Image uploaded successfully', key: `${fileNameWithoutExt}.webp` });
                    });
                    */

                    fs.unlink(file.path, (err) => {
                        if (err) console.error('Unlink error', err);
                    });

                    res.status(200).send({ message: 'Image uploaded successfully', key: `${fileNameWithoutExt}.webp` });
                });
        } else if (file.mimetype === 'text/html') {
            // Handle html file upload
            const params = {
                Bucket: 'ultimate-health-new',
                Key: `${file.originalname}`, // Keep original extension, unique file name needed
                Body: fs.createReadStream(file.path), // Use stream for larger files
                ContentType: 'text/html; charset=UTF-8'
            };

            const command = new PutObjectCommand(params);
            await s3Client.send(command);

            fs.unlink(file.path, (err) => {
                if (err) console.error('Unlink error', err);
            });

            /*
            s3.putObject(params, (err, data) => {
                // Delete the temporary file after upload
                fs.unlink(file.path, (err) => {
                    if (err) console.error('Unlink error', err);
                });

                if (err) {
                    return res.status(500).json({ message: 'Error uploading file to S3: ' + err.message });

                }
               
            });
            */

            res.status(200).send({ message: 'Text or HTML uploaded successfully', key: `${file.originalname}` });
        }
        else if (file.mimetype === 'audio/mpeg') {
            // Handle MP3 file upload
            const params = {
                Bucket: 'ultimate-health-new',
                Key: `${file.originalname}`, // Keep original filename and extension
                Body: fs.createReadStream(file.path),
                ContentType: 'audio/mpeg',
            };

            const command = new PutObjectCommand(params);
            await s3Client.send(command);

            fs.unlink(file.path, (err) => {
                if (err) console.error('Unlink error', err);
            });
            /*
            s3.putObject(params, (err, data) => {
                fs.unlink(file.path, (err) => {
                    if (err) console.error('Unlink error', err);
                });

                if (err) {
                    return res.status(500).json({ message: 'Error uploading MP3 file to S3: ' + err.message });
                }
                res.status(200).send({ message: 'MP3 file uploaded successfully', key: `${file.originalname}` });
            });
            */

            res.status(200).send({ message: 'MP3 file uploaded successfully', key: `${file.originalname}` });
        } else {
            // Handle other file types (e.g., PDF, CSV, etc.), as of now not needed
            return res.status(400).json({ message: 'Unsupported file type.' });
        }
    } catch (err) {
        console.log("Upload File Error", err);
        res.status(500).json({ message: "Failed to upload your file" });
    }
}

// get file
const getFile = async (req, res) => {
    const params = {
        Bucket: 'ultimate-health-new',
        Key: req.params.key,
    };

    const command = new GetObjectCommand(params);

    try {
        const data = await s3Client.send(command);
        res.setHeader('Content-Type', data.ContentType);
        data.Body.pipe(res);
    } catch (err) {
        console.log("Error fetching file:", err);
        return res.status(404).send(err);
    }
}

// Delete File
// We will  not usually remove anything from bucket, we only remove it from our dataase
const deleteFile = async (req, res) => {
    const params = {
        Bucket: 'ultimate-health-new',
        Key: req.params.key,
    };

    const command = new DeleteObjectCommand(params);

    try {
        await s3Client.send(command);
        res.status(200).send({ message: 'File deleted successfully' });
    } catch (err) {
        console.log("Error deleting file:", err);
        return res.status(404).send(err);
    }
};

const deleteFileFn = async (url) => {
    const params = {
        Bucket: 'ultimate-health-new',
        Key: url,
    };
    const command = new DeleteObjectCommand(params);
    try {
        await s3Client.send(command);
    } catch (err) {
        console.log("Error deleting file:", err);
    }
};

/** Pocketbase work */

// User app
const uploadFileToPocketBase = expressAsyncHandler(

    async (req, res) => {
        try {

            const pb = await getPocketbaseClient();
            await authenticateAdmin(pb);
            const { record_id, title, htmlContent } = req.body;


            if (!title && !htmlContent) {
                return res.status(400).send({ message: 'Please provide title and htmlContent' });
            }

            // create html file
            const fileName = `${title?.replace(/\s+/g, '_') || 'file'}.html`;
            const filePath = path.join(os.tmpdir(), fileName);
            fs.writeFileSync(filePath, htmlContent, 'utf8');

            const formData = new FormData();
            formData.append('title', title || 'Untitled');
            const file = await fileFromPath(filePath);
            //const file = await filesFromPaths(filePath);
            //const [file] = await filesFromPaths([filePath])
            formData.append('html_file', file);



            let record;
            if (record_id) {
                record = await pb.collection('content').update(record_id, formData);

                if (!record) {
                    return res.status(404).json({ message: 'Record not found' });
                }
            }
            else {
                record = await pb.collection('content').create(formData);
            }

            fs.unlinkSync(filePath);
            return res.status(200).json({
                message: 'File uploaded successfully',
                recordId: record.id,
                html_file: record.html_file
            });
        } catch (err) {
            console.log("Error uploading file to pocketbase:", err);
            return res.status(500).json({
                message: 'Internal server error'
            });
        }
    }
)

// User & Admin
const getPbFile = expressAsyncHandler(
    async (req, res) => {

        try {

            const id = req.params.id;
            const result = await getHTMLFileContent('content', id);
            //const record = await pb.collection('content').getOne(id);
            //const htmlFileUrl = pb.files.getUrl(record, record.html_file);

            //const response = await fetch(htmlFileUrl);
            //const htmlContent = await response.text();

            return res.status(200).json(result);
        } catch (err) {
            console.log("Error getting file from pocketbase:", err);
            return res.status(500).json({ message: 'Internal server error' });
        }
    }
)

// User app
const uploadImprovementFileToPocketbase = expressAsyncHandler(
    async (req, res) => {

        const { record_id, user_id, article_id, title, improvement_id, htmlContent } = req.body;

        if (!user_id || !article_id || !improvement_id || !htmlContent || !title) {
            return res.status(400).json({ message: 'Missing required fields: user_id, article_id, improvement_id , htmlContent, title' });
        }

        try {

            const pb = await getPocketbaseClient();
            await authenticateAdmin(pb);
            const formData = new FormData();
            formData.append('user_id', user_id);
            formData.append('article_id', article_id);
            formData.append('improvement_id', improvement_id);

            // Create Html file
            const fileName = `${title?.replace(/\s+/g, '_') || 'file'}.html`;
            const filePath = path.join(os.tmpdir(), fileName);
            fs.writeFileSync(filePath, htmlContent, 'utf8');

            const file = await fileFromPath(filePath);
            formData.append('edited_html_file', file);

            let record;
            if (record_id) {
                record = await pb.collection('edit_requests').update(record_id, formData);

                if (!record) {
                    return res.status(404).json({ message: 'Record not found' });
                }
            }
            else {
                record = await pb.collection('edit_requests').create(formData);
            }

            fs.unlinkSync(filePath);

            return res.status(200).json({
                message: 'File uploaded successfully',
                recordId: record.id,
                html_file: record.edited_html_file
            });

        } catch (err) {
            console.log("Error uploading file to pocketbase:", err);
            return res.status(500).json({ message: 'Internal server error' });
        }
    }
)

// User & Admin
const getIMPFile = expressAsyncHandler(

    async (req, res) => {

        try {
            const { recordid, articleRecordId } = req.query;

            if (!recordid && !articleRecordId) {
                res.status(400).json({ message: 'Invalid request: missing recordid or articleRecordId' });
                return;
            }
            let result;
            if (recordid) {
                result = await getHTMLFileContent('edit_requests', recordid);
            } else {
                result = await getHTMLFileContent('content', articleRecordId);
            }


            return res.status(200).json(result);
        } catch (err) {
            console.log("Error getting file from pocketbase:", err);
            return res.status(500).json({ message: 'Internal server error' });
        }
    }
)

// Admin app
const publishImprovementFileFromPocketbase = expressAsyncHandler(
    async (req, res) => {

        const { record_id, article_id } = req.body;

        if (!record_id || !article_id) {
            return res.status(400).json({ message: 'Missing required fields: record_id, article_id' });
        }

        try {

            const pb = getPocketbaseClient();
            await authenticateAdmin(pb);
            const improvementRecord = await pb.collection('edit_requests').get(record_id);

            if (!improvementRecord || !improvementRecord.edited_html_file) {
                return res.status(404).json({ message: 'Record not found' });
            }

            const fileUrl = pb.files.getUrl(improvementRecord, improvementRecord.edited_html_file, { download: true });
            const tempFilePath = path.join(os.tmpdir(), improvementRecord.edited_html_file);

            const response = await axios.get(fileUrl, { responseType: 'stream' });
            const writer = fs.createWriteStream(tempFilePath);

            await new Promise((resolve, reject) => {
                response.data.pipe(writer);
                writer.on('finish', resolve);
                writer.on('error', reject);
            });

            // Prepare formdata to upload to pocketbase
            const formData = new FormData();

            const file = await fileFromPath(tempFilePath);
            formData.append('html_file', file);

            const record = await pb.collection('content').update(article_id, formData);

            fs.unlinkSync(tempFilePath);

            // delete record
            await pb.collection('edit_requests').delete(record_id);

            return res.status(200).json({
                message: 'Improvement published successfully',
                recordId: record.id,
                html_file: record.html_file
            });


        } catch (err) {
            console.log("Error publishing improvement file from pocketbase:", err);
            return res.status(500).json({ message: 'Internal server error' });
        }
    }
)

// Admin App

const deleteImprovementRecordFromPocketbase = expressAsyncHandler(
    async (req, res) => {

        const { record_id } = req.params;

        if (!record_id) {
            return res.status(400).json({ message: 'Missing required fields: record_id' });
        }
        try {

            const pb = getPocketbaseClient();
            await authenticateAdmin(pb);
            const improvementRecord = await pb.collection('edit_requests').get(record_id);

            if (!improvementRecord) {
                return res.status(404).json({ message: 'Record not found' });
            }

            // delete record
            await pb.collection('edit_requests').delete(record_id);

            return res.status(200).json({
                status: true,
                message: 'Improvement deleted successfully',
            });


        } catch (err) {
            console.log("Error deleteing improvement file from pocketbase:", err);
            return res.status(500).json({ message: 'Internal server error' });
        }
    }
)





module.exports = {
    uploadFile,
    getFile,
    deleteFile,
    uploadFileToPocketBase,
    getPbFile,
    getIMPFile,
    uploadImprovementFileToPocketbase,
    publishImprovementFileFromPocketbase,
    deleteImprovementRecordFromPocketbase,
    deleteFileFn
};