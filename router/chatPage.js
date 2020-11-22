const express = require("express");
const router = express.Router();
const path = require("path");
const db = require("./util/dbConnection");
const util = require("util");
const cFunc = require("./util/commFunc");
const limit = 250
const AWS = require("aws-sdk");
AWS.config.loadFromPath(__dirname + "/awsConfig.json");
let s3 = new AWS.S3();
const multer = require("multer");
const multerS3 = require("multer-s3");
const uploader = multer({
    storage:multerS3({
        s3:s3,
        bucket:"csi518teamproject",
        key: function(req, file, cb){
            const extension = path.extname(file.originalname);
            cb(null, Date.now().toString() + extension);
        },
        acl:"public-read"
    })
});

router.get("/", (req, res) => {
    res.send("chat page");
});

async function getMessages(res, chatroom_id, message_id, isAfter, asc) {
	try {
		const messageQuery = util.format(	'SELECT message_id, name, message, post_time, file_flag ' + 
											'FROM danechat.view_message_user ' +
											'WHERE chatroom_id = %d ' +
											'AND message_id %s %d ' +
											'ORDER BY message_id %s ' +
											'LIMIT %d',
										chatroom_id, isAfter ? '>' : '<', message_id, asc ? "ASC" : "DESC", limit);
			let [rows, field, error] = await db.query(messageQuery);
			let results = []
			//generate results
			await Promise.all(rows.map(async (row) => {
				let result = {}
				let tags = []
				//get tags
				const tagQuery = util.format('SELECT tag FROM danechat.view_message_tag WHERE message_id = %d', row.message_id)
				let [tagRows, tagField, tagError] = await db.query(tagQuery);
				tagRows.forEach(function(trow) {
					tags.push(trow.tag)
				})
				if(row.file_flag === "true"){
					const strQuery = `SELECT path FROM danechat.uploads WHERE message_id=${row.message_id}`;
					const [rows2, field2, error2] = await db.query(strQuery);
					if(rows2.length !== 0){
						result.file_path = rows2[0].path;
					}
				}
				//create results entry
				result.tags = tags;
				result.username = row.name;
				result.message = row.message;
				result.message_id = row.message_id;
				result.post_time = row.post_time;
				result.file_flag = row.file_flag;
				results.push(result);
			}))
		results.sort((a, b) => a.message_id - b.message_id);
		res.status(200).json({
			"RESULT" : "SUCCESS",
			"CONTENT" : results,
			"CHATROOM_ID" : chatroom_id
		})
	} catch(e) {
		res.status(500).json({"RESULT" : "FAIL"})
	}
	res.end()
}
router.post("/getMessages", async (req, res) => {
    getMessages(res, req.body.CHATROOM_ID, 0, true, false);
});
router.post("/getOlderMessages", async (req, res) => {
	getMessages(res, req.body.CHATROOM_ID, req.body.MESSAGE_ID, false, false);
});
router.post("/getNewerMessages", async (req, res) => {
	getMessages(res, req.body.CHATROOM_ID, req.body.MESSAGE_ID, true, true);
});

function extractTags(message) {
	let re = /#[a-zA-Z_]+/g
	let matches = message.toLowerCase().match(re)
	if(matches == null) return {}
	return matches.map((s) => s.substring(1));
}
async function submitTags(tags) {
	for (var i in tags) {
		let tag = tags[i];
		let insertQuery = util.format('INSERT IGNORE INTO danechat.tags (tag) VALUES ("%s")', tag);
		await db.query(insertQuery)
	}
}

async function getTagIds(tags) {
	let out = {}
	for (var i in tags) {
		let tag = tags[i];
		
		let selectQuery = util.format('SELECT tag_id FROM danechat.tags WHERE tag = "%s"', tag)
		
		let [rows, field, error] = await db.query(selectQuery)
		out[tag] = rows[0].tag_id
	}
	return out
}
async function sendMessage(user_id, chatroom_id, message, file_flag) {
	let tags = extractTags(message)
	await submitTags(tags)
	let tagIds = await getTagIds(tags)
	const postMessageQuery = util.format('INSERT INTO danechat.message (chatroom_id, user_id, file_flag, message) VALUES (%d, %d, "%s", ?)', chatroom_id, user_id, file_flag);
	await db.query(postMessageQuery, message)
	//const getIdQuery = "SELECT LAST_INSERT_ID();" //this isn't working for some reason
	const getIdQuery = util.format('SELECT message_id FROM danechat.message WHERE user_id = %d ORDER BY message_id DESC LIMIT 1;', user_id)
	let [rows, fields, err] = await db.query(getIdQuery);
	let message_id = rows[0].message_id;
	for (var i in tagIds) {
		const tagQuery = util.format('INSERT INTO danechat.is_tagged (tag_id, message_id) VALUES (%d, %d)', tagIds[i], message_id);
		await db.query(tagQuery)
	}
	return message_id;
}
router.post("/sendMessage", async (req, res) => {
	try {
		sendMessage(req.body.USER_ID, req.body.CHATROOM_ID, req.body.MESSAGE)
		res.status(200).json({"RESULT" : "SUCCESS"})
	}
	catch (e) {
		res.status(500).json({"RESULT" : "FAIL"})
	}
});

