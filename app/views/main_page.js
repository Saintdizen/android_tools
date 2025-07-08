const {Page, WebView} = require('chuijs');
const json = require("../../package.json")

class MainPage extends Page {
    constructor(elements) {
        super();
        this.setTitle(`${json.productName}`);
        this.setFullHeight();
        this.setMain(true);
        this.setFullHeight()
        this.setFullWidth()
        this.disablePadding()
        this.add(...elements)

        setTimeout(() => {
            let web = new WebView("http://localhost:4723/inspector", false);
            this.add(web)
        }, 1000)
    }
}

exports.MainPage = MainPage