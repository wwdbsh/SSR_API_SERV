const db = require("mysql2-promise")();
const config = require("./config");

db.configure({
    host: config.DB_HOST,
    user: config.DB_USER,
    port: config.DB_PORT,
    password: config.DB_PWD,
    database: config.DB_NAME
});

db.pool.on("connection", function (poolConnection) {
    poolConnection.config.namePlaceholders = true;
});

module.exports = db;