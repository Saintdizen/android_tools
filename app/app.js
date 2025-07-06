const {AppLayout, render, Log} = require('chuijs');
const {MainPage} = require("./views/main_page");
const {EmulatorPage} = require("./views/emulator_page");

class Apps extends AppLayout {
    constructor() {
        super();
        this.setAutoCloseRouteMenu()
        this.setRoute(new MainPage())
        this.setRoute(new EmulatorPage())
    }
}

render(() => new Apps()).catch(err => Log.error(err))
