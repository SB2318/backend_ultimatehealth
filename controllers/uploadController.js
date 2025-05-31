//const AWS = require('aws-sdk');
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const axios = require('axios');
const sharp = require('sharp');
const path = require('path');
const os = require('os');
const Pocketbase = require('pocketbase/cjs');
const expressAsyncHandler = require('express-async-handler');
const getHTMLFileContent = require('../utils/pocketbaseUtil');

require('dotenv').config();

const s3Client = new S3Client({
    region: 'ap-south-1',
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

/** Pocketbase work */

const uploadFileToPocketBase = expressAsyncHandler(

    async (req, res) => {
        try {
            
            const { record_id, title } = req.body;
            const file = req.file;

            if (!file) {
                return res.status(400).send({ message: 'No file uploaded' });
            }

            const formData = new FormData();
            formData.append('title', title);
            formData.append('html_file', fs.createReadStream(file.path), file.originalname);

            let record;
            if (record_id) {
                record = await pb.collection('content').update(record_id, formData);

                if(!record){
                    return res.status(404).json({ message: 'Record not found' });
                }
            }
            else {
                record = await pb.collection('content').create(formData);
            }

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
            const id = req.params.id;
            const result = await getHTMLFileContent('content', id);
            //const record = await pb.collection('content').getOne(id);
            //const htmlFileUrl = pb.getFileUrl(record, record.html_file);

            //const response = await fetch(htmlFileUrl);
            //const htmlContent = await response.text();

            return res.status(200).json(result);
        } catch (err) {
            console.log("Error getting file from pocketbase:", err);
            return res.status(500).json({ message: 'Internal server error' });
        }
    }
)

const uploadImprovementFileToPocketbase = expressAsyncHandler(
    async (req, res) => {

        const { record_id, user_id, article_id, improvement_id } = req.body;
        const file = req.file;

        if (!user_id || !article_id || !improvement_id || !file) {
            return res.status(400).json({ message: 'Missing required fields: user_id, article_id, improvement_id, file' });
        }

        try {

            const formData = new FormData();
            formData.append('user_id', user_id);
            formData.append('article_id', article_id);
            formData.append('improvement_id', improvement_id);
            formData.append('edited_html_file', fs.createReadStream(file.path), file.originalname);

            let record;
            if (record_id) {
                record = await pb.collection('edit_requests').update(record_id, formData);

                if(!record){
                    return res.status(404).json({ message: 'Record not found' });
                }
            }
            else {
                record = await pb.collection('edit_requests').create(formData);
            }

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

const publishImprovementFileFromPocketbase = expressAsyncHandler(
    async (req, res) =>{
     
         const {record_id, article_id} = req.body;

         if(!record_id || !article_id){
            return res.status(400).json({message: 'Missing required fields: record_id, article_id'});
         }

         try{

            const improvementRecord = await pb.collection('edit_requests').get(record_id);

            if(!improvementRecord || !improvementRecord.edited_html_file){
                return res.status(404).json({ message: 'Record not found' });
            }

            const fileUrl = pb.files.getUrl(improvementRecord, improvementRecord.edited_html_file, { download: true });
            const tempFilePath = path.join(os.tempdir(), improvementRecord.edited_html_file);
            
            const response = await axios.get(fileUrl, { responseType: 'stream' });
            const writer = fs.createWriteStream(tempFilePath);

            await new Promise((resolve, reject)=>{
                response.data.pipe(writer);
                writer.on('finish', resolve);
                writer.on('error', reject);
            });

            // Prepare formdata to upload to pocketbase
            const formData = new FormData();
            formData.append('html-file', fs.createReadStream(tempFilePath));

            await pb.collection('content').update(article_id, formData);

            fs.unlinkSync(tempFilePath);
            
            // delete record
            await pb.collection('edit_requests').delete(record_id);

            return res.status(200).json({ message: 'Improvement published successfully' });
            

         }catch(err){
            console.log("Error publishing improvement file from pocketbase:", err);
            return res.status(500).json({message: 'Internal server error'});
         }
    }
)

const getIMPFile = expressAsyncHandler(

    async (req, res) => {

        try {
            const id = req.params.id;

            const result = await getHTMLFileContent('edit_requests', id);
            //const record = await pb.collection('content').getOne(id);
            //const htmlFileUrl = pb.getFileUrl(record, record.html_file);

            //const response = await fetch(htmlFileUrl);
            //const htmlContent = await response.text();

            return res.status(200).json(result);
        } catch (err) {
            console.log("Error getting file from pocketbase:", err);
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
    publishImprovementFileFromPocketbase
};