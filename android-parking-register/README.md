# Parking Bay Register Android App

This is the local Android-tablet version of the parking bay register. It is separate from the hosted Sites app and stores records on the tablet only.

## What This Version Does

- Runs as a sideloaded Android APK.
- Works without the App Store, Play Store, hosting, or a database server.
- Stores staff parking, visitor sign-in/out, bay occupancy, and saved staff details on the tablet.
- Exports staff and visitor history as CSV files through Android's share sheet.

## One-Time PC Setup

1. Install Node.js 22 or newer.
2. Install Android Studio.
3. Install JDK 17 or newer. Android Studio usually includes one, but a standalone JDK such as Eclipse Temurin 17 also works.
4. In Android Studio, install the Android SDK, Android SDK Platform Tools, and Android SDK Build Tools.
5. On the Android tablet, enable Developer Options.
6. Enable USB debugging on the tablet if you want to install using a cable.

Check Java from PowerShell:

```powershell
java -version
```

If it shows `1.8`, the APK build will fail. Install JDK 17 or newer, then set `JAVA_HOME` to the real folder that was created on your PC. The folder must contain `bin\java.exe`.

```powershell
$env:JAVA_HOME = "C:\Path\To\Your\JDK-17-Or-Newer"
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
java -version
```

## First-Time Project Setup

From PowerShell:

```powershell
cd "D:\Temp car park app idea\android-parking-register"
npm install
npx cap add android
```

This creates the native Android project in the `android` folder.

## Build An APK

```powershell
cd "D:\Temp car park app idea\android-parking-register"
npm run android:apk
```

The debug APK will be created at:

```text
android\app\build\outputs\apk\debug\app-debug.apk
```

If the build says it needs Java 11 or newer, install or select JDK 17+ as described above and run `npm run android:apk` again.

## Install On The Tablet

### Option 1: Install By USB

Plug the tablet into the PC, allow USB debugging on the tablet, then run:

```powershell
adb install -r android\app\build\outputs\apk\debug\app-debug.apk
```

### Option 2: Copy And Tap

1. Copy `android\app\build\outputs\apk\debug\app-debug.apk` to the tablet.
2. Open the APK on the tablet.
3. Allow installation from that file manager/browser when Android asks.
4. Install the app.

## Updating The App Later

Build a new APK and install it over the old one:

```powershell
npm run android:apk
adb install -r android\app\build\outputs\apk\debug\app-debug.apk
```

Do not uninstall the old app unless you have exported the history first. Updating with the same package ID should keep the tablet's local app data.

## Export History

1. Open the app on the tablet.
2. Go to **Staff history** or **Visitor history**.
3. Tap **Export CSV**.
4. Use Android's share sheet to send or save the file.

For PC transfer, save the CSV somewhere visible such as Downloads/Documents, then plug the tablet into the PC and copy the exported CSV file.

## Important Data Notes

- The tablet is the system of record.
- Clearing app data or uninstalling the app can remove the register history.
- Export CSV regularly if the history needs to be retained outside the tablet.
