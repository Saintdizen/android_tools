const {Main, MenuItem, Log, path, App} = require('chuijs');
const json = require("./package.json");
const DownloadManager = require("electron-download-manager");
const {AppPaths} = require("./app/settings/paths")
const {spawn, execFileSync} = require("node:child_process");
const semver = require("semver");
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
    icon: `${__dirname}/resources/icons/app/icon.png`,
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

let appium_spawn = undefined
App.get().on("quit", () => {
    if (!appium_spawn || appium_spawn.killed) return
    try {
        process.kill(appium_spawn.pid, "SIGTERM")
    } catch (error) {
        Log.error(`Failed to stop Appium: ${error}`)
    }
})

process.env.ELECTRON = path.join(__dirname, "node_modules", "electron", "dist", "electron")
process.env.APPIUM = path.join(__dirname, "node_modules", "appium", "index.js")

const APPIUM_NODE_RANGE = "^20.19.0 || ^22.12.0 || >=24.0.0"

function resolveAppiumRuntime() {
    // Встроенный в Electron Node подходит не всегда (Electron 24 несёт Node 18),
    // поэтому совместимый runtime ищем среди встроенного и системного Node.js.
    if (semver.satisfies(process.versions.node, APPIUM_NODE_RANGE)) {
        return {command: process.execPath, env: {...process.env, ELECTRON_RUN_AS_NODE: "1"}}
    }
    try {
        const systemVersion = execFileSync("node", ["--version"], {encoding: "utf-8"}).trim().replace(/^v/, "")
        if (semver.satisfies(systemVersion, APPIUM_NODE_RANGE)) {
            Log.info(`Appium запускается системным Node.js ${systemVersion}`)
            return {command: "node", env: process.env}
        }
        Log.error(`Системный Node.js ${systemVersion} не подходит для Appium (требуется ${APPIUM_NODE_RANGE})`)
    } catch (error) {
        Log.error(`Не удалось найти Node.js для Appium: ${error.message}`)
    }
    return undefined
}

const appium_runtime = resolveAppiumRuntime()

if (appium_runtime) {
    appium_spawn = spawn(appium_runtime.command, [process.env.APPIUM, '--use-plugins=inspector', '--allow-cors'], {
        env: appium_runtime.env
    });

    appium_spawn.stdout.on('data', (data) => {
        if (String(data).includes("You can provide the following URLs in your client code to connect to this server")) DataBases.send("ADD_BROWSER")
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
} else {
    Log.error(`Appium не запущен: подходящий Node.js (${APPIUM_NODE_RANGE}) не найден`)
}