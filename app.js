const createError = require("http-errors");
const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const cors = require("cors");
require("dotenv").config();


const app = express();
const http = require("http");
const server = http.createServer(app);
const io = require("socket.io").listen(server);
require("./router/chatPage").socketio(io);

// router vars
const indexRouter = require("./router/index");
const loginPageRouter = require("./router/loginPage"); // 20200922 added
const signupPageRouter = require("./router/signupPage"); // 20200923 added
const adminPageRouter = require("./router/adminPage"); // 20200926 added
const chatPageRouter = require("./router/chatPage").ROUTER;
const chatRoomPageRouter = require("./router/chatroomPage");
const breakoutPageRouter = require("./router/breakoutPage");

app.set("views", path.join(__dirname, "/views"));
app.set("view engine", "ejs");
app.engine('html', require('ejs').renderFile);

app.use(cors());
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "public")));
app.use((req, res, next) => {
    req.io = io;
    next();
});

// combining routers
app.use("/", indexRouter);
app.use("/loginPage", loginPageRouter);
app.use("/signupPage", signupPageRouter);
app.use("/adminPage", adminPageRouter);
app.use("/chatPage", chatPageRouter);
app.use("/chatroomPage", chatRoomPageRouter);
app.use("/breakoutPage", breakoutPageRouter);

// catch 404 and forward to error handler
app.use((req, res, next) => {
    next(createError(404));
});

server.listen(process.env.PORT || 4000, () => {
    console.log("Server is running.");
});

module.exports = app;