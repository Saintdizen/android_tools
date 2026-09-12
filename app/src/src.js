const {Log, path} = require("chuijs");
const { spawn } = require('child_process');
const {AppPaths} = require("../settings/paths");


class Android {
    #start_process = undefined
    constructor() {}
    startEmulator(name) {
        if (process.platform === "linux") {
            this.#start_process = spawn('sh', [`${path.join(AppPaths.AVD_DIR, name, "start.sh")}`], {detached: true});
        } else if (process.platform === "win32") {
            this.#start_process = spawn('cmd.exe', ['/c', `${path.join(AppPaths.AVD_DIR, name, "start.bat")}`]);
        } else {
            Log.error(`Запуск эмулятора не поддерживается на платформе: ${process.platform}`)
            return
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
}

exports.Android = Android