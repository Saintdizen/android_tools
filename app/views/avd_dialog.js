const {AppLayout, Button, ContentBlock, Dialog, FieldSet, Icons, Label, Paragraph, Popup, Select, Styles} = require('chuijs');

/**
 * Управление установленными эмуляторами: выбор конкретного AVD, запуск и удаление.
 *
 * Диалог собирается вручную (а не через AppLayout.DIALOG), потому что список AVD
 * перестраивается при каждом открытии: после установки или удаления он меняется,
 * а Select из chuijs умеет только добавлять опции, но не удалять их.
 */
class AvdDialog {
    #android
    #dialog = new Dialog({width: Styles.SIZE.MAX_CONTENT, closeOutSideClick: false})
    #body = new ContentBlock({direction: "column", align: "stretch"})
    #status = new Label({text: "", width: Styles.SIZE.WEBKIT_FILL, wordBreak: "normal"})
    #running_note = new Paragraph("")
    #launch_button = new Button({
        title: "Запустить",
        icon: Icons.AUDIO_VIDEO.PLAY_ARROW,
        reverse: true,
        clickEvent: () => this.#launch()
    })
    #stop_button = new Button({
        title: "Остановить",
        icon: Icons.AUDIO_VIDEO.STOP,
        reverse: true,
        clickEvent: () => this.#stop()
    })
    #delete_button = new Button({
        title: "Удалить",
        icon: Icons.ACTIONS.DELETE,
        reverse: true,
        clickEvent: () => this.#remove()
    })
    #avd_select = undefined
    #selected = undefined
    #busy = false

    constructor(android) {
        this.#android = android
        // Самостоятельный выход эмулятора тоже меняет состояние — обновляем разметку.
        this.#android.onRunningChange(() => this.#updateRunning())
        this.#body.setWidth(Styles.SIZE.MAX_CONTENT)
        this.#dialog.addToHeader(this.#headerBlock())
        this.#dialog.addToBody(this.#body)
        // Dialog не добавляет себя в документ сам (в отличие от AppLayout.DIALOG).
        document.body.appendChild(this.#dialog.set())
    }

    /** Кнопка шапки приложения: открывает список эмуляторов. */
    set() {
        return AppLayout.BUTTON({
            title: "Эмуляторы",
            icon: Icons.ACTIONS.ANDROID,
            reverse: true,
            clickEvent: () => this.#open()
        })
    }

    /**
     * Список AVD изменился извне (например, установка создала новый эмулятор).
     * Закрытый диалог не трогаем: при открытии он всё равно читает список заново.
     */
    avdListChanged(nameAvd) {
        if (nameAvd !== undefined) this.#selected = nameAvd
        if (!this.#dialog.isOpen) return
        this.#refresh()
    }

    #headerBlock() {
        const header = new ContentBlock({
            direction: "row",
            wrap: "nowrap",
            align: "center",
            justify: "space-between",
            disableMarginChild: true
        })
        header.setWidth(Styles.SIZE.WEBKIT_FILL)
        header.add(
            new Label({markdownText: "**Эмуляторы**", width: Styles.SIZE.MAX_CONTENT, fontSize: "14pt"}),
            new Button({icon: Icons.NAVIGATION.CLOSE, reverse: true, clickEvent: () => this.#dialog.close()})
        )
        return header
    }

    #open() {
        this.#refresh()
        this.#dialog.open()
    }

    /** Список AVD читается заново: он меняется после установки и удаления. */
    #refresh() {
        const names = this.#android.avdNames()
        this.#body.clear()
        if (names.length === 0) {
            this.#avd_select = undefined
            this.#body.add(new Paragraph("Эмуляторы не найдены. Создайте их кнопкой «Установка» в шапке приложения."))
            // Строка состояния остаётся в разметке и при пустом списке:
            // иначе сообщение об удалении последнего AVD было бы некуда показать.
            this.#body.add(this.#status)
            this.#updateRunning()
            return
        }
        this.#avd_select = this.#buildSelect(names)
        // Надпись и доступность кнопок приводим в актуальное состояние до сборки формы.
        this.#updateRunning()
        this.#body.add(new FieldSet({
            title: "Установленные эмуляторы",
            style: {width: Styles.SIZE.MAX_CONTENT, direction: "column", align: "stretch"},
            components: [
                this.#avd_select,
                this.#running_note,
                new Paragraph("Запуск открывает окно эмулятора, удаление стирает его конфигурацию, данные и скрипты."),
                this.#buttonsBlock(),
                this.#status
            ]
        }))
    }

    /** Надпись о запущенном эмуляторе и доступность кнопок — без пересборки формы. */
    #updateRunning() {
        const running = this.#android.runningAvd()
        this.#running_note.setText(running === undefined ? "Сейчас ничего не запущено" : `Сейчас запущен: ${running}`)
        this.#applyBusy()
    }

    #buildSelect(names) {
        const select = new Select({name: "avd", title: "Эмулятор (AVD)", width: Styles.SIZE.WEBKIT_FILL})
        // Подпись опции совпадает со значением, но значение берём из события:
        // Select.getValue() возвращает подпись, а не option_value.
        select.addOptions(...names.map(name => ({title: name, value: name})))
        select.addValueChangeListener((event) => {
            const value = event?.detail?.value
            if (names.includes(value)) this.#selected = value
            // От выбора зависит доступность удаления (запущенный AVD удалить нельзя).
            this.#applyBusy()
        })
        // Ранее выбранный эмулятор сохраняем, если он ещё существует.
        select.setDefaultOption(names.includes(this.#selected) ? this.#selected : names[0])
        return select
    }

    #buttonsBlock() {
        const row = new ContentBlock({direction: "row", align: "center", justify: "flex-start"})
        row.add(this.#launch_button, this.#stop_button, this.#delete_button)
        this.#applyBusy()
        return row
    }

    /**
     * Кнопки блокируются на время операции, без единого AVD и когда действие неприменимо:
     * нельзя запускать второй эмулятор, останавливать нечего и удалять запущенный AVD.
     */
    #applyBusy() {
        const has_avd = this.#avd_select !== undefined
        const running = this.#android.runningAvd()
        this.#launch_button.setDisabled(this.#busy || !has_avd || running !== undefined)
        this.#stop_button.setDisabled(this.#busy || running === undefined)
        this.#delete_button.setDisabled(this.#busy || !has_avd || running === this.#selected)
    }

    /** Запуск синхронный (spawn не ждёт), поэтому и метод без async. */
    #launch() {
        if (this.#busy) return
        const name = this.#selected
        if (!name) {
            this.#status.setText("Выберите эмулятор в списке")
            return
        }
        this.#busy = true
        this.#applyBusy()
        this.#status.setText(`Запуск "${name}"...`)
        try {
            this.#android.startEmulator(name)
            this.#updateRunning()
            this.#status.setText(`Эмулятор "${name}" запускается — окно появится через несколько секунд`)
        } catch (error) {
            this.#status.setText(`Не удалось запустить: ${error.message ?? error}`)
        } finally {
            this.#busy = false
            this.#applyBusy()
        }
    }

    /** Остановка запущенного эмулятора (кнопка шапки делает то же самое). */
    #stop() {
        if (this.#busy) return
        this.#busy = true
        this.#applyBusy()
        try {
            const stopped = this.#android.stopEmulator()
            this.#updateRunning()
            this.#status.setText(`Эмулятор "${stopped}" останавливается`)
        } catch (error) {
            this.#status.setText(`Не удалось остановить: ${error.message ?? error}`)
        } finally {
            this.#busy = false
            this.#applyBusy()
        }
    }

    async #remove() {
        if (this.#busy) return
        const name = this.#selected
        if (!name) {
            this.#status.setText("Выберите эмулятор в списке")
            return
        }
        const confirmed = await new Popup().confirm({
            title: `Удалить эмулятор "${name}"?`,
            message: "Будут удалены конфигурация, данные и скрипты запуска этого AVD.",
            okText: "Удалить",
            cancelText: "Отмена"
        })
        if (confirmed !== true) return

        this.#busy = true
        this.#applyBusy()
        this.#status.setText(`Удаление "${name}"...`)
        try {
            await this.#android.deleteEmulator(name)
            this.#selected = undefined
            this.#refresh()
            this.#status.setText(`Эмулятор "${name}" удалён`)
        } catch (error) {
            this.#status.setText(`Не удалось удалить: ${error.message ?? error}`)
        } finally {
            this.#busy = false
            this.#applyBusy()
        }
    }
}

exports.AvdDialog = AvdDialog
