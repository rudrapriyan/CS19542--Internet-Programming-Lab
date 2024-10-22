const mysql = require('mysql2');
require('dotenv').config()

const db = mysql.createConnection({
  host: process.env.HOST,  
  port: process.env.DB_PORT,
  user: process.env.USER,        
  password: process.env.PASSWORD,  
  database: process.env.DB  
});


db.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL:', err);
    return;
  }
  console.log('Connected to MySQL database');
});

module.exports = db;