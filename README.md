# Android tools
### CHROME_SANDBOX FIX
```shell
cd node_modules/electron/dist
sudo chown root chrome-sandbox
sudo chmod 4755 chrome-sandbox
```

### Ссылки
* Linux - https://dl.google.com/android/repository/commandlinetools-linux-13114758_latest.zip
* Windows - https://dl.google.com/android/repository/commandlinetools-win-13114758_latest.zip
* Mac - https://dl.google.com/android/repository/commandlinetools-mac-13114758_latest.zip

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
# android-34 - 14
# android-33 - 13
# android-32 - 12L
# android-31 - 12
# android-30 - 11
# android-29 - 10

## Версия системного образа
# default
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