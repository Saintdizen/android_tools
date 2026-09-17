const {path, fs} = require("chuijs");
const {AppPaths} = require("./paths");

/**
 * Генерация скриптов установки и запуска эмулятора.
 *
 * Модуль намеренно не обращается к DOM и не создаёт уведомлений: те же функции
 * используются и в renderer-процессе (install_tools.js), и в main-процессе (src.js),
 * а также проверяются обычным Node.js без запуска Electron.
 *
 * Два правила, которые здесь соблюдаются:
 *   1. Все пути подставляются в кавычки — в каталоге пользователя может быть пробел.
 *   2. Файлы .bat содержат только ASCII, а пути приходят через переменные окружения
 *      (scriptEnvironment): cmd.exe читает .bat в OEM-кодировке, поэтому кириллица
 *      в пути внутри файла искажается.
 */

// Этапы установки: скрипт печатает STAGE:<id>, приложение показывает русскую подпись.
const STAGE_PREFIX = "STAGE:"
const STAGES = {
    licenses: "Принятие лицензий",
    emulator: "Установка Android Emulator",
    platform_tools: "Установка Platform Tools",
    image: "Загрузка образа Android",
    avd: "Создание эмулятора Android"
}

// Значения подставляются в текст скриптов, поэтому допускаем только безопасные символы.
const AVD_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/
const DEVICE_PATTERN = /^[A-Za-z0-9._-]{1,64}$/
const VERSION_PATTERN = /^android-\d{1,2}$/
const IMAGE_TYPE_PATTERN = /^[a-z_]{1,32}$/
const ARCH_PATTERN = /^(arm64-v8a|armeabi-v7a|x86|x86_64)$/

function validateInstallParams(nameAvd, device, version, imageType, arch) {
    if (!AVD_NAME_PATTERN.test(String(nameAvd))) {
        return `Недопустимое имя AVD "${nameAvd}": разрешены латиница, цифры, точка, дефис и подчёркивание (до 64 символов)`
    }
    if (!DEVICE_PATTERN.test(String(device))) {
        return `Недопустимое устройство "${device}": разрешены латиница, цифры, точка, дефис и подчёркивание`
    }
    if (!VERSION_PATTERN.test(String(version))) {
        return `Недопустимая версия Android "${version}": ожидается вид android-34`
    }
    if (!IMAGE_TYPE_PATTERN.test(String(imageType))) {
        return `Недопустимый тип системного образа "${imageType}"`
    }
    if (!ARCH_PATTERN.test(String(arch))) {
        return `Недопустимая архитектура "${arch}"`
    }
    return undefined
}

function stageLabelOf(id) {
    return STAGES[id] ?? `Этап ${id}`
}

/**
 * Разбирает один чанк stdout скрипта.
 * Этап и прогресс разбираются независимо: текст этапа приходит отдельной строкой,
 * а проценты — только в строках вида "[=====     ] 45% Unzipping...".
 */
function parseProgressChunk(chunk) {
    const text = String(chunk)
    const stage = text.match(/STAGE:([A-Za-z0-9_]+)/)
    const percent = text.match(/(\d{1,3})%/)
    return {
        stageId: stage ? stage[1] : undefined,
        percent: percent ? Math.min(Number(percent[1]), 100) : undefined
    }
}

/** Пути AVD внутри каталога приложения: конфигурация, данные и скрипты. */
function avdPaths(nameAvd) {
    return {
        // avdmanager с ANDROID_AVD_HOME создаёт пару <AVD_DIR>/<имя>.ini и <AVD_DIR>/<имя>.avd
        ini: path.join(AppPaths.AVD_DIR, `${nameAvd}.ini`),
        data: path.join(AppPaths.AVD_DIR, `${nameAvd}.avd`),
        scripts: path.join(AppPaths.AVD_DIR, nameAvd)
    }
}

function avdIniPath(nameAvd) {
    return avdPaths(nameAvd).ini
}

/** Удаляет всё, что приложение создало для AVD; возвращает список удалённых путей. */
function removeAvdFiles(nameAvd) {
    const paths = avdPaths(nameAvd)
    const removed = []
    for (const target of [paths.ini, paths.data, paths.scripts]) {
        if (!fs.existsSync(target)) continue
        fs.rmSync(target, {recursive: true, force: true})
        removed.push(target)
    }
    return removed
}

function avdScriptPath(nameAvd, scriptName) {
    return path.join(AppPaths.AVD_DIR, nameAvd, scriptName)
}

/** Имена AVD, созданных приложением (каталог ANDROID_AVD_HOME). */
function listAvdNames() {
    if (!fs.existsSync(AppPaths.AVD_DIR)) return []
    return fs.readdirSync(AppPaths.AVD_DIR)
        .filter(file => file.endsWith(".ini"))
        .map(file => path.basename(file, ".ini"))
        .sort()
}

