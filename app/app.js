const {AppLayout, render} = require('chuijs');
const {MainPage} = require("./views/main_page");

class Apps extends AppLayout {
    constructor() {
        super();
        this.setRoute(new MainPage())
    }
}

render(() => new Apps()).catch(err => console.error(err))
