const {Main, MenuItem, Log, path, App} = require('chuijs');
const {ipcMain} = require('electron');
const json = require("./package.json");
const DownloadManager = require("electron-download-manager");
const {AppPaths} = require("./app/settings/paths")
const {spawn, execFileSync} = require("node:child_process");
const http = require("node:http");
const semver = require("semver");
// Каталоги создаём ДО открытия AVD-базы: sqlite3 без каталога не открывает файл,
// а все его запросы потом молча зависают.
AppPaths.install()
const {DataBases} = require("./app/databases/start_db");
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
let quitting = false
App.get().on("quit", () => {
    quitting = true
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
const APPIUM_URL = "http://127.0.0.1:4723/status"
const APPIUM_READY_TIMEOUT = 60000
const APPIUM_POLL_INTERVAL = 1000

// Состояние Appium — единственный источник правды для интерфейса:
// renderer его только отображает (app/views/main_page.js).
let appium_status = {state: "starting", message: undefined}

function setAppiumStatus(state, message) {
    if (quitting) return
    if (appium_status.state === state && appium_status.message === message) return
    appium_status = {state, message}
    Log.info(`Appium: ${state}${message ? ` (${message})` : ""}`)
    try {
        DataBases.send("APPIUM_STATUS", appium_status)
    } catch (error) {
        // Окно могло быть уже закрыто: статус не должен ломать завершение приложения.
        Log.error(`Не удалось отправить статус Appium: ${error.message ?? error}`)
    }
}

/**
 * Готовность Appium определяется ответом на /status, а не строкой в stdout:
 * текст лога меняется между версиями, а из-за этого интерфейс оставался на спиннере.
 */
function waitForAppium(startedAt) {
    if (appium_status.state !== "starting") return
    if (!appium_spawn || appium_spawn.killed) {
        setAppiumStatus("error", "Процесс Appium остановлен")
        return
    }
    if (Date.now() - startedAt > APPIUM_READY_TIMEOUT) {
        setAppiumStatus("error", `Appium не отвечает на ${APPIUM_URL} (${APPIUM_READY_TIMEOUT / 1000} с)`)
        return
    }
    const request = http.get(APPIUM_URL, (response) => {
        response.resume()
        if (response.statusCode && response.statusCode < 500) {
            setAppiumStatus("ready")
            return
        }
        setTimeout(() => waitForAppium(startedAt), APPIUM_POLL_INTERVAL)
    })
    request.setTimeout(2000, () => request.destroy())
    request.on('error', () => setTimeout(() => waitForAppium(startedAt), APPIUM_POLL_INTERVAL))
}

ipcMain.handle("APPIUM_STATUS", () => appium_status)

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
        Log.info(`stdout: ${data}`);
    });
    appium_spawn.stderr.on('data', (data) => {
        Log.error(`stderr: ${data}`);
    });
    appium_spawn.on('close', (code) => {
        Log.info(`child process exited with code ${code}`);
        setAppiumStatus("error", `Appium завершил работу (код ${code})`)
    });
    appium_spawn.on('error', (err) => {
        Log.error('Failed to start child process.', err);
        setAppiumStatus("error", `Не удалось запустить Appium: ${err.message}`)
    });

    waitForAppium(Date.now())
} else {
    setAppiumStatus("error", `Не запущен: подходящий Node.js (${APPIUM_NODE_RANGE}) не найден`)
}