const express = require("express");
const router = express.Router();
const db = require("./util/dbConnection");
const config = require("./util/config");
const cFunc = require("./util/commFunc");
const util = require("util");
const bkdf2Password = require("pbkdf2-password");
const hasher = bkdf2Password();
const cookieParser = require("cookie-parser");
const session = require("express-session");
const MySQLStore = require("express-mysql-session")(session);
const sessionStore = new MySQLStore({
    host:config.DB_HOST,
    user:config.DB_USER,
    password:config.DB_PWD,
    port:config.DB_PORT,
    database:config.DB_NAME
});

router.use(cookieParser());
router.use(session({
    secret:config.SESSION_SECRET,
    resave:false,
    saveUninitialized:true,
    store:sessionStore    
}));

router.get("/", (req, res) => {
    res.send("loginPage");
});

/* 20200924 sangheonlee
PARAMETER = [USER_EMAIL:USER_EMAIL(STRING),
             PASSWORD:PASSWORD(STRING)] */
router.post("/loginByEmail", async (req, res) => {
    let USER_EMAIL= req.body.USER_EMAIL;
    const PASSWORD = req.body.PASSWORD;
    let IS_ADMIN = "FALSE";
    try{

        if (!USER_EMAIL.includes("@")) {
            USER_EMAIL = USER_EMAIL.concat("@albany.edu");
        }
        const strQuery = [
        //     `SELECT user_id, password_hash, salt FROM danechat.user_login WHERE email='${USER_EMAIL}';`,
        //     `SELECT name FROM danechat.user WHERE user_id=%d;`,
        //     `SELECT role_id FROM danechat.has_role WHERE user_id=%d;`
        // ];
        // const [row, field, error] = await db.query(strQuery[0]);
        // if(row.length !== 0){
        //     const [row2, field2, error2] = await db.query(util.format(strQuery[1], row[0].user_id));
        //     const [row3, field3, error3] = await db.query(util.format(strQuery[2], row[0].user_id));
        //     if(row3.length !== 0){
        //         if(row3[0].role_id === 1){
        //             IS_ADMIN = "TRUE"
        //         }
        //     }
            `SELECT user_login.user_id, role_id, password_hash, salt FROM danechat.user_login left join has_role on user_login. user_id = has_role.user_id WHERE email = "${USER_EMAIL}";`,
            `SELECT name FROM danechat.user WHERE user_id=%d;`
        ];
        const [row, field, error] = await db.query(strQuery[0]);
        if(row.length !== 0){
            const [row2, field, error] = await db.query(util.format(strQuery[1], row[0].user_id));

            var is_admin = 0;
            if (row[0].role_id == 1) {
                is_admin = 1;
            }

            return hasher({password:PASSWORD, salt:row[0].salt}, function(err, pass, salt, hash){
                if(hash === row[0].password_hash){
                    res.cookie(USER_EMAIL, util.format("%s_%s", USER_EMAIL, row2[0].name)); // set cookie
                    req.session.user_id = row[0].user_id; // set session
                    req.session.email = USER_EMAIL;
                    req.session.name = row2[0].name
                    req.session.isLogined = true;
                    console.log("status 200 loginByEmail");
                    res.status(200).json({
                        RESULT:"SUCCESS",
                        USER_EMAIL:USER_EMAIL,
                        USER_NAME:row2[0].name,
                        // IS_ADMIN:IS_ADMIN
                        USER_ID: row[0].user_id,
                        IS_ADMIN: is_admin
                    });
                }else{
                    cFunc.failResponse(res, {RESULT:"FAIL", REASON:"INCORRECT PASSWORD"})
                }
                res.end();
            });
        }else{
            cFunc.failResponse(res, {RESULT:"FAIL", REASON:"THE USER ACCOUNT DOES NOT EXIST."});
        }
    }catch(e){
        console.log(e);
        cFunc.failResponse(res, {RESULT:"FAIL", REASON:"LOGIN FAILED"});
    }
    res.end();
});

/* 20200924 sangheonlee
PARAMETER = [USER_EMAIL:USER_EMAIL(STRING)] */
router.post("/logoutUserAcc", async (req, res) => {
    const USER_EMAIL = req.body.USER_EMAIL;
    try{
        res.clearCookie(USER_EMAIL); // clear cookie
        res.clearCookie("connect.sid"); // clear session cookie
        delete req.session.user_id; // remove session
        delete req.session.email;
        delete req.session.name;
        delete req.session.isLogined;
        req.session.destroy(function(err){
            req.session;
        });
        console.log("status 200 logoutUserAcc");
        res.status(200).json({RESULT:"SUCCESS"});
    }catch(e){
        console.log(e);
        cFunc.failResponse(res, {RESULT:"FAIL", REASON:"LOGOUT FAILED"});
    }
    res.end();
});

/* 20200927 Boya
PARAMETER = [USER_EMAIL:USER_EMAIL(STRING),
             PASSWORD:PASSWORD(STRING)] */
router.post("/deleteUserAccByEmailAddrAndPwd", async (req, res) => {
    const USER_EMAIL= req.body.USER_EMAIL;
    const PASSWORD = req.body.PASSWORD;
    try{
        const strQuery = [
            `SELECT user_id, password_hash, salt FROM danechat.user_login WHERE email='${USER_EMAIL}';`,
            `DELETE FROM danechat.user_login WHERE email='${USER_EMAIL}';`,
            `DELETE FROM danechat.user WHERE user_id=%d;`
        ];

        const [row, field, error] = await db.query(strQuery[0]);
        if(row.length !== 0){
            return hasher({password:PASSWORD, salt:row[0].salt}, function (err, pass, salt, hash) {
                if(hash === row[0].password_hash){
                    db.query(util.format(strQuery[1]));
                    db.query(util.format(strQuery[2], row[0].user_id));

                    console.log("status 200 deleteUserAccByEmailAddrAndPwd");
                    res.status(200).json({
                        RESULT:"SUCCESS",
                        USER_EMAIL:USER_EMAIL,
                    });
                }else{
                    cFunc.failResponse(res, {RESULT:"FAIL", REASON:"INCORRECT PASSWORD"})
                }
                res.end();
            });
        }else{
            cFunc.failResponse(res, {RESULT:"FAIL", REASON:"THE USER ACCOUNT DOES NOT EXIST."});
        }
    }catch(e){
        console.log(e);
        cFunc.failResponse(res, {RESULT:"FAIL", REASON:"DELETE USER FAILED"});
    }
    res.end();
});


module.exports = router;