# backend_ultimatehealth

The repository is  the core engine powering the UltimateHealth platform. This backend service provides secure, and efficient APIs to support a seamless experience for users accessing trustable health resources and expert insights, built with Node js  and Express.✅💡. It uses MongoDB for data storage and JWT for secure authentication. 



---

## 🚀 Features

- 
  ### Article CRUD with edit request workflows 

  Managing content at scale requires a clear and controlled workflow to ensure quality, accuracy, and accountability. 
  This system outlines how articles are created, reviewed, and improved over time using a structured CRUD (Create, Read, Update, Delete) approach — enriched by an edit request mechanism, inspired by proven         practices at platforms like **GeeksforGeeks**.

    (a) Submit Article for Review Process
        To maintain content quality, all newly created articles must go through a structured review process before publication.

    (b) Review Article Management Flow
        Editors or reviewers assess submitted articles, provide feedback, and approve or reject them based on content standards and accuracy.

    (c) Contributor Edit Requests
       After publication, any contributor can propose edits to an article. With the consent of the Admin team, contributors are allowed to begin work on those changes.

    (d) Edit Request Review Management Flow
      Once submitted, edit requests undergo a separate review process where they are evaluated, approved, or rejected by the review team to ensure continued content quality.

  
   
- ### Podcast CRUD And Review Workflows
    (a) Submit Podcast audio for Review Process
        To maintain content quality, all newly created podcasts must go through a structured review process before publication.

- ### Report Management System for Content
   A robust reporting system helps maintain the integrity of a content platform by tracking violations, abusive behavior, and misuse of features.
  
- ✅ JWT-protected routes  
- ### Admin analytics (monthly/yearly contributions) 

- ✅ User Analytics (Read/write activity tracking) 
- ✅ Swagger UI for API documentation  
  

---

## 🛠 Tech Stack

- Node.js
- Express.js
- MongoDB + Mongoose
- JSON Web Token (JWT)
- Swagger (OpenAPI 3)
- dotenv

---

## ⚙️ Environment Variables

Create a `.env` file in the root:

```env
PORT=YOUR_PORT_HERE

MONGODB_URL= YOUR_DATABASE_URL_HERE
BASE_URL = SERVER_BASE_URL_HERE
JWT_SECRET= JWT_SECRET_KEY
EMAIL= EMAIL_ID
PASSWORD= MAIL_PASSWORD
SMTP_HOST= YOUR_MAIL_HOST
EMAIL_USER= YOUR_MAIL_ID
EMAIL_PASS= YOUR_MAIL_PASSWORD
BUCKET_NAME = 'YOUR_AWS_BUCKET_NAME';
ENDPOINT_URL = 'YOUR_ENDPOINT_URL';

```

## 🧑‍💻 Getting Started

1. Clone the repository
   
```
git clone https://github.com/SB2318/backend_ultimatehealth.git
cd your-backend-repo
```
2. Install dependencies
   
```
npm install
````

3. Run the server

```
 npm start
```

## 📚 API Documentation (Swagger)

### Swagger UI is available at:

```
http://localhost:8082/docs

```

### All protected routes require a Bearer token in the Authorization header.

```
Authorization: Bearer <your_jwt_token>

```

## Contributors
Available soon
