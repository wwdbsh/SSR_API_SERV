const express = require("express");
const router = express.Router();
const db = require("./util/dbConnection");
const util = require("util");
const cFunc = require("./util/commFunc");
const nodemailer = require("nodemailer");
const limit = 25

router.get("/", (req, res) => {
    res.send("chatroom page");
});

router.post("/joinRoomByRoomId", async (req, res) => {
    joinRoomByRoomId(req.body.USER_EMAIL, req.body.CHATROOM_ID, res);
});

router.get("/getClassrooms", async (req, res) => {
    getClassrooms(res);
});

router.get("/getChatrooms", async (req, res) => {
    getChatrooms(res);
});

router.post("/searchChatroomsByName", async (req, res) => {
    searchChatroomsByName(req.body.SEARCH_NAME, res);
});

router.post("/getChatroomsByUserId", async (req, res) => {
    getChatroomsByUserId(res, req.body.USER_ID);
});
router.post("/getBansByUserId", async (req, res) => {
    getBansByUserId(res, req.body.USER_ID);
});

/* 20201119 sangheonlee
 PARAMETER = [ROOM_ID:ROOM_ID, FG:FG, BG:BG, BANNER_URL:BANNER_URL] */
router.post("/setClassroomThemeByRoomId", async (req, res) => {
	const ROOM_ID = req.body.ROOM_ID;
	const FG = req.body.FG;
	const BG = req.body.BG;
	const BANNER_URL = req.body.BANNER_URL;
	try{
		const strQuery = [
			`SELECT theme_id FROM danechat.theme WHERE classroom_id=${ROOM_ID};`,
			`INSERT INTO danechat.theme (classroom_id, primary_color, secondary_color) VALUES(${ROOM_ID},'${FG}','${BG}');`,
			`UPDATE danechat.theme SET primary_color='${FG}', secondary_color='${BG}' WHERE classroom_id=${ROOM_ID};`,
			`UPDATE danechat.classroom SET banner_url='${BANNER_URL}', theme_id=%d WHERE classroom_id=${ROOM_ID};`
		];
		let [rows, field, error] = await db.query(strQuery[0]);
		if(rows.length === 0){
			await db.query(strQuery[1]);
			[rows, field, error] = await db.query(strQuery[0]);
		}else{
			await db.query(strQuery[2]);
		}
		await db.query(util.format(strQuery[3], rows[0].theme_id));
		console.log("status 200 setClassroomThemeByRoomId");
		res.status(200).json({RESULT:"SUCCESS"});
	}catch(e){
		console.log(e);
		cFunc.failResponse(res, {RESULT:"FAIL", REASON:"FAILED"})
	}
	res.end();
});

/* 20201019 sangheonlee
 PARAMETER = [ROOM_NAME:ROOM_NAME(STRING)] */
router.post("/createNewChatRoom", async (req, res) => {
	const ROOM_NAME = req.body.ROOM_NAME;
	const strQuery = [
		"SELECT chatroom_name FROM danechat.chatroom;",
		`INSERT INTO danechat.chatroom (chatroom_name, chatroom_type_id, classroom_id) VALUES('${ROOM_NAME}', 2, 1);`
	];
	try{
		let [row, field, error] = await db.query(strQuery[0]);
		row = row.map(obj => obj.chatroom_name);
		if(row.includes(ROOM_NAME)){
			cFunc.failResponse(res, {RESULT:"FAIL", REASON:"ROOM NAME DUPLICATED"})	
		}else{
			await db.query(strQuery[1]);
			console.log("status 200 createNewChatRoom");
			res.status(200).json({
				RESULT:"SUCCESS",
				ROOM_NAME:ROOM_NAME
			});
		}
	}catch(e){
		
		console.log(e);
		cFunc.failResponse(res, {RESULT:"FAIL", REASON:"CREATE ROOM FAILED"})
	}
	res.end();
});

async function joinRoomByRoomId(user_email, chatroom_id, res) {
	try {
		const chatroomQuery = `insert into is_member values ((select user_id from user_login where email = "${user_email}"), ${chatroom_id});`;
		await db.query(chatroomQuery);
		res.status(200).json({
			"RESULT" : "SUCCESS",
			"USER_EMAIL" : user_email,
			"CHATROOM_ID" : chatroom_id
		})
	} catch(e) {
		console.log(e);
		res.status(500).json({"RESULT" : "FAIL"})
	}
	res.end()
}