/* 20201019 sangheonlee
PARAMETER = [ROOM_ID:ROOM_ID(INT)] */
router.post("/getAllMsgByRoomId", async (req, res) => {
	const ROOM_ID = req.body.ROOM_ID;
	const strQuery = `SELECT * FROM danechat.message WHERE chatroom_id=${ROOM_ID};`;
	try{
		const rt = [];
		const [row, field, error] = await db.query(strQuery);
		const simplifyJSON = (e) => {
			return {
				MSG_ID:e.message_id,
				CHATROOM_ID:e.chatroom_id,
				USER_ID:e.user_id,
				MESSAGE:e.message,
				POST_TIME:e.post_time,
			};
		};
		row.forEach((e) => {
		  rt.push(simplifyJSON(e));
		})
		console.log("status 200 createNewChatRoom");
		res.status(200).json({
			RESULT:"SUCCESS",
			ALL_MESSAGES:rt		
		});
	}catch(e){
		console.log(e);
		cFunc.failResponse(res, {RESULT:"FAIL", REASON:"GET MSG FAILED"})
	}
	res.end();
});

/* 20201019 sangheonlee*/
router.post("/upload", uploader.single("file"), async (req, res) => {
	const S3_URL = (req.file !== undefined) ? req.file.location: "";
	const USER_NAME = req.body.username;
	const MSG_ID = req.body.message_id;
	const strQuery = `INSERT INTO danechat.uploads (message_id, path, name, thumbnail_path) VALUES(${MSG_ID}, '${S3_URL}', '${USER_NAME}', '_')`;
	console.log(req.file);
	try{
		await db.query(strQuery);
		console.log("status 200 upload");
		res.status(200).json({RESULT:"SUCCESS", FILE_PATH:S3_URL});
		// 업로드 후 바로 다운로드 링크 보내기
	}catch(e){
		console.log(e);
		cFunc.failResponse({RESULT:"FAIL", REASON:"UPLOAD FAILED"})
	}
	res.end();
});

/* 20201106 sangheonlee */
router.post("/download", async (req, res) => {
	const MSG_ID = req.body.MSG_ID;
	while(true){
		console.log("Waiting for upload");	
		try{
			const strQuery = `SELECT * FROM danechat.uploads WHERE message_id='${MSG_ID}';`;
			const [rows, fields, errors] = await db.query(strQuery);
			if(rows.length !== 0){
				console.log("status 200 download");
				res.status(200).json({RESULT:"SUCCESS", FILE_PATH:rows[0].path});
				break;
			}
		}catch(e){
			console.log(e);
			// cFunc.failResponse({RESULT:"FAIL", REASON:"DOWNLOAD FAILED"})
		}
	}
	res.end();
});

/* 20201016 sangheonlee
 	socket */
