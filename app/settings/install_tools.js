const {Log, DownloadProgressNotification, path, fs} = require('chuijs');
const {AppPaths} = require("./paths");
const Scripts = require("./scripts");
const decompress = require("decompress");
const fse = require("fs-extra");
const DownloadManager = require("@electron/remote").require("electron-download-manager");
const { spawn } = require('child_process');
const {DataBases} = require("../databases/start_db");

class InstallTools {
    #notif = new DownloadProgressNotification({title: "", text: ""})
    #failed = false
    #links = {
        win: {
            // JDK 21 (LTS): Oracle убирает каталоги снятых с поддержки версий,
            // ссылка на java/24/latest уже отдаёт 404. Имя файла обязано совпадать
            // с последним сегментом ссылки: файл ищется в DOWNLOADS_DIR по fileName,
            // а #copyJava выбирает распакованный каталог по префиксу "jdk-".
            java: {
                fileName: "jdk-21_windows-x64_bin.zip",
                link: "https://download.oracle.com/java/21/latest/jdk-21_windows-x64_bin.zip"
            },
            commandlinetools: {
                fileName: "commandlinetools-win-13114758_latest.zip",
                link: "https://dl.google.com/android/repository/commandlinetools-win-13114758_latest.zip"
            }
        },
        linux: {
            commandlinetools: {
                fileName: "commandlinetools-linux-13114758_latest.zip",
                link: "https://dl.google.com/android/repository/commandlinetools-linux-13114758_latest.zip"
            }
        }
    }
    constructor() {
        this.#notif.show()
        this.#notif.update("Установка компонентов", "Подготовка...", 0, 100)
    }

    /**
     * Устанавливает cmdline-tools, JDK (Windows) и создаёт AVD.
     * Завершается успешно только при полной установке: при любой неудаче бросает
     * исключение, чтобы интерфейс не показывал успех после провала.
     */
    async start(name_avd, device, android_ver, image_type, arch) {
        await this.#notif.update("Установка компонентов", "Подготовка...", 0, 100)
        try {
            // Значения подставляются в текст скриптов: проверяем их до запуска.
            const invalid = Scripts.validateInstallParams(name_avd, device, android_ver, image_type, arch)
            if (invalid) throw new Error(invalid)

            if (process.platform === "linux") {
                Log.info("LINUX")
                if (!this.#isCmdlineToolsInstalled()) {
                    await this.#download("CommandLine Tools", this.#links.linux.commandlinetools.link)
                    await this.#unzip("CommandLine Tools", this.#links.linux.commandlinetools.fileName, 50)
                    await this.#copyCmdlineTools("CommandLine Tools", this.#links.linux.commandlinetools.fileName, 100)
                }
                if (!this.#isAvdInstalled(name_avd)) {
                    await this.#installAvd(
                        Scripts.linuxInstallScript(name_avd, device, android_ver, image_type, arch),
                        "install.sh", name_avd, device, android_ver, image_type, arch)
                }
            } else if (process.platform === "win32") {
                Log.info("WINDOWS")
                if (!fs.existsSync(path.join(AppPaths.JAVA_DIR, "bin"))) {
                    await this.#download("Java", this.#links.win.java.link)
                    await this.#unzip("Java", this.#links.win.java.fileName, 50)
                    await this.#copyJava("Java", this.#links.win.java.fileName, 100)
                }
                if (!this.#isCmdlineToolsInstalled()) {
                    await this.#download("CommandLine Tools", this.#links.win.commandlinetools.link)
                    await this.#unzip("CommandLine Tools", this.#links.win.commandlinetools.fileName, 50)
                    await this.#copyCmdlineTools("CommandLine Tools", this.#links.win.commandlinetools.fileName, 100)
                }
                if (!this.#isAvdInstalled(name_avd)) {
                    await this.#installAvd(
                        Scripts.windowsInstallScript(name_avd, device, android_ver, image_type, arch),
                        "install.bat", name_avd, device, android_ver, image_type, arch)
                }
            } else {
                throw new Error(`Установка компонентов не поддерживается на платформе: ${process.platform}`)
            }
        } catch (error) {
            this.#fail(`Установка компонентов прервана: ${error.message ?? error}`)
            // Ошибку не глотаем: вызывающий код (диалог установки) обязан показать реальный итог.
            throw error instanceof Error ? error : new Error(String(error))
        }
        await this.#notif.update("Установка компонентов", "Завершена", 100, 100)
        await this.#notif.done()
    }

    /** Загрузка через колбэк-API DownloadManager: нужен именно промис, async не требуется. */
    #download(who_name, link) {
        let filename = path.basename(new URL(link).pathname);
        this.#notif.update(`Загрузка ${who_name}`, filename, 0, 100)
        return new Promise((resolve, reject) => {
            DownloadManager.download({
                url: link,
                onProgress: (progress) => {
                    // При неизвестном размере файла прогресс приходит как NaN
                    const percent = Number(progress.progress)
                    this.#notif.update(`Загрузка ${who_name}`, filename, Number.isFinite(percent) ? Math.round(percent) : 0, 100)
                    Log.info(`${filename} ${progress.progress}`)
                }
            }, (error, info) => {
                if (error) {
                    // Об ошибке сообщает только #fail в start(): иначе уведомление показывалось бы дважды.
                    Log.error(error)
                    return reject(error)
                }
                Log.info(`Загрузка ${who_name} завершена`);
                this.#notif.update(`Загрузка ${who_name}`, "Завершена", 100, 100)
                resolve(info)
            });
        })
    }

    /** Распаковка архива в DOWNLOADS_DIR; возвращает список распакованных файлов. */
    async #unzip(who_name, fileName, progress) {
        this.#notif.update(`Установка ${who_name}`, fileName, 0, 100)
        const path_file = path.join(AppPaths.DOWNLOADS_DIR, fileName)
        const files = await decompress(path_file, AppPaths.DOWNLOADS_DIR)
        Log.info(files)
        this.#notif.update(`Установка ${who_name}`, fileName, progress, 100)
        return files
    }

    async #copyJava(who_name, fileName, progress) {
        // Ищем именно каталог: скачанный архив тоже начинается с "jdk-",
        // а его выбор зависит от порядка readdirSync и приводит к EISDIR.
        const jdkDir = fs.readdirSync(AppPaths.DOWNLOADS_DIR, {withFileTypes: true})
            .find(entry => entry.isDirectory() && entry.name.startsWith('jdk-'))
        if (!jdkDir) {
            throw new Error(`Каталог JDK не найден после распаковки в ${AppPaths.DOWNLOADS_DIR}`)
        }
        const srcDir = path.join(AppPaths.DOWNLOADS_DIR, jdkDir.name)
        const destDir = path.join(AppPaths.MAIN_FOLDER_ANDROID, "java")
        if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, {recursive: true});
        await fse.copy(srcDir, destDir, { overwrite: true })
        Log.info('Folder copied successfully!')
        this.#notif.update(`Установка ${who_name}`, fileName, progress, 100)
        return 'Folder copied successfully!'
    }

    async #copyCmdlineTools(who_name, fileName, progress) {
        const srcDir = path.join(AppPaths.DOWNLOADS_DIR, "cmdline-tools")
        const cmdOld = path.join(AppPaths.ANDROID_SDK, "cmdline-tools", "cmdline-tools")
        const cmdNew = path.join(AppPaths.ANDROID_SDK, "cmdline-tools", "latest")
        if (!fs.existsSync(srcDir)) {
            throw new Error(`Каталог cmdline-tools не найден после распаковки: ${srcDir}`)
        }
        try {
            await fse.copy(srcDir, cmdOld, { overwrite: true })
            // sdkmanager и avdmanager запускаются из cmdline-tools/latest, поэтому
            // переименование — часть установки: дожидаемся его окончания до возврата,
            // иначе следующий шаг ищет sdkmanager по пути, которого ещё нет.
            await fs.promises.rename(cmdOld, cmdNew)
        } catch (error) {
            Log.error(error)
            throw new Error(`Не удалось установить cmdline-tools в ${cmdNew}: ${error.message ?? error}`)
        }
        Log.info('Folder copied successfully!')
        this.#notif.update(`Установка ${who_name}`, fileName, progress, 100)
        return 'Folder copied successfully!'
    }

    #isCmdlineToolsInstalled() {
        return fs.existsSync(path.join(AppPaths.ANDROID_SDK, "cmdline-tools", "latest"))
    }

    #isAvdInstalled(name_avd) {
        // avdmanager с ANDROID_AVD_HOME создаёт пару <AVD_DIR>/<имя>.ini и <AVD_DIR>/<имя>.avd
        return fs.existsSync(Scripts.avdIniPath(name_avd))
    }

    async #saveAvd(name_avd, device, android_ver, image_type, arch) {
        await DataBases.AVD_DB.createAvdTable()
        await DataBases.AVD_DB.addAvdData(device, android_ver, image_type, arch, name_avd)
    }

    /** Запускает скрипт установки AVD и дожидается его результата. */
    async #installAvd(scriptText, scriptName, name_avd, device, android_ver, image_type, arch) {
        this.#notif.update("Установка Android", "Подготовка...", 0, 100)
        let script_path = Scripts.writeScript(path.join(AppPaths.AVD_DIR, name_avd), scriptName, scriptText)
        const isWindows = process.platform === "win32"
        const installProc = spawn(
            isWindows ? 'cmd.exe' : 'sh',
            isWindows ? ['/c', script_path] : [script_path],
            // Пути передаём переменными окружения: .bat не содержит не-ASCII текста
            {env: Scripts.scriptEnvironment()}
        )
        await this.#watchInstallProcess(installProc, name_avd, device, android_ver, image_type, arch)
    }

    /** Этапы скрипт печатает как STAGE:<id>, прогресс — как "<n>%". */
    #watchInstallProcess(installProc, name_avd, device, android_ver, image_type, arch) {
        let stage = "Подготовка..."
        let value = 0

        installProc.stdout.on('data', (data) => {
            const {stageId, percent} = Scripts.parseProgressChunk(data)
            if (stageId !== undefined) {
                stage = Scripts.stageLabelOf(stageId)
                value = 0
                this.#notif.update("Установка Android", stage, value, 100)
            }
            if (percent !== undefined) {
                value = percent
                this.#notif.update("Установка Android", stage, value, 100)
            }
            Log.info(`stdout: ${data}`);
        });

        installProc.stderr.on('data', (data) => {
            Log.info(String(data))
        });

        return new Promise((resolve, reject) => {
            installProc.on('close', async (code) => {
                Log.info(`child process exited with code ${code}`);
                if (code !== 0) {
                    this.#fail(`Скрипт установки завершился с кодом ${code}`)
                    return reject(new Error(`Скрипт установки завершился с кодом ${code}`))
                }
                this.createStartScript(name_avd)
                try {
                    await this.#saveAvd(name_avd, device, android_ver, image_type, arch)
                } catch (error) {
                    // База вспомогательная: её сбой не отменяет уже выполненную установку.
                    Log.error(`Не удалось сохранить AVD в базу: ${error.message ?? error}`)
                }
                if (!this.#isAvdInstalled(name_avd)) {
                    const message = `AVD "${name_avd}" не создан: нет файла ${Scripts.avdIniPath(name_avd)}`
                    this.#fail(message)
                    return reject(new Error(message))
                }
                resolve(`child process exited with code ${code}`)
            });

            installProc.on('error', (err) => {
                this.#fail(`Не удалось запустить скрипт установки: ${err.message ?? err}`)
                reject(err)
            });
        })
    }

    /** Об ошибке сообщаем один раз, даже если её увидели и скрипт, и вызывающий код. */
    #fail(message) {
        Log.error(message)
        if (this.#failed) return
        this.#failed = true
        this.#notif.error()
    }

    createStartScript(name) {
        if (process.platform === "linux") {
            let scriptPath = Scripts.writeScript(path.join(AppPaths.AVD_DIR, name), "start.sh", Scripts.linuxStartScript(name))
            fs.chmodSync(scriptPath, 0o755)
            return scriptPath
        } else if (process.platform === "win32") {
            return Scripts.writeScript(path.join(AppPaths.AVD_DIR, name), "start.bat", Scripts.windowsStartScript(name))
        }
    }
}

exports.InstallTools = InstallTools
