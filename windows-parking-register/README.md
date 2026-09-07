# Parking Register Windows App

Native Windows copy of the parking bay register. This app is separate from the hosted web app, uses a WebView2 HTML interface to match the web look and feel, and stores its data locally as JSON.

## Run

```powershell
dotnet run --project .\ParkingRegister.WinForms\ParkingRegister.WinForms.csproj
```

## Build

```powershell
dotnet build .\ParkingRegister.sln
```

## Visual Studio

Open `ParkingRegister.sln`, set `ParkingRegister.WinForms` as the startup project, then press `F5`.

The project uses the `Microsoft.Web.WebView2` package, so the PC running the app needs the Microsoft Edge WebView2 Runtime installed. Most current Windows machines already have it.

## Local Data

The app creates and updates this file automatically:

```text
%LOCALAPPDATA%\C365Cloud\ParkingRegisterWinForms\register-data.json
```

If the JSON file is invalid, the app shows an error and does not overwrite it.

## Export

Use **Export to Excel** in the app header to create a real `.xlsx` workbook with:

- Staff Parking History
- Visitor History

## Logo

To add your own logo, place a PNG named `logo.png` in:

```text
ParkingRegister.WinForms\Web\logo.png
```

The header shows a logo placeholder until that file exists.
