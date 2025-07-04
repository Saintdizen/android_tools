const {Page, ContentBlock, Styles, Label} = require('chuijs');

class MainPage extends Page {
    #block_main = new ContentBlock({
        direction: Styles.DIRECTION.COLUMN,
        wrap: Styles.WRAP.NOWRAP,
        align: Styles.ALIGN.CENTER,
        justify: Styles.JUSTIFY.CENTER
    });
    constructor() {
        super();
        this.setTitle('Начальная страница');
        this.setFullHeight();
        this.setMain(true);
        this.setFullHeight()
        this.setFullWidth()

        this.add(this.#block_main)
        this.#block_main.setWidth(Styles.SIZE.WEBKIT_FILL);
        this.#block_main.setHeight(Styles.SIZE.WEBKIT_FILL);
        this.#block_main.add(
            new Label({
                markdownText: "**Начальная страница**",
                wordBreak: Styles.WORD_BREAK.BREAK_ALL
            })
        );
        this.add(this.#block_main)
    }
}

exports.MainPage = MainPage