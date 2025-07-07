const {Log, path, App, fs, DownloadProgressNotification, store} = require("chuijs");
const { spawn } = require('child_process');
const { randomBytes } = require('node:crypto');


class Android {
    #installProcess = undefined
    #emulatorList = []
    constructor() {
        if (!store.get("emuList")) {
            store.set("emuList", []);
        } else {
            this.#emulatorList = store.get("emuList");
        }
    }
    installToolsLinux(device, android_ver, image_type, arch) {
        let name_avd = this.#randomString(10)
        let install = `echo "START: Подготовка..."
export ANDROID_HOME=${path.join(App.userDataPath(), 'android-sdk')}
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

        let path_script = this.#createScript(install, `src_${name_avd}.sh`);

        this.#installProcess = spawn('sh', [path_script]);
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
            notif.error()
            Log.error(`stderr: ${data}`);
        });

        this.#installProcess.on('close', (code) => {
            if (code !== 0) {
                notif.error()
            } else {
                notif.done()
                this.#emulatorList.push({
                    name: name_avd,
                    device: device,
                    android_version: android_ver,
                    image_type: image_type,
                    arch: arch
                })
            }
            Log.info(`child process exited with code ${code}`);
        });

        this.#installProcess.on('error', (err) => {
            notif.error()
            Log.error(`Failed to start child process: ${err}`);
        });
    }
    startEmulator(name) {
        let start_emu = `
export ANDROID_HOME=${path.join(App.userDataPath(), 'android-sdk')}
export ANDROID_SDK_ROOT=$ANDROID_HOME
#
$ANDROID_HOME/emulator/emulator -avd ${name}`
        let path_script = this.#createScript(start_emu, `start_${name}.sh`);
        let proc = spawn('sh', [path_script]);

        proc.stdout.on('data', (data) => {
            Log.info(data);
        });

        proc.stderr.on('data', (data) => {
            Log.error(`stderr: ${data}`);
        });

        proc.on('close', (code) => {
            Log.info(`ЭРОН! ДОН-ДОН! ${code}`);
        });

        proc.on('error', (err) => {
            Log.error(`Failed to start child process: ${err}`);
        });
    }
    #createScript(text, name) {
        let path_scripts = path.join(App.userDataPath(), "scripts", name)
        let path_script = path.join(path_scripts, name)
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
    #randomString(length) {
      if (length % 2 !== 0) length++
      return randomBytes(length / 2).toString("hex");
    }
}

exports.Android = Android