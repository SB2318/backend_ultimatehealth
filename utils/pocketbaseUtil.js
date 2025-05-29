
const Pocketbase = require('pocketbase/cjs');

const pb = new Pocketbase(process.env.DATASORCE_URL);

const getHTMLFileContent = async (collectionName, recordId) => {

    const record = await pb.collection(collectionName).getOne(recordId);

    if(!record){
       return { htmlContent: "Not found", fileName: "Not found" } 
    }

    const fileName = collectionName === 'content' ? record.html_file : record.edited_html_file;

    const htmlFileUrl = pb.getFileUrl(record, fileName);

    const response = await fetch(htmlFileUrl);
    const htmlContent = await response.text();

    return { htmlContent: htmlContent, fileName: fileName }
}

module.exports = getHTMLFileContent;