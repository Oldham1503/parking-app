# Test Plan

## Access Tests

- Confirm an approved staff user can open the app.
- Confirm an unapproved user cannot open the app.
- Confirm the `ParkingSessions` SharePoint List is not accessible anonymously.

## Dashboard Tests

- Confirm bays 1 to 10 display.
- Confirm free bays show `Free` or `Available`.
- Confirm occupied bays show name, car registration, time in, and duration.
- Confirm refresh updates the latest SharePoint data.

## Check-In Tests

- Check in bay 1 with a name and car registration.
- Confirm time in is automatically recorded.
- Confirm car registration is saved uppercase.
- Try to submit with blank name and confirm submit is disabled.
- Try to submit with blank car registration and confirm submit is disabled.
- Attempt to check in to an already occupied bay and confirm the app blocks it.

## Check-Out Tests

- Open an occupied bay.
- Confirm the correct name, registration, and time in are displayed.
- Check the bay out.
- Confirm time out is saved.
- Confirm status changes to `Completed`.
- Confirm the bay returns to `Free` on the dashboard.

## History Tests

- Confirm completed records remain visible in history.
- Search by person name.
- Search by car registration.
- Filter by `Occupied`.
- Filter by `Completed`.

## iPad Tests

- Test in portrait and landscape.
- Confirm all buttons are easy to tap.
- Confirm the app works with the iPad keyboard hidden and visible.
- Confirm the layout is readable from normal tablet distance.

