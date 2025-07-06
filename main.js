const {Main, MenuItem, path, App} = require('chuijs');
const json = require("./package.json");
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
  console.log(`stdout: ${data}`);
});
appium.stderr.on('data', (data) => {
  console.error(`stderr: ${data}`);
});
appium.on('close', (code) => {
  console.log(`child process exited with code ${code}`);
});
appium.on('error', (err) => {
  console.error('Failed to start child process.', err);
});