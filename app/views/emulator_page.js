const {Page, ComboBox, Button, Log, Dialog, Styles, ContentBlock, os, app, path, App, DownloadProgressNotification, fs} = require("chuijs");
const decompress = require("decompress");
const fse = require("fs-extra");
const {Android} = require("../src/src");
const DownloadManager = require("@electron/remote").require("electron-download-manager");
let android = new Android()

class EmulatorPage extends Page {
    open_create_dialog = new Button({title:"Создать эмулятор"})
    get_emu_list = new Button({title:"Обновить"})
    constructor() {
        super();
        this.setTitle('Android Эмулятор');
        this.setFullHeight();
        this.setMain(false);
        this.setFullHeight()
        this.setFullWidth()
        //
        this.#createNewEmuDialog(this.open_create_dialog)
        this.add(this.open_create_dialog, this.get_emu_list)

        this.get_emu_list.addClickListener(async () => {
            await android.startEmulator("test1")
        })

    }
    #createNewEmuDialog(button_open) {
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
        let android_device = new ComboBox({title:"Устройство", optionsLen: 2})
        android_device.addOptions(
            { title: "Телефон", value: "medium_phone"},
            { title: "Планшет", value: "-" }
        )
        let android_version = new ComboBox({title:"Версия Android", optionsLen: 2})
        android_version.addOptions(
            { title: "Android 14", value: "android-34"},
            { title: "Android 13", value: "android-33" },
            { title: "Android 12L", value: "android-32" },
            { title: "Android 12", value: "android-31" },
            { title: "Android 11", value: "android-30" },
            { title: "Android 10", value: "android-29" }
        )
        let android_system_image = new ComboBox({title:"Версия образа", optionsLen: 2})
        android_system_image.addOptions(
            { title: "Без Google Play", value: "default"},
            { title: "C Google Play", value: "google_apis_playstore" }
        )
        let android_arch = new ComboBox({title:"Архитектура процессора", optionsLen: 2})
        android_arch.addOptions(
            { title: "armeabi-v7a", value: "armeabi-v7a"},
            { title: "arm64-v8a", value: "arm64-v8a" },
            { title: "x86", value: "x86" },
            { title: "x86_64", value: "x86_64" }
        )
        let android_emu_create = new Button({title:"Создать"})
        let dialog_close = new Button({title:"Отмена"})
        //
        button_open.addClickListener(() => createNewEmuDialog.open())
        //
        android_emu_create.addClickListener(() => {
            //
            android_device.setDisabled(true)
            android_version.setDisabled(true)
            android_system_image.setDisabled(true)
            android_arch.setDisabled(true)
            android_emu_create.setDisabled(true)
            //
            setTimeout(async () => {
                if (os.platform() === "linux") {
                    await this.downloadCommandLineTools("https://dl.google.com/android/repository/commandlinetools-linux-13114758_latest.zip")
                    await this.unzipCommandLineTools("commandlinetools-linux-13114758_latest.zip")
                    await this.copyFolderAndRename()
                    await android.installToolsLinux(android_device.getValue(), android_version.getValue(), android_system_image.getValue(), android_arch.getValue())
                } else if (os.platform() === "win32") {
                    Log.info("WINDOWS")
                } else if (os.platform() === "darwin") {
                    Log.info("MAC")
                }
            }, 2000)
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
        })
        //
        main_block.add(android_device, android_version, android_system_image, android_arch, android_emu_create, dialog_close)
        createNewEmuDialog.addToBody(main_block)
        this.add(createNewEmuDialog)
        return createNewEmuDialog
    }

    async downloadCommandLineTools(link) {
        const notif = new DownloadProgressNotification({title: "Загрузка commandlinetools"})
        return new Promise((resolve, reject) => {
            notif.show()
            DownloadManager.download({
                url: link,
                onProgress: (progress, item) => {
                    notif.update("Загрузка", item.getFilename(), Number(progress.progress).toFixed(), 100)
                    Log.info(`${item.getFilename()} ${progress.progress}`)
                }
            }, (error, info) => {
                if (error) { Log.error(error); reject(error); }
                Log.info(info.toString());
                notif.done()
                resolve(info)
            });
        })
    }

    async unzipCommandLineTools(fileName) {
        return new Promise((resolve, reject) => {
            let path_file = path.join(App.userDataPath(), "downloads", fileName)
            let dist_path = path.join(App.userDataPath(), "downloads")
            // let dist_path = path.join(App.userDataPath(), "android-sdk", "cmdline-tools", "latest")
            const decompress = require("decompress");
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
            const fse = require('fs-extra');
            let srcDir = path.join(App.userDataPath(), "downloads", "cmdline-tools")
            let destDir = path.join(App.userDataPath(), "android-sdk", "cmdline-tools", "cmdline-tools")
            if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, {recursive: true});
            fse.copy(srcDir, destDir, { overwrite: true }).then(() => {
                let cmdOld = path.join(App.userDataPath(), "android-sdk", "cmdline-tools", "cmdline-tools")
                let cmdNew = path.join(App.userDataPath(), "android-sdk", "cmdline-tools", "latest")
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

exports.EmulatorPage = EmulatorPage