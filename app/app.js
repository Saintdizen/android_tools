const { AppLayout, render, Log, Icons, ContentBlock, Styles, Dialog, ComboBox, Button, os, Label } = require('chuijs');
const { MainPage } = require("./views/main_page");
const { InstallTools } = require('./settings/install_tools');

class Apps extends AppLayout {
    constructor() {
        super();
        this.disableAppMenu()
        //
        this.setRoute(new MainPage())

        this.install("name_default", "medium_phone", "android-29", "default", "x86")

        let label_emu = new Label({text: "Эмулятор:"})

        let launch_emu = AppLayout.BUTTON({
            title: "Запуск",
            icon: Icons.AUDIO_VIDEO.PLAY_ARROW,
            reverse: true,
            clickEvent: () => android.startEmulator("name_default")
        })
        let stop_emu = AppLayout.BUTTON({
            title: "Остановка",
            icon: Icons.AUDIO_VIDEO.STOP,
            reverse: true,
            clickEvent: () => android.stopEmulator()
        })
        this.addToHeaderLeft([label_emu.set(), launch_emu, stop_emu])
    }
    install(name_avd, android_device, android_version, android_system_image, android_arch) {
        setTimeout(async () => {
            let install_test = new InstallTools()
            if (os.platform() === "linux") {
                await install_test.start()
            } else if (os.platform() === "win32") {
                await install_test.start(name_avd, android_device, android_version, android_system_image, android_arch)
            }
        }, 2000)
    }
}

render(() => new Apps()).catch(err => Log.error(err))