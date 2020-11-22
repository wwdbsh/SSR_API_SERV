const express = require("express");
const router = express.Router();
const db = require("./util/dbConnection");
const util = require("util");
const nodemailer = require("nodemailer");

router.post("/listBreakouts", async (req, res) => {
	const PARENT_ID = req.body.PARENT_ID;
	console.log("List breakouts", PARENT_ID);
	try {
		let results = []
		const q = util.format(	'SELECT chatroom_id, chatroom_name ' +
									'FROM view_chatroom_info ' +
									'WHERE parent_chatroom_id = %d ' +
									'ORDER BY chatroom_id ASC' 
									,PARENT_ID);	
		console.log(q);
		let [rows, fields, err] = await db.query(q);
		for (let i in rows) {
			let row = rows[i]
			results.push({
				"chatroom_id" : row.chatroom_id,
				"chatroom_name" : row.chatroom_name
			})
		}
		res.status(200).json({
			"RESULT" : "SUCCESS",
			"CONTENT" : results
		});
	} catch(e) {
		console.log(e)
		res.status(500).json({
			"RESULT" : "FAIL",
			"REASON" : e
			
		})
	}		
})

router.post("/createBreakout", async (req, res) => {
	const PARENT_ID = req.body.PARENT_ID;
	const BREAKOUT_NAME = req.body.BREAKOUT_NAME;
	try {
	const parentQuery = util.format(	'SELECT chatroom_type, classroom_id ' + 
										'FROM danechat.view_chatroom_info ' + 
										'WHERE chatroom_id = %d'
										, PARENT_ID)
	let [rows, fields, err] = await db.query(parentQuery)
	if(rows.length != 1) throw "Failure to look up parent"
	let row = rows[0]
	if(row.chatroom_type != 'primary') throw "Invalid parent chatroom type: " + rows.chatroom_type
	//parent chatroom is valid, continue
	
	const insertQuery = util.format(	'INSERT INTO danechat.chatroom ' +
										'(chatroom_name, chatroom_type_id, parent_chatroom_id, classroom_id) ' +
										'VALUES ' +
										'(?, 2, %d, %d)',
										PARENT_ID, row.classroom_id)										
	await db.query(insertQuery, BREAKOUT_NAME)									
	res.status(200).json({"RESULT" : "SUCCESS"})
	} catch (e) {
		res.status(500).json({
			"RESULT" : "FAIL",
			"REASON" : e
		})
	}
})

module.exports = router;