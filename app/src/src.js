const {Log, path} = require("chuijs");
const { spawn } = require('child_process');
const {AppPaths} = require("../settings/paths");


class Android {
    #installProcess = undefined
    #start_process = undefined
    constructor() {}
    startEmulator(name) {
        if (process.platform === "linux") {
            this.#start_process = spawn('sh', [`${path.join(AppPaths.AVD_DIR, name, "start.sh")}`]);
        } else if (process.platform === "win32") {
            this.#start_process = spawn('cmd.exe', ['/c', `${path.join(AppPaths.AVD_DIR, name, "start.bat")}`]);
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
            spawn('taskkill', ['/pid', this.#start_process.pid, '/t'])
        }
    }
}

exports.Android = Android