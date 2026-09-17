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
            java: {
                fileName: "jdk-24_windows-x64_bin.zip",
                link: "https://download.oracle.com/java/24/latest/jdk-24_windows-x64_bin.zip"
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
                Log.error(`Установка компонентов не поддерживается на платформе: ${process.platform}`)
                this.#notif.error()
                return
            }
        } catch (error) {
            this.#fail(`Установка компонентов прервана: ${error.message ?? error}`)
            return
        }
        await this.#notif.update("Установка компонентов", "Завершена", 100, 100)
        await this.#notif.done()
    }

    async #download(who_name, link) {
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
                    Log.error(error)
                    this.#notif.error()
                    return reject(error)
                }
                Log.info(`Загрузка ${who_name} завершена`);
                this.#notif.update(`Загрузка ${who_name}`, "Завершена", 100, 100)
                resolve(info)
            });
        })
    }

    async #unzip(who_name, fileName, progress) {
        this.#notif.update(`Установка ${who_name}`, fileName, 0, 100)
        return new Promise((resolve, reject) => {
            let path_file = path.join(AppPaths.DOWNLOADS_DIR, fileName)
            let dist_path = AppPaths.DOWNLOADS_DIR
            decompress(path_file, dist_path).then((files) => {
                Log.info(files)
                this.#notif.update(`Установка ${who_name}`, fileName, progress, 100)
                resolve(files)
            }).catch((error) => {
                this.#notif.error()
                Log.error(`UNZIP ERROR: ${error}`)
                reject(`UNZIP ERROR: ${error}`)
            });
        })
    }

    async #copyJava(who_name, fileName, progress) {
        return new Promise((resolve, reject) => {
            let jdkDir = fs.readdirSync(AppPaths.DOWNLOADS_DIR)
                .find(d => d.startsWith('jdk-'))
            if (!jdkDir) return reject('JDK directory not found after unzip')
            let srcDir = path.join(AppPaths.DOWNLOADS_DIR, jdkDir)
            let destDir = path.join(AppPaths.MAIN_FOLDER_ANDROID, "java")
            if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, {recursive: true});
            fse.copy(srcDir, destDir, { overwrite: true }).then(() => {
                this.#notif.update(`Установка ${who_name}`, fileName, progress, 100)
                Log.info('Folder copied successfully!')
                resolve('Folder copied successfully!')
            }).catch(err => {
                this.#notif.error()
                Log.error(err)
                reject(err)
            });
        })
    }

    async #copyCmdlineTools(who_name, fileName, progress) {
        return new Promise((resolve, reject) => {
            let srcDir = path.join(AppPaths.DOWNLOADS_DIR, "cmdline-tools")
            let destDir = path.join(AppPaths.ANDROID_SDK, "cmdline-tools", "cmdline-tools")
            if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, {recursive: true});
            fse.copy(srcDir, destDir, { overwrite: true }).then(() => {
                let cmdOld = path.join(AppPaths.ANDROID_SDK, "cmdline-tools", "cmdline-tools")
                let cmdNew = path.join(AppPaths.ANDROID_SDK, "cmdline-tools", "latest")
                fs.rename(cmdOld, cmdNew, (err) => {
                    if (err) { Log.error(err); return; }
                    Log.info('Folder renamed successfully!')
                });
                Log.info('Folder copied successfully!')
                this.#notif.update(`Установка ${who_name}`, fileName, progress, 100)
                resolve('Folder copied successfully!')
            }).catch(err => {
                Log.error(err)
                this.#notif.error()
                reject(err)
            });
        })
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
