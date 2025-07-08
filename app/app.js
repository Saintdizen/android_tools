const {AppLayout, render, Log, Icons, ContentBlock, Styles, Dialog, ComboBox, Button, os, DownloadProgressNotification,
    path, fs, Label
} = require('chuijs');
const {MainPage} = require("./views/main_page");
const {Android} = require("./src/src");
const {AppPaths} = require("./settings/paths");
const decompress = require("decompress");
const fse = require("fs-extra");
const DownloadManager = require("@electron/remote").require("electron-download-manager");
const android = new Android()

class Apps extends AppLayout {
    constructor() {
        super();
        this.disableAppMenu()
        //
        let add_dialog = this.#createNewEmuDialog()
        //
        this.setRoute(new MainPage([add_dialog]))

        // let add_emu = AppLayout.BUTTON({
        //     icon: Icons.CONTENT.ADD,
        //     clickEvent: () => add_dialog.open()
        // })
        // this.addToHeaderLeft([add_emu])

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
    #createNewEmuDialog() {
        let main_block = new ContentBlock({
            direction: Styles.DIRECTION.COLUMN,
            wrap: Styles.WRAP.NOWRAP,
            align: Styles.ALIGN.CENTER,
            justify: Styles.JUSTIFY.CENTER
        });
        main_block.setWidth(Styles.SIZE.WEBKIT_FILL)
        main_block.setHeight(Styles.SIZE.WEBKIT_FILL)
        //
        let createNewEmuDialog = new Dialog({width: Styles.SIZE.MAX_CONTENT, height: Styles.SIZE.MAX_CONTENT})
        let android_device = new ComboBox({title:"Устройство", optionsLen: 1})
        android_device.addOptions(
            { title: "Телефон", value: "medium_phone"},
            //{ title: "Планшет", value: "-" }
        )
        let android_version = new ComboBox({title:"Версия Android", optionsLen: 1})
        android_version.addOptions(
            //{ title: "Android 14", value: "android-34"},
            //{ title: "Android 13", value: "android-33" },
            //{ title: "Android 12L", value: "android-32" },
            //{ title: "Android 12", value: "android-31" },
            //{ title: "Android 11", value: "android-30" },
            { title: "Android 10", value: "android-29" }
        )
        let android_system_image = new ComboBox({title:"Версия образа", optionsLen: 1})
        android_system_image.addOptions(
            { title: "Без Google Play", value: "default"},
            //{ title: "C Google Play", value: "google_apis_playstore" }
        )
        let android_arch = new ComboBox({title:"Архитектура процессора", optionsLen: 1})
        android_arch.addOptions(
            //{ title: "armeabi-v7a", value: "armeabi-v7a"},
            //{ title: "arm64-v8a", value: "arm64-v8a" },
            { title: "x86", value: "x86" },
            //{ title: "x86_64", value: "x86_64" }
        )
        let android_emu_create = new Button({title:"Создать"})
        let dialog_close = new Button({title:"Отмена"})
        //
        android_emu_create.addClickListener(() => {
            //
            android_device.setDisabled(true)
            android_version.setDisabled(true)
            android_system_image.setDisabled(true)
            android_arch.setDisabled(true)
            android_emu_create.setDisabled(true)
            //
            this.install("name_default", android_device.getValue(), android_version.getValue(), android_system_image.getValue(), android_arch.getValue())
        })
        dialog_close.addClickListener(() => {
            //
            android_device.setDisabled(false)
            android_version.setDisabled(false)
            android_system_image.setDisabled(false)
            android_arch.setDisabled(false)
            android_emu_create.setDisabled(false)
            //
            android_device.clear()
            android_version.clear()
            android_system_image.clear()
            android_arch.clear()
            //
            createNewEmuDialog.close()
            //
            android.cancel()
        })
        //
        main_block.add(android_device, android_version, android_system_image, android_arch, android_emu_create, dialog_close)
        createNewEmuDialog.addToBody(main_block)
        return createNewEmuDialog
    }
    install(name_avd, android_device, android_version, android_system_image, android_arch) {
        setTimeout(async () => {
            if (os.platform() === "linux") {
                await this.downloadCommandLineTools("https://dl.google.com/android/repository/commandlinetools-linux-13114758_latest.zip")
                await this.unzipCommandLineTools("commandlinetools-linux-13114758_latest.zip")
                await this.copyFolderAndRename()
                await android.installToolsLinux(name_avd, android_device, android_version, android_system_image, android_arch)
            } else if (os.platform() === "win32") {
                Log.info("WINDOWS")
            } else if (os.platform() === "darwin") {
                Log.info("MAC")
            }
        }, 2000)
    }
    async downloadCommandLineTools(link) {
        const notif = new DownloadProgressNotification({title: "Загрузка commandlinetools"})
        return new Promise((resolve, reject) => {
            notif.show()
            let fName = undefined
            DownloadManager.download({
                url: link,
                onProgress: (progress, item) => {
                    notif.update("Загрузка", item.getFilename(), Number(progress.progress).toFixed(), 100)
                    Log.info(`${item.getFilename()} ${progress.progress}`)
                }
            }, (error, info) => {
                if (error) { Log.error(error); reject(error); }
                console.log(info)
                Log.info(info.toString());
                notif.update("Загрузка", "Завершена", Number(100.0).toFixed(), 100)
                notif.done()
                resolve(info)
            });
        })
    }
    async unzipCommandLineTools(fileName) {
        return new Promise((resolve, reject) => {
            let path_file = path.join(AppPaths.DOWNLOADS_DIR, fileName)
            let dist_path = AppPaths.DOWNLOADS_DIR
            decompress(path_file, dist_path).then((files) => {
                resolve(files)
                Log.info(files)
            }).catch((error) => {
                reject(error)
                Log.error(error)
            });
        })
    }
    async copyFolderAndRename() {
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
                resolve('Folder copied successfully!')
            }).catch(err => {
                Log.error(err)
                reject(err)
            });
        })
    }
}

render(() => new Apps()).catch(err => Log.error(err))