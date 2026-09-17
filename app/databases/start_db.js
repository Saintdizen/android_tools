const {AvdDB} = require("./sqlite");
const {App} = require("chuijs");

class DataBases {
    constructor() {}
    static AVD_DB = new AvdDB()
    static send(channel, ...args) {
        for (let webContent of App.getWebContents().getAllWebContents()) webContent.send(channel, ...args)
    }
}

module.exports = {
    DataBases: DataBases
}