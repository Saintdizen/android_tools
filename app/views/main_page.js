const {Page, WebView} = require('chuijs');

class MainPage extends Page {
    constructor() {
        super();
        this.setTitle('Inspector');
        this.setFullHeight();
        this.setMain(true);
        this.setFullHeight()
        this.setFullWidth()
        this.disablePadding()

        setTimeout(() => {
            let web = new WebView("http://localhost:4723/inspector", false);
            this.add(web)
        }, 1000)
    }
}

exports.MainPage = MainPage