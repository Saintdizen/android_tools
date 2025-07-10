const {Log, path, fs, DownloadProgressNotification} = require("chuijs");
const { spawn } = require('child_process');
const { randomBytes } = require('node:crypto');
const {AppPaths} = require("../settings/paths");
const {DataBases} = require("../databases/start_db");


class Android {
    #installProcess = undefined
    #start_process = undefined
    constructor() {}
    installToolsLinux(name_avd, device, android_ver, image_type, arch) {
        // let name_avd = this.#randomString(10)
        let install = `echo "START: Подготовка..."
export ANDROID_HOME="${AppPaths.ANDROID_SDK}"
export ANDROID_SDK_ROOT=$ANDROID_HOME
#
yes | $ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager --licenses > /dev/null
#
echo "START: Установка Android Emulator"
yes | $ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager emulator
#
echo "START: Установка Platform Tools"
yes | $ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager platform-tools
echo "START: Загрузка Android"
yes | $ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager "system-images;${android_ver};${image_type};${arch}"
echo "START: Создание эмулятора Android"
$ANDROID_HOME/cmdline-tools/latest/bin/avdmanager create avd -d "${device}" -n ${name_avd} -k "system-images;${android_ver};${image_type};${arch}"`

        let path_script = this.#createScript(install, name_avd, `create.sh`);

        this.#installProcess = spawn('sh', [`${path_script}`]);
        const notif = new DownloadProgressNotification({title: "Установка зависимостей", text: "Подготовка..."})
        notif.show()
        let text = undefined
        let process = undefined
        let flag_update_notification = false

        this.#installProcess.stdout.on('data', (data) => {
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
            if (flag_update_notification) notif.update("Установка зависимостей", text, Number(process).toFixed(), 100)
            Log.info(`stdout: ${data}`);
        });

        this.#installProcess.stderr.on('data', (data) => {
            if (String(data).includes("already exists")) {
                notif.update("Установка зависимостей", "Завершена", 100, 100)
                notif.done()
            } else {
                notif.error()
                Log.error(`stderr: ${data}`);
            }
        });

        this.#installProcess.on('close', (code) => {
            if (code !== 0 && code !== 1) {
                notif.error()
            } else {
                notif.done()
                this.createStartScript(name_avd)
                setTimeout(async () => {
                    await DataBases.AVD_DB.createAvdTable()
                    await DataBases.AVD_DB.addAvdData(device, android_ver, image_type, arch, name_avd)
                }, 1)
            }
            Log.info(`child process exited with code ${code}`);
        });

        this.#installProcess.on('error', (err) => {
            if (new RegExp("Android Virtual Device '.*' already exists").test(String(err))) {
                notif.update("Установка зависимостей", "Завершена", 100, 100)
                notif.done()
            } else {
                notif.error()
                Log.error(`Failed to start child process: ${err}`);
            }
        });
    }
    installToolsWindow(name_avd, device, android_ver, image_type, arch) {
        let install = `echo "START: Подготовка..."
@echo off

SET JAVA_HOME=C:\Users\DethMond\Downloads\test\jdk-24_windows-x64_bin\jdk-24.0.1
SET ANDROID_HOME=C:\Users\DethMond\Downloads\test\android-sdk
SET ANDROID_SDK_ROOT=%ANDROID_HOME%

echo %ANDROID_HOME%
@REM https://download.oracle.com/java/24/latest/jdk-24_windows-x64_bin.zip

echo y|%ANDROID_SDK_ROOT%\cmdline-tools\latest\bin\sdkmanager.bat --licenses

echo "START: Установка Android Emulator"
echo y|%ANDROID_SDK_ROOT%\cmdline-tools\latest\bin\sdkmanager emulator
echo "START: Установка Platform Tools"
echo y|%ANDROID_SDK_ROOT%\cmdline-tools\latest\bin\sdkmanager platform-tools
echo "START: Загрузка Android"
echo y|%ANDROID_SDK_ROOT%\cmdline-tools\latest\bin\sdkmanager "system-images;android-29;default;x86"
echo "START: Создание эмулятора Android"
%ANDROID_SDK_ROOT%\cmdline-tools\latest\bin\avdmanager create avd -d "medium_phone" -n test_win_avd -k "system-images;android-29;default;x86"`

        let path_script = this.#createScript(install, name_avd, `create.sh`);

        this.#installProcess = spawn('sh', [`${path_script}`]);
        const notif = new DownloadProgressNotification({title: "Установка зависимостей", text: "Подготовка..."})
        notif.show()
        let text = undefined
        let process = undefined
        let flag_update_notification = false

        this.#installProcess.stdout.on('data', (data) => {
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
            if (flag_update_notification) notif.update("Установка зависимостей", text, Number(process).toFixed(), 100)
            Log.info(`stdout: ${data}`);
        });

        this.#installProcess.stderr.on('data', (data) => {
            if (new RegExp(`Android Virtual Device '.*' already exists`).test(String(data))) {
                notif.update("Установка зависимостей", "Завершена", 100, 100)
                notif.done()
            } else {
                notif.error()
                Log.error(`stderr: ${data}`);
            }
        });

        this.#installProcess.on('close', (code) => {
            if (code !== 0 && code !== 1) {
                notif.error()
            } else {
                notif.done()
                this.createStartScript(name_avd)
                setTimeout(async () => {
                    await DataBases.AVD_DB.createAvdTable()
                    await DataBases.AVD_DB.addAvdData(device, android_ver, image_type, arch, name_avd)
                }, 1)
            }
            Log.info(`child process exited with code ${code}`);
        });

        this.#installProcess.on('error', (err) => {
            if (new RegExp("Android Virtual Device '.*' already exists").test(String(err))) {
                notif.update("Установка зависимостей", "Завершена", 100, 100)
                notif.done()
            } else {
                notif.error()
                Log.error(`Failed to start child process: ${err}`);
            }
        });
    }
    cancel() {
        this.#installProcess.kill()
    }
    startEmulator(name) {
        if (process.platform === "linux") {
            this.#start_process = spawn('sh', [`${path.join(AppPaths.AVD_DIR, name, "start.sh")}`]);
        } else if (process.platform === "win32") {
            Log.info("WINDOWS")
        }
        this.#start_process.stdout.on('data', (data) => {
            Log.info(`stdout: ${data}`);
        });
        this.#start_process.stderr.on('data', (data) => {
            Log.error(`stderr: ${data}`);
        });
        this.#start_process.on('close', (code) => {
            Log.info(`close: ${code}`);
        });
        this.#start_process.on('error', (err) => {
            Log.error(`Failed to start child process: ${err}`);
        });
    }
    stopEmulator() {
        Log.info("KILL EMULATOR!")
        if (process.platform === "linux") {
            spawn('kill', [String(this.#start_process.pid + 1)])
        } else if (process.platform === "win32") {
            Log.info("WINDOWS")
        }
    }
    createStartScript(name) {
        if (process.platform === "linux") {
            let start_emu = `
export ANDROID_HOME=${AppPaths.ANDROID_SDK}
export ANDROID_SDK_ROOT=$ANDROID_HOME
#
$ANDROID_HOME/emulator/emulator -avd ${name}`
            return this.#createScript(start_emu, name, `start.sh`)
        } else if (process.platform === "win32") {
            let start_emu = `
SET ANDROID_HOME=${AppPaths.ANDROID_SDK}
SET ANDROID_SDK_ROOT="%ANDROID_HOME%"

%ANDROID_SDK_ROOT%\\emulator\\emulator -avd ${name}`
            return this.#createScript(start_emu, name, `start.sh`)
        }

    }
    #createScript(text, name_avd, name_script) {
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
        return path_script
    }
}

exports.Android = Android