const {Log, path, fs} = require("chuijs");
const { spawn } = require('child_process');
const {AppPaths} = require("../settings/paths");
const Scripts = require("../settings/scripts");


class Android {
    #start_process = undefined
    constructor() {}
    /** Имена AVD, созданных приложением (ANDROID_AVD_HOME = AppPaths.AVD_DIR). */
    avdNames() {
        return Scripts.listAvdNames()
    }
    startEmulator(name) {
        const avd = name ?? this.#selectAvd()
        if (!avd) return

        const isWindows = process.platform === "win32"
        const script_path = Scripts.avdScriptPath(avd, isWindows ? "start.bat" : "start.sh")
        if (!fs.existsSync(script_path)) {
            Log.error(`Скрипт запуска не найден: ${script_path}. Создайте эмулятор через установку компонентов.`)
            return
        }

        if (isWindows) {
            this.#start_process = spawn('cmd.exe', ['/c', script_path], {env: Scripts.scriptEnvironment()});
        } else {
            this.#start_process = spawn('sh', [script_path], {detached: true, env: Scripts.scriptEnvironment()});
        }

        this.#start_process.stdout.on('data', (data) => {
            Log.info(`stdout: ${data}`);
        });
        this.#start_process.stderr.on('data', (data) => {
            Log.error(`stderr: ${data}`);
        });
        this.#start_process.on('close', (code) => {
            Log.info(`close: ${code}`);
            this.#start_process = undefined
        });
        this.#start_process.on('error', (err) => {
            Log.error(`Failed to start child process: ${err}`);
        });
    }
    stopEmulator() {
        Log.info("KILL EMULATOR!")
        if (!this.#start_process) {
            Log.info("Эмулятор не запущен")
            return
        }
        try {
            if (process.platform === "linux") {
                process.kill(-this.#start_process.pid, "SIGTERM")
            } else if (process.platform === "win32") {
                spawn('taskkill', ['/pid', String(this.#start_process.pid), '/t', '/f'])
            }
        } catch (error) {
            Log.error(`Failed to stop emulator: ${error}`)
        }
        this.#start_process = undefined
    }
    /**
     * Без явного имени работаем только когда выбор однозначен:
     * иначе есть риск запустить «какой-нибудь» эмулятор или сломаться на хардкоде имени.
     */
    #selectAvd() {
        const names = this.avdNames()
        if (names.length === 1) return names[0]
        if (names.length === 0) {
            Log.error(`Эмуляторы не найдены в ${AppPaths.AVD_DIR}. Сначала установите эмулятор.`)
            return undefined
        }
        Log.error(`Найдено несколько эмуляторов (${names.join(", ")}): укажите нужный по имени`)
        return undefined
    }
}

exports.Android = Android
