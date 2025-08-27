
const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'API Documentation- UltimateHealth',
      version: '1.0.0',
    },
    servers: [{ url: 'http://localhost:8082' }],
  },
  apis: ['./routes/*.js'], 
};

module.exports = swaggerJsdoc(options);
