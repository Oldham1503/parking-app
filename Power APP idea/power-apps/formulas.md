# Power Apps Formulas

These formulas assume the SharePoint List is named `ParkingSessions` and the columns match [../sharepoint/ParkingSessions.schema.md](../sharepoint/ParkingSessions.schema.md).

## App `OnStart`

```powerfx
Set(gblAppName, "Parking Bay Register");
Set(gblSelectedBay, Blank());
Set(gblActiveSession, Blank());

ClearCollect(
    colBays,
    ForAll(
        Sequence(10),
        { BayNumber: Value }
    )
);

Refresh(ParkingSessions);
```

## `scrDashboard.OnVisible`

```powerfx
Refresh(ParkingSessions);

ClearCollect(
    colBays,
    ForAll(
        Sequence(10),
        { BayNumber: Value }
    )
);
```

## `btnRefresh.OnSelect`

```powerfx
Refresh(ParkingSessions);
Notify("Parking bay status refreshed.", NotificationType.Success);
```

## `galBays.Items`

```powerfx
AddColumns(
    colBays,
    ActiveSession,
    LookUp(
        ParkingSessions,
        BayNumber = ThisRecord.BayNumber && Status.Value = "Occupied"
    ),
    BayStatus,
    If(
        IsBlank(
            LookUp(
                ParkingSessions,
                BayNumber = ThisRecord.BayNumber && Status.Value = "Occupied"
            )
        ),
        "Free",
        "Occupied"
    )
)
```

## Bay Tile Display Formulas

Bay title label:

```powerfx
"Bay " & Text(ThisItem.BayNumber)
```

Status label:

```powerfx
ThisItem.BayStatus
```

Person label:

```powerfx
If(
    ThisItem.BayStatus = "Occupied",
    ThisItem.ActiveSession.PersonName,
    "Available"
)
```

Registration label:

```powerfx
If(
    ThisItem.BayStatus = "Occupied",
    ThisItem.ActiveSession.CarRegistration,
    ""
)
```

Time in label:

```powerfx
If(
    ThisItem.BayStatus = "Occupied",
    "In: " & Text(ThisItem.ActiveSession.TimeIn, "dd/mm/yyyy hh:mm"),
    ""
)
```

Duration label:

```powerfx
If(
    ThisItem.BayStatus = "Occupied",
    "Duration: " & Text(
        DateDiff(ThisItem.ActiveSession.TimeIn, Now(), Minutes) / 60,
        "[$-en-GB]0.0"
    ) & " hrs",
    ""
)
```

Tile fill:

```powerfx
If(
    ThisItem.BayStatus = "Occupied",
    ColorValue("#FDE2E2"),
    ColorValue("#DCFCE7")
)
```

## Bay Tile `OnSelect`

```powerfx
Set(gblSelectedBay, ThisItem.BayNumber);
Set(
    gblActiveSession,
    LookUp(
        ParkingSessions,
        BayNumber = ThisItem.BayNumber && Status.Value = "Occupied"
    )
);

If(
    IsBlank(gblActiveSession),
    Reset(txtPersonName);
    Reset(txtCarRegistration);
    Reset(txtNotes);
    Navigate(scrCheckIn, ScreenTransition.Fade),
    Navigate(scrCheckOut, ScreenTransition.Fade)
);
```

## `lblCheckInBay.Text`

```powerfx
"Check in to Bay " & Text(gblSelectedBay)
```

## `btnCheckIn.DisplayMode`

```powerfx
If(
    IsBlank(Trim(txtPersonName.Text)) || IsBlank(Trim(txtCarRegistration.Text)),
    DisplayMode.Disabled,
    DisplayMode.Edit
)
```

## `btnCheckIn.OnSelect`

