
const Pocketbase = require('pocketbase/cjs');

const pb = new Pocketbase(process.env.DATASORCE_URL);

const getHTMLFileContent = async (collectionName, recordId) => {

    await authenticateAdmin();
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



const authenticateAdmin = async () => {


    const ADMIN_EMAIL = process.env.DATASOURCE_USERNAME;
    const ADMIN_PASSWORD = process.env.DATASOURCE_PASSWORD;

    //console.log('admin email',ADMIN_EMAIL);
    //console.log('admin-pass',ADMIN_PASSWORD);

    try {
        const authData = await pb.admins.authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);
        console.log('✅ Admin authenticated');
        return authData;
    } catch (err) {
        console.error("Admin authentication failed:", err.message);
    
    }
};

module.exports = {
    getHTMLFileContent,
    authenticateAdmin
};