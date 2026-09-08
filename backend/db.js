require("dotenv").config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 4,
    queueLimit: 0,
    timezone: '-06:00',
});

pool.getConnection()
    .then(conn => { conn.release(); console.log("✅ Conectado a MySQL"); })
    .catch(err => console.error("❌ Error de conexión MySQL:", err.message));

module.exports = pool;
