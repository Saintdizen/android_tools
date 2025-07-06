const {Page, ComboBox, Button, Log, Dialog, Styles, ContentBlock} = require("chuijs");

class EmulatorPage extends Page {
    open_create_dialog = new Button({title:"Создать эмулятор"})
    constructor() {
        super();
        this.setTitle('Android Эмулятор');
        this.setFullHeight();
        this.setMain(false);
        this.setFullHeight()
        this.setFullWidth()
        //
        let create_dialog = this.#createNewEmuDialog()
        this.open_create_dialog.addClickListener(() => create_dialog.open())
        this.add(this.open_create_dialog, create_dialog)
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
        android_emu_create.addClickListener(() => {
            let string1 = ``

            let str = `create avd -d "${android_device.getValue()}" -n test1 -k "system-images;${android_version.getValue()};${android_system_image.getValue()};${android_arch.getValue()}"`
            Log.info(str)
        })
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
        return createNewEmuDialog
    }
}

exports.EmulatorPage = EmulatorPage