```powerfx
Refresh(ParkingSessions);

If(
    !IsBlank(
        LookUp(
            ParkingSessions,
            BayNumber = gblSelectedBay && Status.Value = "Occupied"
        )
    ),
    Notify(
        "Bay " & Text(gblSelectedBay) & " is already occupied. The dashboard will refresh.",
        NotificationType.Error
    );
    Navigate(scrDashboard, ScreenTransition.Fade),
    Patch(
        ParkingSessions,
        Defaults(ParkingSessions),
        {
            Title: "Bay " & Text(gblSelectedBay) & " - " & Upper(Trim(txtCarRegistration.Text)),
            BayNumber: gblSelectedBay,
            PersonName: Trim(txtPersonName.Text),
            CarRegistration: Upper(Trim(txtCarRegistration.Text)),
            TimeIn: Now(),
            Status: { Value: "Occupied" },
            Notes: Trim(txtNotes.Text)
        }
    );
    Notify(
        "Bay " & Text(gblSelectedBay) & " checked in.",
        NotificationType.Success
    );
    Navigate(scrDashboard, ScreenTransition.Fade)
);
```

## `btnCancelCheckIn.OnSelect`

```powerfx
Navigate(scrDashboard, ScreenTransition.Fade)
```

## `lblCheckOutBay.Text`

```powerfx
"Bay " & Text(gblSelectedBay)
```

## Check-Out Detail Labels

Person:

```powerfx
gblActiveSession.PersonName
```

Car registration:

```powerfx
gblActiveSession.CarRegistration
```

Time in:

```powerfx
Text(gblActiveSession.TimeIn, "dd/mm/yyyy hh:mm")
```

Duration:

```powerfx
Text(
    DateDiff(gblActiveSession.TimeIn, Now(), Minutes) / 60,
    "[$-en-GB]0.0"
) & " hrs"
```

## `btnCheckOut.OnSelect`

```powerfx
Refresh(ParkingSessions);

Set(
    gblActiveSession,
    LookUp(
        ParkingSessions,
        ID = gblActiveSession.ID && Status.Value = "Occupied"
    )
);

If(
    IsBlank(gblActiveSession),
    Notify(
        "This parking session has already been checked out or changed.",
        NotificationType.Error
    );
    Navigate(scrDashboard, ScreenTransition.Fade),
    Patch(
        ParkingSessions,
        gblActiveSession,
        {
            TimeOut: Now(),
            Status: { Value: "Completed" },
            CheckedOutByName: User().FullName,
            CheckedOutByEmail: User().Email
        }
    );
    Notify(
        "Bay " & Text(gblSelectedBay) & " checked out.",
        NotificationType.Success
    );
    Navigate(scrDashboard, ScreenTransition.Fade)
);
```

## `btnCancelCheckOut.OnSelect`

```powerfx
Navigate(scrDashboard, ScreenTransition.Fade)
```

## `btnHistory.OnSelect`

```powerfx
Navigate(scrHistory, ScreenTransition.Fade)
```

## `drpHistoryStatus.Items`

```powerfx
["All", "Occupied", "Completed"]
```

## `galHistory.Items`

```powerfx
SortByColumns(
    Filter(
        ParkingSessions,
        (
            drpHistoryStatus.Selected.Value = "All"
            || Status.Value = drpHistoryStatus.Selected.Value
        )
        && (
            IsBlank(Trim(txtHistorySearch.Text))
            || StartsWith(PersonName, Trim(txtHistorySearch.Text))
            || StartsWith(CarRegistration, Upper(Trim(txtHistorySearch.Text)))
        )
    ),
    "TimeIn",
    SortOrder.Descending
)
```

## History Row Labels

Main label:

```powerfx
"Bay " & Text(ThisItem.BayNumber) & " - " & ThisItem.CarRegistration
```

Secondary label:

```powerfx
ThisItem.PersonName & " | In: " & Text(ThisItem.TimeIn, "dd/mm/yyyy hh:mm")
```

Time out label:

```powerfx
If(
    IsBlank(ThisItem.TimeOut),
    "Currently parked",
    "Out: " & Text(ThisItem.TimeOut, "dd/mm/yyyy hh:mm")
)
```

