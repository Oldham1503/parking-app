# Power Apps App Structure

Create a tablet canvas app named `Parking Bay Register`.

## Data Source

Add the SharePoint List:

- `ParkingSessions`

## Screens

### `scrDashboard`

Purpose: main tablet view showing bays 1 to 10.

Controls:

- `galBays`: vertical or flexible-height gallery showing 10 bay tiles
- `btnRefresh`: refresh dashboard
- `btnHistory`: navigate to history screen

Each bay tile should show:

- Bay number
- Status: `Free` or `Occupied`
- Person name when occupied
- Car registration when occupied
- Time in when occupied
- Current duration when occupied

Tile selection:

- Free bay: open check-in screen
- Occupied bay: open check-out screen

### `scrCheckIn`

Purpose: enter parking details for a free bay.

Controls:

- `lblCheckInBay`
- `txtPersonName`
- `txtCarRegistration`
- `txtNotes`
- `btnCheckIn`
- `btnCancelCheckIn`

Validation:

- Person name is required
- Car registration is required
- Bay must still be free at the moment of submit

### `scrCheckOut`

Purpose: view active parking details and check the vehicle out.

Controls:

- `lblCheckOutBay`
- `lblPersonName`
- `lblCarRegistration`
- `lblTimeIn`
- `lblDuration`
- `btnCheckOut`
- `btnCancelCheckOut`

Validation:

- Active session must still exist at the moment of check-out

### `scrHistory`

Purpose: review completed and active records.

Controls:

- `galHistory`
- `txtHistorySearch`
- `drpHistoryStatus`
- `btnBackToDashboard`

Recommended filters:

- Search by name or car registration
- Status dropdown: `All`, `Occupied`, `Completed`

