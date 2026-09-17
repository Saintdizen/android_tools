const { AppLayout, render, Log, Icons } = require('chuijs');
const { MainPage } = require("./views/main_page");
const { InstallDialog } = require('./views/install_dialog');
const { AvdDialog } = require('./views/avd_dialog');
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
            // Имя не задаём: запускается единственный AVD, иначе нужный выбирается в «Эмуляторы»
            clickEvent: () => {
                try {
                    this.#android.startEmulator()
                } catch (error) {
                    Log.error(error.message ?? error)
                }
            }
        })
        let stop_emu = AppLayout.BUTTON({
            // title: "Остановка",
            icon: Icons.AUDIO_VIDEO.STOP,
            reverse: true,
            clickEvent: () => {
                try {
                    this.#android.stopEmulator()
                } catch (error) {
                    Log.error(error.message ?? error)
                }
            }
        })
        // Кнопки установки и списка AVD: экземпляр Android у менеджера общий с кнопками запуска/останова.
        let avd_manager = new AvdDialog(this.#android)
        // Установка сообщает менеджеру эмуляторов о новом AVD: открытый список обновляется сразу.
        let install_tools = new InstallDialog((name_avd) => avd_manager.avdListChanged(name_avd))
        this.addToHeaderLeft([install_tools.set(), avd_manager.set(), launch_emu, stop_emu])
    }
}

render(() => new Apps()).catch(err => Log.error(err))