# Parking Bay Register - Testing Machine APK Setup

This guide sets up a Windows testing machine to build and install the local-only Android app. The app is not published to Google Play.

## Project Location

The Android project is located at:

```text
D:\TOOLS\parking-app\android-parking-register
```

Run all project commands from that folder.

## 1. Install Required Software

Install these three items on the testing machine:

1. Node.js 22 LTS from https://nodejs.org
2. Android Studio from https://developer.android.com/studio
3. Eclipse Temurin JDK 17 from https://adoptium.net/temurin/releases/?version=17

During Android Studio installation, keep the Android SDK and Android SDK Platform-Tools selected. In Android Studio, open `More Actions` > `SDK Manager` and install a current Android SDK Platform, Android SDK Build-Tools, and Android SDK Platform-Tools.

Do not create a Java folder manually. The JDK installer must create a folder that contains `bin\java.exe`.

## 2. Check Node.js

Open a new PowerShell window and run:

```powershell
node --version
npm --version
```

Both commands must print a version. If either command is not found, restart PowerShell after installing Node.js.

## 3. Configure Java 17

In PowerShell, run the following. It finds the installed Temurin JDK, makes it available in the current PowerShell window, and saves `JAVA_HOME` for future windows.

```powershell
$jdk = Get-ChildItem 'C:\Program Files\Eclipse Adoptium' -Directory |
  Where-Object { Test-Path (Join-Path $_.FullName 'bin\java.exe') } |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1

if (-not $jdk) { throw 'JDK 17 was not found. Install Eclipse Temurin JDK 17 first.' }

$env:JAVA_HOME = $jdk.FullName
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
[Environment]::SetEnvironmentVariable('JAVA_HOME', $jdk.FullName, 'User')

& "$env:JAVA_HOME\bin\java.exe" -version
```

The final command must show Java 17 or newer. It must not show `1.8`.

## 4. Install Project Dependencies

```powershell
Set-Location 'D:\TOOLS\parking-app\android-parking-register'
npm install
```

The project already contains its `android` folder. Do not run `npx cap add android` unless that folder has been deliberately removed.

## 5. Build the APK

```powershell
Set-Location 'D:\TOOLS\parking-app\android-parking-register'
npm run android:apk
```

This builds the web app, copies it into the native Android project, and creates an installable debug APK.

The finished file is:

```text
D:\TOOLS\parking-app\android-parking-register\android\app\build\outputs\apk\debug\app-debug.apk
```

To copy it to the Windows desktop:

```powershell
Copy-Item '.\android\app\build\outputs\apk\debug\app-debug.apk' "$env:USERPROFILE\Desktop\ParkingBayRegister.apk"
```

## 6. Install on the Android Tablet

1. On the tablet, open Settings > About tablet.
2. Tap `Build number` seven times to enable Developer options.
3. In Developer options, enable `USB debugging`.
4. Connect the tablet to the PC using USB and choose `File transfer` on the tablet.
5. Copy `ParkingBayRegister.apk` to the tablet's Downloads folder.
6. Open the APK in the tablet's Files app.
7. Allow the Files app to install unknown apps when Android asks.
8. Select Install.

The app operates entirely on the tablet and does not need the Play Store or an internet connection for normal use.

## 7. Update the App Later

Build a new APK with:

```powershell
Set-Location 'D:\TOOLS\parking-app\android-parking-register'
npm run android:apk
```

Install the new APK over the existing app. Do not uninstall the existing app first: uninstalling removes its local history.

## 8. Export History

Inside the app, use the history export action. In the Android share sheet, choose the Files app and save the CSV to Downloads. When the tablet is connected to a PC in File transfer mode, copy the CSV from the tablet's Downloads folder.

## Troubleshooting

If the build says `JAVA_HOME is set to an invalid directory`, repeat section 3 in the same PowerShell window, then run the build again.

If the build says it is using Java `1.8`, Java 8 is still first in the PowerShell path. Repeat section 3 and confirm the final Java version command reports 17 or newer.

If Android Studio reports missing SDK components, open `More Actions` > `SDK Manager`, install the component it names, accept the license, and rerun `npm run android:apk`.
