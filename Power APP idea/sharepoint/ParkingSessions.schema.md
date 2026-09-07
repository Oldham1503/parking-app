# SharePoint List: ParkingSessions

Create this list in the SharePoint site that will host the parking register data.

## List Settings

- List name: `ParkingSessions`
- Description: `Parking bay check-in and check-out history`
- Versioning: enabled
- Attachments: disabled
- Item-level permissions: keep default unless the business needs stricter access
- Default view: `Active Parking`

## Columns

Create each custom column first using the internal-name recommendation exactly, without spaces. After the column exists, you can rename the display label to the friendly name. This keeps the Power Apps formulas simple and avoids SharePoint internal names such as `Time_x0020_In`.

| Display name | Internal name recommendation | Type | Required | Notes |
| --- | --- | --- | --- | --- |
| Title | `Title` | Single line of text | Yes | Auto-filled by the app, for example `Bay 3 - AB12 CDE` |
| Bay Number | `BayNumber` | Number | Yes | Whole number, valid values 1 to 10 |
| Person Name | `PersonName` | Single line of text | Yes | Name of the person using the bay |
| Car Registration | `CarRegistration` | Single line of text | Yes | Store uppercase from the app |
| Time In | `TimeIn` | Date and time | Yes | Include date and time |
| Time Out | `TimeOut` | Date and time | No | Blank while occupied |
| Status | `Status` | Choice | Yes | Choices: `Occupied`, `Completed` |
| Checked Out By Name | `CheckedOutByName` | Single line of text | No | Filled from `User().FullName` |
| Checked Out By Email | `CheckedOutByEmail` | Single line of text | No | Filled from `User().Email` |
| Notes | `Notes` | Multiple lines of text | No | Optional operational notes |

SharePoint automatically provides `Created By`, `Created`, `Modified By`, and `Modified`, which cover the created-by audit requirement.

## Views

### Active Parking

Filter:

- `Status` is equal to `Occupied`

Sort:

- `Bay Number` ascending

Columns:

- Bay Number
- Person Name
- Car Registration
- Time In
- Created By

### Parking History

Filter:

- no filter, or `Status` is equal to `Completed`

Sort:

- `Time In` descending

Columns:

- Bay Number
- Person Name
- Car Registration
- Time In
- Time Out
- Status
- Checked Out By Name

## Validation

Power Apps prevents double-booking in the app. If stricter server-side control is later required, add a Power Automate validation flow or Dataverse storage. SharePoint Lists do not provide a simple unique constraint for "only one occupied record per bay".
