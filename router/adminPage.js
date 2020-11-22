const express = require("express");
const router = express.Router();
const db = require("./util/dbConnection");
const config = require("./util/config");
const cFunc = require("./util/commFunc");
const util = require("util");

router.get("/", (req, res) => {
    res.send("adminPage");
});

/* 20200926 sangheon lee
PARAMETER = [USER_ID:USER_ID(INT), CHATROOM_ID(INT)]
 */
router.post("/banUserById", async (req, res) => {
    const USER_ID = req.body.USER_ID;
    const CLASSES = req.body.CLASSES;
    const failRes = {RESULT:"FAIL", REASON:"BAN FAILED"};
    const strQuery = [
        `DELETE FROM danechat.is_member WHERE user_id=${USER_ID} AND chatroom_id=%d;`,
        `INSERT INTO danechat.is_banned (user_id, chatroom_id) VALUES (${USER_ID}, %d);`
    ];
    for(let i = 0; i < CLASSES.length; i++){
        for(let j = 0; j < 2; j++){
            try{
                await db.query(util.format(strQuery[j], CLASSES[i]))
            }catch(e){
                console.log(e);
            }
        }
    }
    console.log("status 200 banUserById");
    res.status(200).json({RESULT:"SUCCESS"});                
    res.end();
});

router.post("/removeUserById", async (req, res) => {
    const USER_ID = req.body.USER_ID;
    const CLASSES = req.body.CLASSES;
    const failRes = {RESULT:"FAIL", REASON:"LEAVE FAILED"};
    const strQuery = [
        `DELETE FROM danechat.is_member WHERE user_id=${USER_ID} AND chatroom_id=%d;`
    ];
    for(let i = 0; i < CLASSES.length; i++){
        for(let j = 0; j < 1; j++){
            try{
                await db.query(util.format(strQuery[j], CLASSES[i]))
            }catch(e){
                console.log(e);
            }
        }
    }
    console.log("status 200 banUserById");
    res.status(200).json({RESULT:"SUCCESS"});                
    res.end();
});

/* 20201109 sangheonlee
PARAMETER = [USER_ID:USER_ID(INT), CLASSES:CLASSES(ARRAY[INT])]
 */
router.post("/assignClasses", async (req, res) => {
    const USER_ID = req.body.USER_ID;
    const CLASSES = req.body.CLASSES;
    const strQuery =[
        `SELECT * FROM danechat.is_banned WHERE user_id=${USER_ID} AND chatroom_id=%d;`,
        `INSERT INTO danechat.is_member (user_id, chatroom_id) VALUES(${USER_ID}, %d);`
    ];
    for(let i = 0; i < CLASSES.length; i++){
        const [rows, field, error] = await db.query(util.format(strQuery[0], CLASSES[i]));
        if(rows.length === 0){
            try{
                await db.query(util.format(strQuery[1], CLASSES[i]));
            }catch(e){
                // console.log(e);
                console.log("already member of " + CLASSES[i]);
            }
        }else{
            console.log("user is banned in room " + CLASSES[i]);
        }
    }
    res.status(200).json({
        RESULT:"SUCCESS"
    });
    res.end();
});

/* 20200926 sangheon lee*/
router.post("/getAllUserInformation", async (req, res) => {
    const strQuery = [
        `SELECT * FROM danechat.user_login ORDER BY user_id`,
        `SELECT * FROM danechat.user ORDER BY user_id`
    ];
    try{
        const rt = [];
        const [row1, field1, error1] = await db.query(strQuery[0]);
        const [row2, field2, error2] = await db.query(strQuery[1]);
        for(let i = 0; i < row1.length; i++){
            const user = {};
            user.user_id = row1[i].user_id;
            user.email = row1[i].email;
            user.name = row2[i].name;
            rt.push(user);
        }
        console.log(rt);
        console.log("status 200 getAllUserInformation");
        res.status(200).json({
            RESULT:"SUCCESS",
            USER_LIST:rt
        });
    }catch(e){
        console.log(e);
        cFunc.failResponse({RESULT:"FAIL", REASON:"getAllUserInformation Failed"});
    }
    res.end();
});

 module.exports = router;