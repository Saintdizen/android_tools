const {Main, MenuItem, Log, path, App, ipcMain} = require('chuijs');
const json = require("./package.json");
const DownloadManager = require("electron-download-manager");
const {AppPaths} = require("./app/settings/paths")
const {spawn} = require("node:child_process");
const {DataBases} = require("./app/databases/start_db");
AppPaths.install()
DownloadManager.register({downloadFolder: AppPaths.DOWNLOADS_DIR});
//
const main = new Main({
    name: `${json.productName} (${json.version})`,
    sizes: {
        minWidth: 1280,
        width: 1280,
        minHeight: 720,
        height: 720
    },
    minHeight: 540,
    minWidth: 960,
    // icon: `${__dirname}/resources/icons/app/icon.png`,
    render: `${__dirname}/app/app.js`,
    devTools: false,
    resizable: true,
    paths: {
        downloadPath: AppPaths.DOWNLOADS_DIR
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


ipcMain.on("START_APPIUM", (event, args) => {
    Log.info(args)
    console.log(args)
    let appium = path.join(__dirname, "node_modules", "appium", "index.js")
    Log.info(appium)
    const appium_spawn = spawn(`${args}`, [`${appium}`, '--use-plugins=inspector', '--allow-cors']);
    appium_spawn.stdout.on('data', (data) => {

        if (String(data).includes("You can provide the following URLs in your client code to connect to this server")) {
            DataBases.send("ADD_BROWSER")
        }

        Log.info(`stdout: ${data}`);
    });
    appium_spawn.stderr.on('data', (data) => {
        Log.error(`stderr: ${data}`);
    });
    appium_spawn.on('close', (code) => {
        Log.info(`child process exited with code ${code}`);
    });
    appium_spawn.on('error', (err) => {
        Log.error('Failed to start child process.', err);
    });
})