const {Log, DownloadProgressNotification, path, fs} = require('chuijs');
const {AppPaths} = require("./paths");
const decompress = require("decompress");
const fse = require("fs-extra");
const DownloadManager = require("@electron/remote").require("electron-download-manager");
const { spawn } = require('child_process');

class InstallTools {
    #notif = new DownloadProgressNotification({title: "", text: ""})
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
        await this.#notif.update("Установка компонентов", "Подготовка...", 100, 100)
        if (process.platform === "linux") {
            Log.info("LINUX")
            if (!fs.existsSync(AppPaths.ANDROID_SDK, "cmdline-tools", "latest")) {
                await this.#download("CommandLine Tools", this.#links.linux.commandlinetools.link)
                await this.#unzip("CommandLine Tools", this.#links.linux.commandlinetools.fileName, 50)
                await this.#copyCmdlineTools("CommandLine Tools", this.#links.linux.commandlinetools.fileName, 100)
            }
        } else if (process.platform === "win32") {
            Log.info("WINDOWS")
            if (!fs.existsSync(AppPaths.JAVA_DIR, "bin", "java")) {
                await this.#download("Java", this.#links.win.java.link)
                await this.#unzip("Java", this.#links.win.java.fileName, 50)
                await this.#copyJava("Java", this.#links.win.java.fileName, 100)
            }
            if (!fs.existsSync(AppPaths.ANDROID_SDK, "cmdline-tools", "latest")) {
                await this.#download("CommandLine Tools", this.#links.win.commandlinetools.link)
                await this.#unzip("CommandLine Tools", this.#links.win.commandlinetools.fileName, 50)
                await this.#copyCmdlineTools("CommandLine Tools", this.#links.win.commandlinetools.fileName, 100)
            }
            await  this.#createInstallScriptWindows(name_avd, device, android_ver, image_type, arch)
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
                    this.#notif.update(`Загрузка ${who_name}`, filename, Number(progress.progress).toFixed(), 100)
                    Log.info(`${filename} ${progress.progress}`)
                }
            }, (error, info) => {
                if (error) { Log.error(error); reject(error); this.#notif.error(); }
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
            let srcDir = path.join(AppPaths.DOWNLOADS_DIR, "jdk-24.0.1")
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
                reject(err)
            });
        })
    }

    async #createInstallScriptWindows(name_avd, device, android_ver, image_type, arch) {
        return new Promise(async (resolve, reject) => {
        let install = `echo "START: Подготовка..."
@echo off

SET JAVA_HOME=${AppPaths.JAVA_DIR}
SET ANDROID_HOME=${AppPaths.ANDROID_SDK}
SET ANDROID_SDK_ROOT=%ANDROID_HOME%

echo %JAVA_HOME%
echo %ANDROID_HOME%

echo y|%ANDROID_SDK_ROOT%\\cmdline-tools\\latest\\bin\\sdkmanager.bat --licenses
echo "START: Установка Android Emulator"
echo y|%ANDROID_SDK_ROOT%\\cmdline-tools\\latest\\bin\\sdkmanager.bat emulator
echo "START: Установка Platform Tools"
echo y|%ANDROID_SDK_ROOT%\\cmdline-tools\\latest\\bin\\sdkmanager.bat platform-tools
echo "START: Загрузка Android"
echo y|%ANDROID_SDK_ROOT%\\cmdline-tools\\latest\\bin\\sdkmanager.bat "system-images;${android_ver};${image_type};${arch}"
echo "START: Создание эмулятора Android"
%ANDROID_SDK_ROOT%\\cmdline-tools\\latest\\bin\\avdmanager.bat create avd -d "${device}" -n ${name_avd} -k "system-images;${android_ver};${image_type};${arch}"`

            let path_script = await this.#createScript(install, name_avd, `install.bat`);

            const installProc = spawn('cmd.exe', ['/c', path_script]);

            let text = undefined
            let process = undefined
            let flag_update_notification = false

            installProc.stdout.on('data', (data) => {
                if (String(data).includes("START:")) {
                    flag_update_notification = true
                    text = data.toString().replace("START: ", "")
                } else {
                    flag_update_notification = false
                }
                let pattern = new RegExp("\\d+")
                if (pattern.test(String(data))) {
                    flag_update_notification = true
                    process = String(data).match(pattern)
                } else {
                    flag_update_notification = false
                }
                if (flag_update_notification) this.#notif.update("Установка зависимостей", text, Number(process).toFixed(), 100)
                Log.info(`stdout: ${data}`);
            });

            installProc.stderr.on('data', (data) => {
                Log.info(String(data))
                // if (String(data).includes("already exists")) {
                //     this.#notif.update("Установка зависимостей", "Завершена", 100, 100)
                //     this.#notif.done()
                // } else {
                //     this.#notif.error()
                //     Log.error(`stderr: ${data}`);
                // }
            });

            installProc.on('close', (code) => {
                if (code !== 0 && code !== 1) {
                    this.#notif.error()
                } else {
                    this.#notif.done()
                    //this.createStartScript(name_avd)
                    setTimeout(async () => {
                        await DataBases.AVD_DB.createAvdTable()
                        await DataBases.AVD_DB.addAvdData(device, android_ver, image_type, arch, name_avd)
                    }, 1)
                }
                Log.info(`child process exited with code ${code}`);
                resolve(`child process exited with code ${code}`)
            });

            installProc.on('error', (err) => {
                if (new RegExp("Android Virtual Device '.*' already exists").test(String(err))) {
                    this.#notif.update("Установка зависимостей", "Завершена", 100, 100)
                    this.#notif.done()
                } else {
                    Log.error(`Failed to start child process: ${err}`);
                }
                reject(err)
            });
        })
    }

    async #createScript(text, name_avd, name_script) {
        return new Promise((resolve) => {
            let path_scripts = path.join(AppPaths.AVD_DIR, name_avd)
            let path_script = path.join(path_scripts, name_script)
            if (!fs.existsSync(path_scripts)) {
                fs.mkdirSync(path_scripts, { recursive: true });
                Log.info(`Папка '${path_scripts}' успешно создана`)
            } else {
                Log.info(`Папка '${path_scripts}' уже существует`)
            }
            if (!fs.existsSync(path_script)) {
                fs.writeFileSync(path_script, text, "utf-8");
                Log.info(`Файл '${path_script}' успешно создан`)
            } else {
                Log.info(`Файл '${path_script}' уже существует`)
            }
            resolve(path_script)
        })
    }

    async runInstallWindows() {

    }
}

exports.InstallTools = InstallTools