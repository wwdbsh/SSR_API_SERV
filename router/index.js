var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res) {
    res.render("index.html");
    // res.render("index_temp.html");
});

module.exports = router;
