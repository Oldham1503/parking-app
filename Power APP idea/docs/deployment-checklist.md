# Deployment Checklist

## SharePoint

- Create or select a private SharePoint site.
- Create the `ParkingSessions` list.
- Add the columns from `sharepoint/ParkingSessions.schema.md`.
- Disable list attachments.
- Enable version history.
- Create the `Active Parking` and `Parking History` views.
- Confirm the list is not shared with anonymous or external users.

## Power Apps

- Create a tablet canvas app named `Parking Bay Register`.
- Connect it to the `ParkingSessions` SharePoint List.
- Add screens:
  - `scrDashboard`
  - `scrCheckIn`
  - `scrCheckOut`
  - `scrHistory`
- Add the formulas from `power-apps/formulas.md`.
- Set app orientation to landscape if the iPad will be mounted or used horizontally.
- Turn on "Scale to fit" only if it produces a comfortable iPad layout; otherwise design responsive containers manually.

## Sharing and Access

- Share the Power App only with approved staff/security groups.
- Give those users access to the SharePoint site or list.
- Use Edit permission for staff who can check cars in/out.
- Use Read permission only for any users who should view status without updating records.
- Do not create public sharing links.
- Do not expose the SharePoint site to external guests unless explicitly approved later.

## iPad Setup

- Install the Power Apps mobile app, or open the app in Safari.
- Sign in with an approved Microsoft 365 staff account.
- Pin the Power App to the iPad home screen if using Safari.
- Test Wi-Fi/network access in the location where the iPad will be used.

## Operational Notes

- Decide who is responsible for checking vehicles out.
- Review active bays at the end of each day to avoid stale occupied sessions.
- Consider exporting or reporting completed sessions monthly if parking history needs auditing.

