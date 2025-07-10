const {path, App, fs} = require("chuijs");

class AppPaths {
    static #paths = [
        path.join(App.userDataPath(), "android"),
        path.join(App.userDataPath(), "android", 'android-sdk'),
        path.join(App.userDataPath(), "android", 'android-avd'),
        path.join(App.userDataPath(), "android", 'downloads'),
        path.join(App.userDataPath(), "android", 'java')
    ]
    constructor() {}
    static install() {
        process.env.ANDROID_HOME = this.#paths[1]
        process.env.ANDROID_SDK_ROOT = this.#paths[1]
        for (let path of this.#paths) {
            if (!fs.existsSync(path)) fs.mkdirSync(path, {recursive: true})
        }
    }
    static MAIN_FOLDER_ANDROID = String(this.#paths[0])
    static ANDROID_SDK = String(this.#paths[1])
    static AVD_DIR = String(this.#paths[2])
    static DOWNLOADS_DIR = String(this.#paths[3])
    static JAVA_DIR = String(this.#paths[4])
}

exports.AppPaths = AppPaths;