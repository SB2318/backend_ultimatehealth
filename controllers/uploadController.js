//const AWS = require('aws-sdk');
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const sharp = require('sharp');
const path = require('path');
const Pocketbase = require('pocketbase/cjs');
const expressAsyncHandler = require('express-async-handler');

require('dotenv').config();

const s3Client = new S3Client({
    region: 'eu-north-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

const pb = new Pocketbase(process.env.DATASORCE_URL);


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
                        Bucket: 'ultimatehealth-01',
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
                Bucket: 'ultimatehealth-01',
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
                Bucket: 'ultimatehealth-01',
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
        Bucket: 'ultimatehealth-01',
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
        Bucket: 'ultimatehealth-01',
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

/** Pocketbase work */

const uploadFileToPocketBase = expressAsyncHandler(

    async (req, res) => {
        try {
            const { title } = req.body;
            const file = req.file;

            const formData = new FormData();
            formData.append('title', title);
            formData.append('html_file', fs.createReadStream(file.path), file.originalname);

            const record = await pb.collection('content').create(formData);

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

const getPbFile = expressAsyncHandler(
    async (req, res) => {

        try {
            const  id = req.params.id;
            const record = await pb.collection('content').getOne(id);
            const htmlFileUrl = pb.getFileUrl(record, record.html_file);

            const response = await fetch(htmlFileUrl);
            const htmlContent = await response.text();

            return res.status(200).json({htmlContent: htmlContent, fileName: record.html_file});
        } catch (err) {
            console.log("Error getting file from pocketbase:", err);
            return res.status(500).json({ message: 'Internal server error' });
        }
    }
)

const uploadImprovementToPocketBase = expressAsyncHandler(

    async (req, res) => {
        try {
            const { title } = req.body;
            const file = req.file;

            const formData = new FormData();
            formData.append('title', title);
            formData.append('html_file', fs.createReadStream(file.path), file.originalname);

            const record = await pb.collection('content').create(formData);

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

module.exports = {
    uploadFile,
    getFile,
    deleteFile,
    uploadFileToPocketBase,
    getPbFile
};