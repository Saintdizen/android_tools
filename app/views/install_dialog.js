const {AppLayout, Button, FieldSet, Icons, Label, Paragraph, Select, TextInput, Log, Styles} = require('chuijs');
const {InstallTools} = require('../settings/install_tools');
const Scripts = require('../settings/scripts');

/**
 * Установка компонентов и эмулятора из интерфейса.
 *
 * Диалог открывается кнопкой в шапке приложения. Выбор версии Android, типа системного
 * образа и архитектуры сделан списками с фиксированным набором значений: они попадают
 * в текст скрипта установки, а проверку всё равно выполняет Scripts.validateInstallParams
 * (внутри InstallTools.start()).
 *
 * Необязательный аргумент — уведомление о созданном AVD: его получает список эмуляторов,
 * чтобы обновиться, пока диалог установки остаётся открытым.
 */

const DEFAULT_AVD_NAME = "Android_Tools_AVD"
const DEFAULT_DEVICE = "medium_phone"
const DEFAULT_ANDROID_VERSION = "android-34"
const DEFAULT_IMAGE_TYPE = "google_apis"
const DEFAULT_ARCH = "x86_64"

// android-34 — значение по умолчанию: для него есть готовые образы во всех вариантах
// типа и архитектуры, а связка с platform-tools и эмулятором проверена.
const ANDROID_VERSIONS = [
    {title: "android-34 (Android 14)", value: "android-34"},
    {title: "android-35 (Android 15)", value: "android-35"},
    {title: "android-36 (Android 16)", value: "android-36"},
    {title: "android-33 (Android 13)", value: "android-33"},
    {title: "android-32 (Android 12L)", value: "android-32"},
    {title: "android-31 (Android 12)", value: "android-31"},
    {title: "android-30 (Android 11)", value: "android-30"},
    {title: "android-29 (Android 10)", value: "android-29"}
]

const IMAGE_TYPES = [
    {title: "google_apis — с сервисами Google", value: "google_apis"},
    {title: "google_apis_playstore — с Play Маркетом", value: "google_apis_playstore"},
    {title: "default — без сервисов Google", value: "default"}
]

const ARCHITECTURES = [
    {title: "x86_64", value: "x86_64"},
    {title: "arm64-v8a", value: "arm64-v8a"},
    {title: "x86", value: "x86"},
    {title: "armeabi-v7a", value: "armeabi-v7a"}
]

class InstallDialog {
    #name_avd = new TextInput({
        name: "name_avd",
        title: "Имя эмулятора (AVD)",
        placeholder: DEFAULT_AVD_NAME,
        value: DEFAULT_AVD_NAME,
        width: "-webkit-fill-available"
    })
    #device = new TextInput({
        name: "device",
        title: "Устройство (avdmanager -d)",
        placeholder: DEFAULT_DEVICE,
        value: DEFAULT_DEVICE,
        width: "-webkit-fill-available"
    })
    #android_ver_select = new Select({name: "android_ver", title: "Версия Android", width: Styles.SIZE.WEBKIT_FILL})
    #image_type_select = new Select({name: "image_type", title: "Тип системного образа", width: Styles.SIZE.WEBKIT_FILL})
    #arch_select = new Select({name: "arch", title: "Архитектура процессора", width: Styles.SIZE.WEBKIT_FILL})
    #status = new Label({text: "", width: Styles.SIZE.WEBKIT_FILL, wordBreak: "normal"})
    #install_button = new Button({
        title: "Установить",
        icon: Icons.ACTIONS.SYSTEM_UPDATE_ALT,
        reverse: true,
        clickEvent: () => this.#install()
    })
    #installing = false
    #android_ver = DEFAULT_ANDROID_VERSION
    #image_type = DEFAULT_IMAGE_TYPE
    #arch = DEFAULT_ARCH
    #on_avd_created

    constructor(on_avd_created = () => {}) {
        this.#on_avd_created = on_avd_created
        this.#fillSelection(this.#android_ver_select, ANDROID_VERSIONS, DEFAULT_ANDROID_VERSION, (value) => {
            this.#android_ver = value
        })
        this.#fillSelection(this.#image_type_select, IMAGE_TYPES, DEFAULT_IMAGE_TYPE, (value) => {
            this.#image_type = value
        })
        this.#fillSelection(this.#arch_select, ARCHITECTURES, DEFAULT_ARCH, (value) => {
            this.#arch = value
        })
    }

    /**
     * Select отдаёт выбранное значение только событием: его getValue() возвращает подпись
     * опции, а не option_value, поэтому значение запоминаем из события.
     */
    #fillSelection(select, options, default_value, assign) {
        select.addOptions(...options)
        select.addValueChangeListener((event) => {
            const value = event?.detail?.value
            if (!options.some(option => option.value === value)) {
                Log.error(`Неизвестное значение списка: ${value}`)
                return
            }
            assign(value)
        })
        select.setDefaultOption(default_value)
    }

    /** Кнопка шапки приложения: сам диалог создаётся здесь и открывается по нажатию. */
    set() {
        const hint1 = new Paragraph(
            "Загружаются Command-line Tools, Android Emulator, platform-tools и системный образ (на Windows ещё JDK) — это несколько гигабайт."
        )
        const hint2 = new Paragraph(
            "Прогресс виден в уведомлении приложения."
        )
        const hint3 = new Paragraph(
            "Созданный эмулятор запускается кнопкой ▶ в шапке, а выбрать нужный AVD, запустить или удалить его можно в диалоге «Эмуляторы»."
        )
        const params = new FieldSet({
            title: "Параметры эмулятора",
            style: {width: "-webkit-fill-available", direction: "column", align: "stretch"},
            components: [
                this.#name_avd,
                this.#device,
                this.#android_ver_select,
                this.#image_type_select,
                this.#arch_select,
                hint1,
                hint2,
                hint3,
                this.#install_button,
                this.#status
            ]
        })
        return AppLayout.DIALOG({
            title: "Установка",
            icon: Icons.ACTIONS.SYSTEM_UPDATE_ALT,
            reverse: true,
            dialogOptions: {
                title: "Установка компонентов и эмулятора",
                closeOutSideClick: false,
                style: {width: Styles.SIZE.MAX_CONTENT, height: Styles.SIZE.MAX_CONTENT, direction: "column", align: "stretch"},
                components: [params]
            }
        })
    }

    async #install() {
        if (this.#installing) return

        const name_avd = this.#name_avd.getValue().trim()
        const device = this.#device.getValue().trim()
        const invalid = Scripts.validateInstallParams(name_avd, device, this.#android_ver, this.#image_type, this.#arch)
        if (invalid) {
            this.#status.setText(`Ошибка: ${invalid}`)
            return
        }

        this.#installing = true
        this.#install_button.setDisabled(true)
        this.#status.setText(`Установка "${name_avd}" началась, дождитесь уведомления`)
        try {
            await new InstallTools().start(name_avd, device, this.#android_ver, this.#image_type, this.#arch)
            // Новый AVD мог появиться уже в открытом списке эмуляторов.
            this.#on_avd_created(name_avd)
            this.#status.setText(`Готово: эмулятор "${name_avd}" создан`)
        } catch (error) {
            this.#status.setText(`Установка не выполнена: ${error.message ?? error}`)
        } finally {
            this.#installing = false
            this.#install_button.setDisabled(false)
        }
    }
}

exports.InstallDialog = InstallDialog
