const {Page, WebView, Spinner, ipcRenderer, Log} = require('chuijs');
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

        let spin = new Spinner(Spinner.SIZE.BIG, "auto")
        let web = new WebView("", true);
        // web.addFinishLoadEvent(async () => {
        //     await web.executeJavaScript(```
        //     localStorage.setItem('PREFERRED_THEME', '"light"')
        //     //location.reload()
        //     console.log(window.matchMedia)
        //         ```)
        // })
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