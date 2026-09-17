const {Page, WebView, Spinner, ipcRenderer, Label, Log} = require('chuijs');
const json = require("../../package.json")

class MainPage extends Page {
    #spinner = undefined
    #applied_state = undefined
    constructor() {
        super();
        this.setTitle(`${json.productName}`);
        this.setFullHeight();
        this.setMain(true);
        this.setFullWidth()
        this.disablePadding()

        this.#spinner = new Spinner(Spinner.SIZE.BIG, "auto")
        this.add(this.#spinner)

        ipcRenderer.on("APPIUM_STATUS", (_event, status) => this.#applyStatus(status))
        // Страница создаётся позже первого события, поэтому состояние запрашиваем сами.
        ipcRenderer.invoke("APPIUM_STATUS").then((status) => this.#applyStatus(status)).catch((error) => Log.error(error))
    }
    /** Интерфейс зависит только от состояния Appium: starting | ready | error. */
    #applyStatus(status) {
        const state = status?.state
        if (state === undefined || state === "starting") return
        if (state === this.#applied_state) return
        this.#applied_state = state

        this.#spinner.remove()
        if (state === "ready") {
            this.add(new WebView("http://localhost:4723/inspector", false))
            return
        }
        this.add(new Label({
            text: status.message ? `Appium не запущен: ${status.message}` : "Appium не запущен",
            textAlign: "center",
            width: "-webkit-fill-available",
            fontSize: "16px"
        }))
    }
}

exports.MainPage = MainPage
