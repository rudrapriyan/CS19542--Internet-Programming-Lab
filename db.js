const mysql = require('mysql2');

const db = mysql.createConnection({
  host: '172.21.64.1',  
  port: 3306,
  user: 'rudra',        
  password: 'rudra@1',  
  database: 'hostel'  
});


db.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL:', err);
    return;
  }
  console.log('Connected to MySQL database');
});

module.exports = db;