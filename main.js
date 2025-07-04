const {Main, MenuItem, path, App} = require('chuijs');
const json = require("./package.json");
//
const main = new Main({
    name: `${json.productName} (${json.version})`,
    sizes: {
        minWidth: 960,
        width: 960,
        minHeight: 540,
        height: 540
    },
    minHeight: 540,
    minWidth: 960,
    // icon: `${__dirname}/resources/icons/app/icon.png`,
    render: `${__dirname}/app/app.js`,
    devTools: false,
    resizable: true,
    paths: {
        downloadPath: path.join(App.userDataPath(), "downloads")
    }
});

let menu = [
    new MenuItem().help(`Версия: ${json.version}`),
    new MenuItem().button('Консоль', () => main.toggleDevTools()),
    new MenuItem().quit('Выход')
]

main.start({
    hideOnClose: true,
    tray: menu,
    globalMenu: menu
});


main.enableAutoUpdateApp(2000)