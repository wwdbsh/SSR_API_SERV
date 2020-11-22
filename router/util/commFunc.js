module.exports = {
    failResponse: (res, json_o) => res.status(400).json(json_o)
};