module.exports = {
	socketio: async (io) => {
		const [r, f, e] = await db.query("SELECT * FROM danechat.chatroom;");
		let usernames = {};
		let useremails = [];
		let roomId = {};
		let rooms = [];
		try{
			// get existing chatroom list
			for(let v in r){
				const room_name = r[v].chatroom_name;
				const room_id = r[v].chatroom_id;
				roomId[room_id] = room_id;
				rooms.push({ROOM_NAME:room_name, ROOM_ID:room_id});
			}
			console.log(roomId);
			io.sockets.on("connection", socket => {

				console.log("SERVER: connecting to client");
				console.log("########ACTIVE USER########");
				console.log(usernames);
				console.log("###########################");
				// respond to "sendchat"
				socket.on("sendchat", async (data, fileFlag) => {
					console.log("SERVER: responding to sendchat");
					console.log(socket.user_id, socket.username, socket.email, socket.room, roomId[socket.room], data);
					try{
						const message_id = await sendMessage(socket.user_id, roomId[socket.room], data, fileFlag);
						if(fileFlag === "true"){
							io.sockets.in(socket.room).emit("updatefilechat", socket.username, socket.email, data, fileFlag, message_id);
						}else{
							io.sockets.in(socket.room).emit("updatechat", socket.username, socket.email, data, fileFlag);
						}
					}catch(e){
						console.log("###############################\n"+
						"socket sendchat error\n" + e + 
						"\n###############################");
					}
				});

				// respond to adduser
				socket.on("adduser", async (user_email) => {
					console.log("SERVER: responding to adduser");
					if(useremails.includes(user_email)){
						console.log("SERVER: aleary logined");
						// return ;
					}
					const strQuery = [
						`SELECT user_id FROM danechat.user_login WHERE email='${user_email}';`,
						"SELECT name FROM danechat.user WHERE user_id=%d;"
					];
					try{
						const [row1, field1, error1] = await db.query(strQuery[0]);
						const [row2, field2, error2] = await db.query(util.format(strQuery[1], row1[0].user_id));
						socket.user_id = row1[0].user_id;
						socket.username = row2[0].name;
						socket.email = user_email;
						useremails.push(user_email);
						usernames[row2[0].name] = row2[0].name;
						console.log("########ACTIVE USER########");
						console.log(usernames);
						console.log("###########################");
						socket.emit("senduserid", socket.user_id);
					}catch(e){
						console.log("###############################\n"+
						"socket adduser error\n" + e + 
						"\n###############################");
					}
				});

				// temp. may be deleted later
				socket.on("requestsenduserid", (user_id) => {
					console.log("SERVER: responding to requestsenduserid");
					socket.emit("senduserid", user_id);
				});

				// respond to switchroom
				socket.on("switchroom", (newroom) => {
					if(socket.room === newroom) return;
					console.log("SERVER: responding to switchroom");
					// leave current room
					socket.leave(socket.room);
					// join new room
					socket.join(newroom);
					// socket.emit("updatechat", "SERVER", undefined, "you have connected to " + newroom);
					socket.broadcast.to(socket.room).emit("updatechat", "SERVER", undefined, socket.username + " has left this room", "false");
					socket.room = newroom;
					socket.broadcast.to(newroom).emit("updatechat", "SERVER", undefined, socket.username + " has joined this room", "false");
				});

				// listener function to handle when a user disconnects
				socket.on("disconnect", () => {
					console.log("SERVER: responding to disconnect");
					delete usernames[socket.username];
					io.sockets.emit("updateusers", usernames);
					if(socket.room === undefined) return ;
					socket.broadcast.to(socket.room).emit("updatechat", "SERVER", undefined, socket.username + " has disconnected", "false");
					socket.leave(socket.room);
					socket.room = undefined;
				});

				socket.on("logout", () => {
					console.log("SERVER: responding to logout");
					delete usernames[socket.username];
					io.sockets.emit("updateusers", usernames);
					console.log("########ACTIVE USER########");
					console.log(usernames);
					console.log("###########################");
					if(socket.room === undefined) return ;
					socket.broadcast.to(socket.room).emit("updatechat", "SERVER", undefined, socket.username + " has left", "false");
					socket.leave(socket.room);
					socket.room = undefined;
				});

				socket.on("sendsignalnewuser", () => {
					console.log("SERVER: responding to sendsignalnewuser");
					socket.emit("updateuserlistofdashboard");
				});

				// respond to createroom
				socket.on("createclassroom", async (classroom_title, chatroom_title) => {
					console.log("SERVER: responding to createclassroom");
					if(rooms.includes(chatroom_title) || chatroom_title === ""){
						socket.emit("room_name_duplicated", chatroom_title === "" ? true : false);
						return ;
					}
					// requires
					const strQuery = [
						`INSERT INTO danechat.classroom (classroom_name) VALUES('${classroom_title}');`,
						`SELECT classroom_id FROM danechat.classroom WHERE classroom_name='${classroom_title}';`,
						`INSERT INTO danechat.chatroom (chatroom_name, chatroom_type_id, classroom_id) VALUES('${chatroom_title}', 1, %d);`,
						`SELECT chatroom_id FROM danechat.chatroom WHERE chatroom_name='${chatroom_title}';`,
					];
					try{
						await db.query(strQuery[0]);
						let [rows, field, error] = await db.query(strQuery[1]);
						const classroom_id = rows[0].classroom_id;
						await db.query(util.format(strQuery[2], classroom_id));
						[rows, field, error] = await db.query(strQuery[3]);
						const chatroom_id = rows[0].chatroom_id
						roomId[chatroom_id] = chatroom_id;
						// rooms.push({room_title});
						// socket.room = room_title;
						// socket.join(room_title);
						// socket.emit("updatechat", "SERVER", `you have connected to ${room_title}`);
						// socket.broadcast.to(room_title).emit("updatechat", "SERVER", socket.username + " has connected to this room");
						socket.emit("updaterooms", classroom_title, chatroom_title, classroom_id, chatroom_id);
					}catch(e){
						console.log("###############################\n"+
						"createroom socket error\n" + e + 
						"\n###############################");
					}
				});

				// respond to exitroom
				socket.on("exitroom", () => {
					console.log("SERVER: responding to exitroom");
					const r = socket.room;
					socket.leave(socket.room);
					socket.broadcast.to(r).emit("updatechat", "SERVER", socket.username + " has left this room");
					socket.room = undefined;
				});

				// respond to refresh_room_list
				socket.on("refresh_room_list", () => {
					socket.emit("updaterooms", rooms, socket.room);
				});
			});
		}catch(e){
			console.log("###############################\n"+
						"socket connection failed\n" + e + 
						"\n###############################");
		}
	},
	ROUTER:router
}