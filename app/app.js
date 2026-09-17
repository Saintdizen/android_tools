const { AppLayout, render, Log, Icons } = require('chuijs');
const { MainPage } = require("./views/main_page");
const { InstallTools } = require('./settings/install_tools');
const { Android } = require("./src/src")

class Apps extends AppLayout {
    #android = new Android()
    constructor() {
        super();
        this.disableAppMenu()
        //
        this.setRoute(new MainPage())

        let launch_emu = AppLayout.BUTTON({
            // title: "Запуск",
            icon: Icons.AUDIO_VIDEO.PLAY_ARROW,
            reverse: true,
            // Имя не задаём: эмулятор определяется по каталогу приложения
            clickEvent: () => this.#android.startEmulator()
        })
        let stop_emu = AppLayout.BUTTON({
            // title: "Остановка",
            icon: Icons.AUDIO_VIDEO.STOP,
            reverse: true,
            clickEvent: () => this.#android.stopEmulator()
        })
        this.addToHeaderLeft([launch_emu, stop_emu])
    }
    install(name_avd, android_device, android_version, android_system_image, android_arch) {
        setTimeout(async () => {
            let install_test = new InstallTools()
            await install_test.start(name_avd, android_device, android_version, android_system_image, android_arch)
        }, 2000)
    }
}

render(() => new Apps()).catch(err => Log.error(err))