/** Окружение дочерних процессов: пути передаём переменными, чтобы не зависеть от кодировки. */
function scriptEnvironment() {
    const env = {
        ...process.env,
        ANDROID_HOME: AppPaths.ANDROID_SDK,
        ANDROID_SDK_ROOT: AppPaths.ANDROID_SDK,
        ANDROID_AVD_HOME: AppPaths.AVD_DIR
    }
    // JAVA_HOME подставляем только когда Java реально установлена приложением:
    // несуществующий JAVA_HOME ломает запуск sdkmanager на Linux.
    if (fs.existsSync(path.join(AppPaths.JAVA_DIR, "bin"))) env.JAVA_HOME = AppPaths.JAVA_DIR
    return env
}

function writeScript(directory, fileName, text) {
    if (!fs.existsSync(directory)) fs.mkdirSync(directory, {recursive: true})
    const filePath = path.join(directory, fileName)
    // Перезаписываем: иначе у пользователя останется скрипт от старой версии приложения.
    fs.writeFileSync(filePath, text, "utf-8")
    return filePath
}

function linuxInstallScript(nameAvd, device, version, imageType, arch) {
    return `#!/bin/sh
export ANDROID_HOME="${AppPaths.ANDROID_SDK}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export ANDROID_AVD_HOME="${AppPaths.AVD_DIR}"

SDKMANAGER="$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager"
AVDMANAGER="$ANDROID_HOME/cmdline-tools/latest/bin/avdmanager"

echo "${STAGE_PREFIX}licenses"
yes | "$SDKMANAGER" --licenses > /dev/null

echo "${STAGE_PREFIX}emulator"
yes | "$SDKMANAGER" emulator

echo "${STAGE_PREFIX}platform_tools"
yes | "$SDKMANAGER" platform-tools

echo "${STAGE_PREFIX}image"
yes | "$SDKMANAGER" "system-images;${version};${imageType};${arch}"

echo "${STAGE_PREFIX}avd"
"$AVDMANAGER" create avd -d "${device}" -n "${nameAvd}" -k "system-images;${version};${imageType};${arch}"
`
}

function windowsInstallScript(nameAvd, device, version, imageType, arch) {
    return `@echo off
rem ASCII-only file: cmd.exe reads .bat in OEM codepage, so paths come from environment
if not defined ANDROID_HOME (echo ANDROID_HOME is not defined & exit /b 1)
if not defined ANDROID_AVD_HOME (echo ANDROID_AVD_HOME is not defined & exit /b 1)
set "ANDROID_SDK_ROOT=%ANDROID_HOME%"
set "SDKMANAGER=%ANDROID_SDK_ROOT%\\cmdline-tools\\latest\\bin\\sdkmanager.bat"
set "AVDMANAGER=%ANDROID_SDK_ROOT%\\cmdline-tools\\latest\\bin\\avdmanager.bat"

echo ${STAGE_PREFIX}licenses
echo y|"%SDKMANAGER%" --licenses

echo ${STAGE_PREFIX}emulator
echo y|"%SDKMANAGER%" emulator

echo ${STAGE_PREFIX}platform_tools
echo y|"%SDKMANAGER%" platform-tools

echo ${STAGE_PREFIX}image
echo y|"%SDKMANAGER%" "system-images;${version};${imageType};${arch}"

echo ${STAGE_PREFIX}avd
"%AVDMANAGER%" create avd -d "${device}" -n "${nameAvd}" -k "system-images;${version};${imageType};${arch}"
`
}

function linuxStartScript(nameAvd) {
    return `#!/bin/sh
export ANDROID_HOME="${AppPaths.ANDROID_SDK}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export ANDROID_AVD_HOME="${AppPaths.AVD_DIR}"

"$ANDROID_HOME/emulator/emulator" -avd "${nameAvd}"
`
}

function windowsStartScript(nameAvd) {
    return `@echo off
rem ASCII-only file: cmd.exe reads .bat in OEM codepage, so paths come from environment
if not defined ANDROID_HOME (echo ANDROID_HOME is not defined & exit /b 1)
if not defined ANDROID_AVD_HOME (echo ANDROID_AVD_HOME is not defined & exit /b 1)
set "ANDROID_SDK_ROOT=%ANDROID_HOME%"

"%ANDROID_SDK_ROOT%\\emulator\\emulator.exe" -avd "${nameAvd}"
`
}

exports.STAGE_PREFIX = STAGE_PREFIX
exports.STAGES = STAGES
exports.validateInstallParams = validateInstallParams
exports.stageLabelOf = stageLabelOf
exports.parseProgressChunk = parseProgressChunk
exports.avdIniPath = avdIniPath
exports.avdScriptPath = avdScriptPath
exports.removeAvdFiles = removeAvdFiles
exports.listAvdNames = listAvdNames
exports.scriptEnvironment = scriptEnvironment
exports.writeScript = writeScript
exports.linuxInstallScript = linuxInstallScript
exports.windowsInstallScript = windowsInstallScript
exports.linuxStartScript = linuxStartScript
exports.windowsStartScript = windowsStartScript
