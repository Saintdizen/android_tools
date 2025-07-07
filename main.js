const {Main, MenuItem, path, App, Log} = require('chuijs');
const json = require("./package.json");
const DownloadManager = require("electron-download-manager");
const dl_path = path.join(App.userDataPath(), 'downloads')
DownloadManager.register({downloadFolder: dl_path});
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


const { spawn } = require('node:child_process');
const appium = spawn('appium', ['--use-plugins=inspector', '--allow-cors']);
appium.stdout.on('data', (data) => {
  Log.info(`stdout: ${data}`);
});
appium.stderr.on('data', (data) => {
  Log.error(`stderr: ${data}`);
});
appium.on('close', (code) => {
  Log.info(`child process exited with code ${code}`);
});
appium.on('error', (err) => {
  Log.error('Failed to start child process.', err);
});