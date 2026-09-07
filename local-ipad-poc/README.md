# Local iPad Parking Bay POC

This is a no-server proof of concept for the parking bay register.

It runs entirely in the browser and stores records in the device browser's `localStorage`. Staff can tap a bay, enter the person's name, car registration, and start time, then check the car out when it leaves. It is useful for proving the workflow on an iPad before moving to a hosted private web app with a real database.

## How To Run

Open `index.html` in Safari, Edge, or Chrome.

On iPad:

1. Copy the `local-ipad-poc` folder to a place the iPad can open, or host the folder temporarily from a PC.
2. Open `index.html` in Safari.
3. Use Share > Add to Home Screen to make it feel like an app.

## Important Limitations

- Data is stored only in that browser on that device.
- Clearing browser data deletes the register.
- It is not suitable as the final system of record.
- There is no real login in this POC.

## Migration Path To Option 2

The app code keeps storage behind a small `parkingStore` object in `app.js`. For the custom private web app version, replace that object with API calls to a backend database while keeping the same bay dashboard and check-in/check-out flow.
