const {Page, WebView, Spinner, ipcRenderer} = require('chuijs');
const json = require("../../package.json")

class MainPage extends Page {
    constructor() {
        super();
        this.setTitle(`${json.productName}`);
        this.setFullHeight();
        this.setMain(true);
        this.setFullHeight()
        this.setFullWidth()
        this.disablePadding()

        let spin = new Spinner(Spinner.SIZE.BIG, "auto")
        let web = new WebView("", false);
        this.add(spin)

        ipcRenderer.on("ADD_BROWSER", () => {
            setTimeout(() => {
                spin.remove()
            }, 1)
            setTimeout(() => {
                this.add(web)
                web.setUrl("http://localhost:4723/inspector")
            }, 251)
        })
    }
}

exports.MainPage = MainPage