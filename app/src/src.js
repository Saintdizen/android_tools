const {Log, fs} = require("chuijs");
const { spawn } = require('child_process');
const {AppPaths} = require("../settings/paths");
const Scripts = require("../settings/scripts");
const {DataBases} = require("../databases/start_db");


class Android {
    #start_process = undefined
    #running_avd = undefined
    #running_listeners = []
    constructor() {}
    /** Имена AVD, созданных приложением (ANDROID_AVD_HOME = AppPaths.AVD_DIR). */
    avdNames() {
        return Scripts.listAvdNames()
    }
    /** Имя запущенного приложением эмулятора (undefined — ничего не запущено). */
    runningAvd() {
        return this.#running_avd
    }
    /**
     * Подписка на изменения состояния эмулятора: запуск, остановка и самостоятельный выход
     * процесса. Интерфейсу это нужно, чтобы показывать актуальный статус без опроса.
     */
    onRunningChange(listener) {
        this.#running_listeners.push(listener)
    }
    #notifyRunningChange() {
        for (const listener of this.#running_listeners) listener(this.#running_avd)
    }
    /**
     * Запускает эмулятор и возвращает его имя. Синхронный (spawn не ждёт), при неудаче
     * бросает Error: интерфейс показывает причину, а не молча ничего не делает.
     */
    startEmulator(name) {
        const avd = this.#resolveAvd(name)
        if (this.#start_process) {
            throw new Error(`Эмулятор "${this.#running_avd}" уже запущен: сначала остановите его`)
        }

        const isWindows = process.platform === "win32"
        const script_path = Scripts.avdScriptPath(avd, isWindows ? "start.bat" : "start.sh")
        if (!fs.existsSync(script_path)) {
            throw new Error(`Скрипт запуска не найден: ${script_path}. Создайте эмулятор через установку компонентов.`)
        }

        if (isWindows) {
            this.#start_process = spawn('cmd.exe', ['/c', script_path], {env: Scripts.scriptEnvironment()});
        } else {
            this.#start_process = spawn('sh', [script_path], {detached: true, env: Scripts.scriptEnvironment()});
        }
        this.#running_avd = avd
        this.#notifyRunningChange()

        // Обработчики привязаны к конкретному процессу: если его уже остановили или
        // заменили новым, позднее событие close/error не должно сбивать текущее состояние.
        const process_handle = this.#start_process
        process_handle.stdout.on('data', (data) => {
            Log.info(`stdout: ${data}`);
        });
        process_handle.stderr.on('data', (data) => {
            Log.error(`stderr: ${data}`);
        });
        process_handle.on('close', (code) => {
            Log.info(`close: ${code}`);
            if (this.#start_process !== process_handle) return
            this.#start_process = undefined
            this.#running_avd = undefined
            this.#notifyRunningChange()
        });
        process_handle.on('error', (err) => {
            Log.error(`Failed to start child process: ${err}`);
            if (this.#start_process !== process_handle) return
            // Процесс не запустился: иначе интерфейс показывал бы несуществующий эмулятор.
            this.#start_process = undefined
            this.#running_avd = undefined
            this.#notifyRunningChange()
        });
        return avd
    }
    /**
     * Останавливает запущенный эмулятор и возвращает его имя.
     * Если останавливать нечего или сигнал не передался — бросает Error.
     */
    stopEmulator() {
        if (!this.#start_process) {
            throw new Error("Эмулятор не запущен: останавливать нечего")
        }
        const avd = this.#running_avd
        try {
            if (process.platform === "linux") {
                process.kill(-this.#start_process.pid, "SIGTERM")
            } else if (process.platform === "win32") {
                spawn('taskkill', ['/pid', String(this.#start_process.pid), '/t', '/f'])
            }
        } catch (error) {
            throw new Error(`Не удалось остановить эмулятор "${avd}": ${error.message ?? error}`)
        }
        Log.info(`Эмулятор "${avd}" останавливается`)
        this.#start_process = undefined
        this.#running_avd = undefined
        this.#notifyRunningChange()
        return avd
    }
    /**
     * Удаляет эмулятор: конфигурацию, данные, скрипты запуска и запись в базе.
     * Возвращает имя удалённого AVD; при неудаче бросает Error.
     */
    async deleteEmulator(name) {
        const avd = this.#resolveAvd(name)
        if (this.#running_avd === avd) {
            throw new Error(`Эмулятор "${avd}" запущен: сначала остановите его`)
        }

        const removed = Scripts.removeAvdFiles(avd)
        // База вспомогательная: её сбой не отменяет уже выполненное удаление файлов.
        try {
            await DataBases.AVD_DB.createAvdTable()
            await DataBases.AVD_DB.deleteAvdData(avd)
        } catch (error) {
            Log.error(`Не удалось удалить "${avd}" из базы: ${error.message ?? error}`)
        }
        // Каталог .ini — признак AVD для приложения (Scripts.listAvdNames): он обязан исчезнуть.
        if (fs.existsSync(Scripts.avdIniPath(avd))) {
            throw new Error(`Не удалось удалить эмулятор "${avd}": файл ${Scripts.avdIniPath(avd)} остался на месте`)
        }
        Log.info(`Эмулятор "${avd}" удалён (удалено объектов: ${removed.length})`)
        return avd
    }
    /**
     * Разрешает имя AVD. Без явного имени работаем только когда выбор однозначен:
     * иначе есть риск запустить «какой-нибудь» эмулятор или сломаться на хардкоде имени.
     */
    #resolveAvd(name) {
        const names = this.avdNames()
        if (name !== undefined) {
            if (names.includes(name)) return name
            throw new Error(`Эмулятор "${name}" не найден в ${AppPaths.AVD_DIR}`)
        }
        if (names.length === 1) return names[0]
        if (names.length === 0) {
            throw new Error(`Эмуляторы не найдены в ${AppPaths.AVD_DIR}. Сначала установите эмулятор.`)
        }
        throw new Error(`Найдено несколько эмуляторов (${names.join(", ")}): укажите нужный по имени`)
    }
}

exports.Android = Android
