# backend_ultimatehealth

# 🧠 Node.js Backend API

This is a Node.js + Express backend for managing articles, podcasts, users, edit requests, and analytics. It uses MongoDB for data storage and JWT for secure authentication.

---

## 🚀 Features

- ✅ Article CRUD with edit request workflows
- ✅ Podcast CRUD And Reviw Workflows
- ✅ JWT-protected routes  
- ✅ Admin analytics (monthly/yearly contributions)  
- ✅ Read/write activity tracking  
- ✅ Swagger UI for API documentation  
- ✅ Modular architecture (controllers, routes, models)

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
git clone https://github.com/your-username/your-backend-repo.git
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
