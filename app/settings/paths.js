const {path, App, fs} = require("chuijs");

class AppPaths {
    static #paths = [
        path.join(App.userDataPath(), "android", 'android-sdk'),
        path.join(App.userDataPath(), "android", 'android-avd'),
        path.join(App.userDataPath(), "android", 'downloads')
    ]
    constructor() {}
    static install() {
        process.env.ANDROID_HOME = this.#paths[0]
        process.env.ANDROID_SDK_ROOT = this.#paths[0]
        for (let path of this.#paths) if (!fs.existsSync(path)) fs.mkdirSync(path, {recursive: true});
    }
    static ANDROID_SDK = this.#paths[0];
    static AVD_DIR = this.#paths[1]
    static DOWNLOADS_DIR = this.#paths[2]
}

exports.AppPaths = AppPaths;