const AWS = require('aws-sdk');
const fs = require('fs');
const sharp = require('sharp');

const s3 = new AWS.S3({
    endpoint: process.env.ENDPOINT_URL,
    accessKeyId: process.env.VULTR_ACCESS_KEY,
    secretAccessKey: process.env.VULTR_SECRET_KEY,
    region: 'ap-south-1', 
    s3ForcePathStyle: true,
   // s3ForcePathStyle: true,
});
// upload file
const uploadFile = async (req, res) => {

    const file = req.file;

    if (!file) {
        return res.status(400).json({ message: 'No file uploaded.' });
    }
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

                    const params = {
                        Bucket: process.env.BUCKET_NAME,
                        Key: `${file.originalname}.webp`, // replace operation needed
                        Body: buffer,
                        ContentType: 'image/webp',
                    };

                    s3.upload(params, (err, data) => {
                        // Delete the temporary file after upload
                        fs.unlink(file.path, (err) => {
                            if (err) console.error('Unlink error', err);
                        });

                        console.log("Error", err);
                        if (err) {
                            return res.status(500).json({ message: 'Error uploading file to S3: ' + err.message });

                        }
                        res.status(200).send({ message: 'Image uploaded successfully', data });
                    });
                });
        } else if (file.mimetype === 'text/html') {
            // Handle html file upload
            const params = {
                Bucket: process.env.BUCKET_NAME,
                Key: `${Date.now()}_${file.originalname}`, // Keep original extension, unique file name needed
                Body: fs.createReadStream(file.path), // Use stream for larger files
                ContentType: 'text/html',
            };

            s3.upload(params, (err, data) => {
                // Delete the temporary file after upload
                fs.unlink(file.path, (err) => {
                    if (err) console.error('Unlink error', err);
                });

                if (err) {
                    return res.status(500).json({ message: 'Error uploading file to S3: ' + err.message });

                }
                res.status(200).send({ message: 'Image uploaded successfully', data });
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
        Bucket: process.env.BUCKET_NAME,
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
        Bucket: process.env.BUCKET_NAME,
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