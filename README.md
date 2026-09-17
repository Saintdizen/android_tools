# Android tools

Десктопное приложение (Electron + [chUiJS](https://github.com/Saintdizen/chuijs)) для работы с Android-эмуляторами:
устанавливает Android SDK и эмулятор, создаёт и удаляет AVD, запускает и останавливает эмуляторы,
а в центре окна показывает **Appium Inspector** для работы с запущенным эмулятором.

`productName`: `Android_Tools`, версия — в `package.json`.

## Что умеет

| Кнопка в шапке | Действие |
| --- | --- |
| **Установка** | диалог установки компонентов и создания эмулятора (AVD) |
| **Эмуляторы** | список созданных AVD: «Запустить», «Остановить», «Удалить» |
| **▶** | быстрый запуск единственного эмулятора |
| **⏹** | остановка эмулятора, запущенного приложением |

Центральная область окна: пока Appium стартует — спиннер, затем Appium Inspector
(`http://localhost:4723/inspector`), а если Appium не поднялся — текст с причиной.
Окно закрывается в трей; выход — через меню трея («Выход»), там же «Консоль» для DevTools.

## Требования

* **Node.js и npm** — для запуска из исходников.
* **Node.js для Appium** — Appium 3 требует `^20.19.0 || ^22.12.0 || >=24.0.0`.
  Electron 24 несёт внутри Node 18, поэтому приложение ищет подходящий системный Node
  и запускает Appium через него. Если подходящего Node нет, инспектор не запустится,
  и в центре окна появится сообщение с требуемым диапазоном версий.
* **Java (Linux)** — приложение ставит JDK только на Windows. На Linux нужен системный
  `java` (JDK 17+), иначе `sdkmanager` и `avdmanager` во время установки не запустятся.
* Linux + AppImage/chrome-sandbox: см. «CHROME_SANDBOX FIX» ниже.

## Запуск из исходников

```shell
npm install
npm start          # electron main.js
```

Сборка релиза (electron-builder, результат в `release/`):

```shell
npm run linux      # AppImage
npm run win        # NSIS
npm run mac
```

CI (`.github/workflows/build.yml`) собирает проект на push/PR в `main`, а релиз публикует
только по тегу `v*`.

## Установка компонентов и эмулятора

Кнопка **«Установка»** открывает диалог с параметрами AVD:

| Поле | Значение по умолчанию | Комментарий |
| --- | --- | --- |
| Имя эмулятора (AVD) | `Android_Tools_AVD` | латиница, цифры, точка, дефис, подчёркивание (до 64 символов) |
| Устройство (`avdmanager -d`) | `medium_phone` | идентификатор устройства, например из `avdmanager list device` |
| Версия Android | `android-34` | список: android-29…android-36 |
| Тип системного образа | `google_apis` | `google_apis`, `google_apis_playstore`, `default` |
| Архитектура | `x86_64` | `x86_64`, `arm64-v8a`, `x86`, `armeabi-v7a` |

Что происходит после нажатия «Установить»:

1. скачивается **Android Command-line Tools** (Linux/Windows, сборка `13114758`);
2. на **Windows** дополнительно скачивается **JDK 21** (`jdk-21_windows-x64_bin.zip` из
   `download.oracle.com/java/21/latest/`) и копируется в каталог приложения;
3. `sdkmanager` принимает лицензии и ставит `emulator`, `platform-tools` и системный образ;
4. `avdmanager` создаёт AVD, приложение создаёт скрипты запуска.

Этапы установки печатает скрипт (`licenses` → `emulator` → `platform_tools` → `image` → `avd`),
прогресс виден в уведомлении приложения. Установка поддерживается только на Linux и Windows;
на других платформах диалог сообщит об этом. Ошибки не «проглатываются»: уведомление показывает
ошибку, а диалог — её причину.

Второй эмулятор создаётся тем же диалогом — достаточно задать другое имя AVD.

Чтобы изменить параметры уже созданного эмулятора, удалите его («Эмуляторы» → «Удалить») и создайте заново.

## Эмуляторы: запуск, остановка, удаление

Кнопка **«Эмуляторы»** открывает список AVD, созданных приложением:

* строка состояния показывает, какой эмулятор запущен сейчас; надпись обновляется сама,
  в том числе когда эмулятор закрылся, а также при запуске/остановке из шапки;
* **«Запустить»** — запускает выбранный AVD (пока один эмулятор работает, запуск заблокирован);
* **«Остановить»** — посылает SIGTERM группе процессов эмулятора (в Windows — `taskkill /t /f`);
* **«Удалить»** — с подтверждением удаляет конфигурацию (`<имя>.ini`), данные (`<имя>.avd`),
  каталог скриптов (`<имя>/`) и запись в базе. Удалить запущенный AVD нельзя — сначала «Остановить».

Список перечитывается при открытии диалога и после удаления, а после установки нового AVD
открытый список обновляется сразу и новый эмулятор выбирается автоматически.

Кнопка **▶** в шапке запускает эмулятор без выбора: это работает, когда AVD ровно один,
иначе приложение предложит выбрать нужный в «Эмуляторы». Кнопка **⏹** останавливает эмулятор,
запущенный из этого окна приложения.

## Где хранятся данные

Все компоненты лежат внутри каталога данных приложения (`userData`):
`~/.config/Android_Tools` в Linux, `%APPDATA%\Android_Tools` в Windows.

| Каталог | Содержимое |
| --- | --- |
| `<userData>/android/android-sdk` | Android SDK: `cmdline-tools/latest`, `emulator`, `platform-tools`, `system-images` |
| `<userData>/android/android-avd` | AVD: `<имя>.ini`, `<имя>.avd`, каталог скриптов `<имя>/` (`start.sh`/`start.bat`, `install.sh`/`install.bat`), база `AvdDB.db` |
| `<userData>/android/downloads` | скачанные архивы (cmdline-tools, JDK) |
| `<userData>/android/java` | JDK, установленный приложением (только Windows) |
| `<userData>/logs` | логи приложения: `app_<дата>.log` |

Для дочерних процессов приложение выставляет окружение:

* `ANDROID_HOME` и `ANDROID_SDK_ROOT` → `<userData>/android/android-sdk`;
* `ANDROID_AVD_HOME` → `<userData>/android/android-avd` (чтобы AVD не уезжали в `~/.android/avd`);
* `JAVA_HOME` → `<userData>/android/java` — только если Java действительно установлена приложением.

База `AvdDB.db` (sqlite3, таблица `avds`: `device`, `android_ver`, `image_type`, `arch`, `avd_name`)
вспомогательная: её сбой не отменяет ни установку, ни удаление эмулятора.

## Appium

Appium запускается приложением автоматически: `node_modules/appium/index.js` с плагином
инспектора (`--use-plugins=inspector --allow-cors`). Готовность определяется ответом
`http://127.0.0.1:4723/status` (опрос до 60 секунд), после чего в центре окна открывается
Inspector. При выходе приложение завершает Appium (SIGTERM).

Если Appium не запустился, в центре окна показывается причина: не найден подходящий Node.js,
процесс завершился с кодом или не отвечает на `/status`.

## Ручная установка SDK

Если приложение не используется или нужен macOS, компоненты можно поставить вручную.

Ссылки на Command-line Tools:

* Linux — https://dl.google.com/android/repository/commandlinetools-linux-13114758_latest.zip
* Windows — https://dl.google.com/android/repository/commandlinetools-win-13114758_latest.zip
* Mac — https://dl.google.com/android/repository/commandlinetools-mac-13114758_latest.zip
* JDK 21 для Windows (как в приложении) — https://download.oracle.com/java/21/latest/jdk-21_windows-x64_bin.zip

```shell
# my.AppImage --appimage-mount
## Установка путей
export ANDROID_HOME=/path_to/android-sdk
export ANDROID_SDK_ROOT=$ANDROID_HOME

## Установка зависимостей
yes | $ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager --licenses
yes | $ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager emulator
yes | $ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager platform-tools

## Скачивание образа
# ANDROID
# android-36 - 16
# android-35 - 15
# android-34 - 14
# android-33 - 13
# android-32 - 12L
# android-31 - 12
# android-30 - 11
# android-29 - 10

## Версия системного образа
# default
# google_apis
# google_apis_playstore

# АРХИТЕКТУРА ПРОЦЕССОРА
# armeabi-v7a
# arm64-v8a
# x86
# x86_64

$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager "system-images;android-29;default;x86"

# Создание конфигурации
$ANDROID_HOME/cmdline-tools/latest/bin/avdmanager create avd -d "medium_phone" -n test1 -k "system-images;android-29;default;x86"

# Запуск
$ANDROID_HOME/emulator/emulator -avd test1
```

## Ограничения

* Установка компонентов поддерживается только на **Linux** и **Windows** (на macOS — только ручной путь выше).
* JDK приложение ставит только на Windows; на Linux нужен системный JDK.
* На Windows лицензии принимаются построчно (`echo y|`), поэтому при большом числе запросов
  часть может остаться непринятой — проверьте `sdkmanager --licenses` вручную.
* Остановить можно только эмулятор, запущенный из этого окна приложения; эмулятор, запущенный
  вручную, приложению неизвестен.
* Список AVD читается при открытии диалога: AVD, появившийся в каталоге в обход приложения,
  будет виден при следующем открытии (после установки и удаления список обновляется сам).
* В `.github/workflows/build.yml` используются устаревшие actions (`checkout@v1`, `setup-node@v1`) —
  их стоит обновить.

## Структура проекта

```
main.js                       главный процесс: окно, трей, запуск Appium, статус APPIUM_STATUS
app/app.js                    корневой layout: кнопки шапки, маршрут на MainPage
app/views/main_page.js        спиннер → Appium Inspector / сообщение об ошибке
app/views/install_dialog.js   диалог установки компонентов и создания AVD
app/views/avd_dialog.js       список AVD: запуск, остановка, удаление
app/settings/paths.js         каталоги приложения и переменные окружения (ANDROID_HOME и др.)
app/settings/scripts.js       генерация скриптов установки/запуска, валидация параметров, файлы AVD
app/settings/install_tools.js установка: загрузка, распаковка, копирование, запуск скрипта и прогресс
app/src/src.js                класс Android: список AVD, запуск, остановка, удаление
app/databases/sqlite.js       AVD-база (sqlite3)
app/databases/start_db.js     единый экземпляр базы и отправка IPC в окно
```

При разработке удобно проверять синтаксис всех файлов:

```shell
for f in main.js app/app.js app/views/*.js app/settings/*.js app/src/*.js app/databases/*.js; do
  node --check "$f" || echo "FAIL $f"
done
```

### CHROME_SANDBOX FIX

```shell
cd node_modules/electron/dist
sudo chown root chrome-sandbox
sudo chmod 4755 chrome-sandbox
```

### Иконки

```shell
icon-gen -i /2 -o /1 -r
```