async function getClassrooms(res) {
	try {
		const classroomQuery = `select classroom_id, classroom_name, banner_url, classroom.theme_id, primary_color, secondary_color 
			from classroom left join theme on classroom.theme_id = theme.theme_id;`;
		let [rows, field, error] = await db.query(classroomQuery);
		let classrooms = []
		
		await Promise.all(rows.map(async (row) => {
			let classroom = {}
			classroom.classroom_id = row.classroom_id;
			classroom.classroom_name = row.classroom_name;
			classroom.banner_url = row.banner_url;
			classroom.theme_id = row.theme_id;
			classroom.primary_color = row.primary_color;
			classroom.secondary_color = row.secondary_color;
			
			classrooms.push(classroom);
		}))
		res.status(200).json({
			"RESULT" : "SUCCESS",
			"CONTENT" : classrooms
		})
	} catch(e) {
		console.log(e);
		res.status(500).json({"RESULT" : "FAIL"})
	}
	res.end()
}

async function getChatrooms(res) {
	try {
		const chatroomQuery = `select chatroom_id, chatroom_name, chatroom_type, parent_chatroom_id, classroom_id 
			from chatroom, chatroom_type 
			where chatroom.chatroom_type_id = chatroom_type.chatroom_type_id;`;

		let [rows, field, error] = await db.query(chatroomQuery);
		let chatrooms = []
		
		await Promise.all(rows.map(async (row) => {
			let chatroom = {}
			
			chatroom.chatroom_id = row.chatroom_id;
			chatroom.chatroom_name = row.chatroom_name;
			chatroom.chatroom_type = row.chatroom_type;
			chatroom.parent_chatroom_id = row.parent_chatroom_id;
			chatroom.classroom_id = row.classroom_id;
			
			chatrooms.push(chatroom);
		}))
		res.status(200).json({
			"RESULT" : "SUCCESS",
			"CONTENT" : chatrooms
		})
	} catch(e) {
		console.log(e);
		res.status(500).json({"RESULT" : "FAIL"})
	}
	res.end()
}

async function searchChatroomsByName(search_name, res) {
	try {
		const chatroomQuery = `select chatroom_id, chatroom_name, chatroom_type, parent_chatroom_id, classroom_id 
			from chatroom, chatroom_type 
			where chatroom.chatroom_type_id = chatroom_type.chatroom_type_id 
			and chatroom.chatroom_name like "%${search_name}%";`;

		let [rows, field, error] = await db.query(chatroomQuery);
		let chatrooms = []
		
		await Promise.all(rows.map(async (row) => {
			let chatroom = {}
			
			chatroom.chatroom_id = row.chatroom_id;
			chatroom.chatroom_name = row.chatroom_name;
			chatroom.chatroom_type = row.chatroom_type;
			chatroom.parent_chatroom_id = row.parent_chatroom_id;
			chatroom.classroom_id = row.classroom_id;
			
			chatrooms.push(chatroom);
		}))
		res.status(200).json({
			"RESULT" : "SUCCESS",
			"CONTENT" : chatrooms
		})
	} catch(e) {
		console.log(e);
		res.status(500).json({"RESULT" : "FAIL"})
	}
	res.end()
}

async function getChatroomsByUserId(res, user_id) {
	try {
		const chatroomQuery = `select chatroom_id, chatroom_name, chatroom_type, parent_chatroom_id, classroom_id
			from chatroom, chatroom_type 
			where chatroom_id in (select chatroom_id from is_member_view where user_id = ${user_id})
			 and chatroom.chatroom_type_id = chatroom_type.chatroom_type_id;`;
		let [rows, field, error] = await db.query(chatroomQuery);
		const chatrooms = []
		await Promise.all(rows.map(async (row) => {
			let chatroom = {}
			
			chatroom.chatroom_id = row.chatroom_id;
			chatroom.chatroom_name = row.chatroom_name;
			chatroom.chatroom_type = row.chatroom_type;
			chatroom.parent_chatroom_id = row.parent_chatroom_id;
			chatroom.classroom_id = row.classroom_id;
			
			chatrooms.push(chatroom);
		}))
		console.log("status 200 getChatroomsByUserId")
		res.status(200).json({
			"RESULT" : "SUCCESS",
			"CONTENT" : chatrooms
		})
	} catch(e) {
		console.log(e);
		res.status(500).json({"RESULT" : "FAIL"})
	}
	res.end()
}
async function getBansByUserId(res, user_id) {
	try {
		const banQuery = 'select chatroom_id from is_banned where user_id = ?'
		let [rows, field, error] = await db.query(banQuery, user_id);
		const results = []
		await Promise.all(rows.map(async (row) => {
			results.push(row.chatroom_id);
		}))
		console.log("status 200 getBansByUserId")
		res.status(200).json({
			"RESULT" : "SUCCESS",
			"CONTENT" : results
		})
	} catch(e) {
		console.log(e);
		res.status(500).json({"RESULT" : "FAIL"})
	}
	res.end()
}

module.exports = router;