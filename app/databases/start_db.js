const {AvdDB} = require("./sqlite");
const {App} = require("chuijs");
const {AppPaths} = require("../settings/paths");

class DataBases {
    constructor() {}
    static AVD_DB = new AvdDB()
    static send(channel) {
        for (let webContent of App.getWebContents().getAllWebContents()) webContent.send(channel)
    }
}

module.exports = {
    DataBases: DataBases
}