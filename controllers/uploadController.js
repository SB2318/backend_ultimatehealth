const AWS = require('aws-sdk');
const fs = require('fs');
const sharp = require('sharp');
const path = require('path');
require('dotenv').config();


AWS.config.update({
    region: 'del1',
    accessKeyId: 'ML63B37UJQOADMJIXP80',
    hostname:"del1.vultrobjects.com",
    secretAccessKey: 'VLJ7mrnzSZdSj3Cxvx4cWm8svhtgOQJGYngtQ57Z',
    endpoint: 'https://del1.vultrobjects.com',
  });

const s3 = new AWS.S3();
// upload file
const uploadFile = async (req, res) => {

    const file = req.file;

    if (!file) {
        return res.status(400).json({ message: 'No file uploaded.' });
    }
    console.log("Here comessss", file);
    
    try {
        // Handle Image file upload
        if (file.mimetype.startsWith('image/')) {

            // Optimize storage, create buffer and convert image in one format 
            await sharp(file.path)
                .webp({ quality: 80 }) 
                .toBuffer((err, buffer) => {
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
                });
        } else if (file.mimetype === 'text/html') {
            // Handle html file upload
            const params = {
                Bucket: 'ultimatehealth-01',
                Key: `${file.originalname}`, // Keep original extension, unique file name needed
                Body: fs.createReadStream(file.path), // Use stream for larger files
                ContentType: 'text/html',
            };

            s3.putObject(params, (err, data) => {
                // Delete the temporary file after upload
                fs.unlink(file.path, (err) => {
                    if (err) console.error('Unlink error', err);
                });

                if (err) {
                    return res.status(500).json({ message: 'Error uploading file to S3: ' + err.message });

                }
                res.status(200).send({ message: 'Image uploaded successfully', key:`${file.originalname}` });
            });

        }
        else {
            // Handle other file types (e.g., PDF, CSV, etc.), as of now not needed
            return res.status(400).json({ message: 'Unsupported file type.' });
        }
    } catch (err) {
        console.log("Upload File Error", err);
        res.status(500).json({ message: "Failed to upload your file" });
    }
}

// get file
const getFile = async(req, res)=>{
    const params = {
        Bucket: 'ultimatehealth-01',
        Key: req.params.key,
    };

    s3.getObject(params, (err, data) => {
        if (err) {
            return res.status(404).send(err);
        }
        res.setHeader('Content-Type', data.ContentType);
        res.send(data.Body);
    });
}

// Delete File
// We will  not usually remove anything from bucket, we only remove it from our dataase
const deleteFile = async (req, res) => {
    const params = {
        Bucket: 'ultimatehealth-01',
        Key: req.params.key,
    };

    s3.deleteObject(params, (err, data) => {
        if (err) {
            return res.status(404).send(err);
        }
        res.status(200).send({ message: 'File deleted successfully' });
    });
};

module.exports = {
    uploadFile,
    getFile,
    deleteFile,
};