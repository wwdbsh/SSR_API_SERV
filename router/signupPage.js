const express = require("express");
const router = express.Router();
const db = require("./util/dbConnection");
const cFunc = require("./util/commFunc");
const util = require("util");
const nodemailer = require("nodemailer");
const smtpPool = require("nodemailer-smtp-pool");
const bkdf2Password = require("pbkdf2-password");
const hasher = bkdf2Password();

const smtpTransport = nodemailer.createTransport(smtpPool({
    service:"Gmail",
    host:"localhost",
    port:"465",
    tls:{
        rejectUnauthorized:false
    },
    auth:{
        user:process.env.NODEMAILER_AUTH_USER_ACC,
        pass:process.env.NODEMAILER_AUTH_USER_PWD
    },
    maxConnections:5,
    maxMessages:10
}));

router.get("/", (req, res) => {
    res.send("singup page");
});

/* 20200923 sangheonlee
PARAMETER = [USER_EMAIL:USER_EMAIL(STRING),
            USER_NAME:USER_NAME(STRING),
            PASSWORD:PASSWORD(STRING),
            CHK_PASSWORD:CHK_PASSWORD(STRING)] */
router.post("/signupByEmail", async (req, res) => {
    const USER_EMAIL = req.body.USER_EMAIL;
    const USER_NAME = req.body.USER_NAME;
    const PASSWORD = req.body.PASSWORD;
    const CHK_PASSWORD = req.body.CHK_PASSWORD;
    const failRes = {RESULT:"FAIL", REASON:"SIGN UP FAILED"};
    try{
        const strQuery = [
            `SELECT email FROM danechat.user_login WHERE email='${USER_EMAIL}';`,
            `SELECT name FROM danechat.user WHERE name='${USER_NAME}';`,
            `INSERT INTO danechat.user (name) VALUES('${USER_NAME}');`,
            `SELECT user_id FROM danechat.user WHERE name='${USER_NAME}';`,
            `INSERT INTO danechat.user_login (user_id, email, password_hash, salt) VALUES(%d, '${USER_EMAIL}', '%s', '%s');`
        ];
        let [row, field, error] = await db.query(strQuery[0]);
        if(row.length === 0){
           [row, field, error] = await db.query(strQuery[1]);
           if(row.length === 0){
               if(PASSWORD === CHK_PASSWORD){
                    return hasher({password:PASSWORD}, async (err, pass, salt, hash) => {
                        await db.query(strQuery[2]);
                        [row, field, error] = await db.query(strQuery[3]);
                        await db.query(util.format(strQuery[4], row[0].user_id, hash, salt));
                        res.status(200).json({
                            RESULT:"SUCCESS",
                            USER_EMAIL:USER_EMAIL,
                            USER_NAME:USER_NAME
                        })
                        console.log("signupByEmail status 200");
                        res.end();
                    });
               }else{
                   failRes.REASON = "PWD IS NOT CONSISTENT WITH CONFIRM PWD";
               }
           }else{
               failRes.REASON = "EXISTING VISIBLE NAME";
           }
        }else{
            failRes.REASON = "EXISTING ACCOUNT";
        }
        cFunc.failResponse(res, failRes);
    }catch(e){
        console.log(e);
        cFunc.failResponse(res, failRes);
    }
    res.end();
});

/* 20200925 sangheonlee
PARAMETER = [USER_EMAIL:USER_EMAIL(STRING)] */
router.post("/forgetUserAccPwd", async (req, res) => {
    const USER_EMAIL = req.body.USER_EMAIL;
    const strQuery = `SELECT email FROM danechat.user_login WHERE email='${USER_EMAIL}';`
    const mailOpt = {
        from:process.env.NODEMAILER_AUTH_USER_ACC,
        to:USER_EMAIL,
        subject:"Thanks for using SSR." ,
        html:'Click <a href="http://52.188.16.47:8080/">here</a> to reset your password'
    };
    try{
        const [row, field, error] = await db.query(strQuery);
        if(row.length !== 0){
            smtpTransport.sendMail(mailOpt, (err, res) => {
                if(err){
                    console.log(err);
                }else{
                    console.log("Msg send:" + res);
                }
            });
            res.status(200).json({
                RESULT:"SUCCESS"
            });
        }else{
            cFunc.failResponse(res, {RESULT:"FAIL", REASON:"NON-EXISTING USER ACCOUNT"});
        }
    }catch(e){
        console.log(e);
        cFunc.failResponse(res, {RESULT:"FAIL", REASON:"SENDING EMAIL FAILED"});
    }
    res.end();
});

/* 20200928 michael
PARAMETER = [USER_EMAIL:USER_EMAIL(STRING),
            EXISTING_PWD:EXISTING_PWD(STRING),
            NEW_PWD:NEW_PWD(STRING),
            CHK_PASSWORD:CHK_PASSWORD(STRING)] */
router.post("/changeUserAccPwd", async (req, res) => {
    const USER_EMAIL= req.body.USER_EMAIL;
    const EXISTING_PWD = req.body.EXISTING_PWD;
	const NEW_PWD = req.body.NEW_PWD;
	const CHK_NEW_PWD = req.body.CHK_NEW_PWD;
	if (!(USER_EMAIL && EXISTING_PWD && NEW_PWD && CHK_NEW_PWD)) {
		res.status(400).json({
			RESULT:"FAIL",
			REASON:"BAD REQUEST BODY"
		});
		res.end();
		return;
	}	
	if(NEW_PWD != CHK_NEW_PWD) {
		res.status(400).json({
			RESULT:"FAIL",
			REASON:"PASSWORDS DO NOT MATCH"
		});
		res.end();
		return;
	}
    try{
		const selectAccountQuery = `SELECT user_id, password_hash, salt FROM danechat.user_login WHERE email='${USER_EMAIL}';`;
		const [row, field, error] = await db.query(selectAccountQuery);
		if(row.length==0) {
			res.status(400).json({
				RESULT:"FAIL",
                REASON:"THE USER ACCOUNT DOES NOT EXIST."
			});
			res.end();
			return;
		}
		var result = row[0];
		hasher({password:EXISTING_PWD, salt:result.salt}, function(err, pass, salt, hash) {
			if(hash != result.password_hash) {
				res.status(400).json({
					RESULT:"FAIL",
					REASON:"INCORRECT PASSWORD."
				})
				res.end()
				return;
			} else {
				hasher({password:NEW_PWD}, function(err, pass, salt, hash) {
					if(err) {
						res.status(400).json({
						RESULT:"FAIL",
						REASON:"UNABLE TO UPDATE PASSWORD."
					})
				res.end()
				return;
					} else {
						const updateQuery = `UPDATE danechat.user_login SET salt='${salt}', password_hash='${hash}' WHERE user_id='${result.user_id}'`
						db.query(updateQuery)
						res.status(200).json({RESULT:"SUCCESS"});
						res.end();
						return;
					}
				})
			}
		})
		return;
    }catch(e){
        console.log(e);
        res.status(400).json({
            RESULT:"FAIL",
            REASON:"SOMETHING WENT WRONG"
        });
    }
    res.end();
});

module.exports = router;