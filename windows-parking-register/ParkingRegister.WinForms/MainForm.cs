using System.Diagnostics;
using System.Text.Json;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace ParkingRegister.WinForms;

public sealed class MainForm : Form
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    private readonly RegisterDataStore _store = new();
    private readonly WebView2 _webView = new() { Dock = DockStyle.Fill };
    private RegisterData _data = new();
    private bool _dataLoaded = true;
    private string _loadError = "";

    public MainForm()
    {
        Text = "C365Cloud Parking Bay Register";
        StartPosition = FormStartPosition.CenterScreen;
        MinimumSize = new Size(1100, 760);
        Size = new Size(1280, 820);
        Controls.Add(_webView);
        Load += async (_, _) => await InitializeWebView();
    }

    private async Task InitializeWebView()
    {
        LoadData();
        await _webView.EnsureCoreWebView2Async();
        _webView.CoreWebView2.WebMessageReceived += HandleWebMessage;
        _webView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = true;
        _webView.CoreWebView2.Settings.IsStatusBarEnabled = false;

        var assetsPath = Path.Combine(AppContext.BaseDirectory, "Web", "index.html");
        _webView.Source = new Uri(assetsPath);
        _webView.CoreWebView2.NavigationCompleted += async (_, _) => await SendState("Ready.");
    }

    private void LoadData()
    {
        try
        {
            _data = _store.Load();
            _dataLoaded = true;
            _loadError = "";
        }
        catch (InvalidDataException error)
        {
            _data = new RegisterData();
            _dataLoaded = false;
            _loadError = error.Message;
            MessageBox.Show(error.Message, "Could not load register data", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }

    private void HandleWebMessage(object? sender, CoreWebView2WebMessageReceivedEventArgs eventArgs)
    {
        try
        {
            using var document = JsonDocument.Parse(eventArgs.WebMessageAsJson);
            var root = document.RootElement;
            var type = root.GetProperty("type").GetString() ?? "";
            var payload = root.TryGetProperty("payload", out var payloadElement) ? payloadElement : default;
            var message = type switch
            {
                "checkInStaff" => CheckInStaff(payload),
                "checkOutStaff" => CheckOutStaff(payload),
                "signInVisitor" => SignInVisitor(payload),
                "signOutVisitor" => SignOutVisitor(payload),
                "saveStaffProfile" => SaveStaffProfile(payload),
                "deleteStaffProfile" => DeleteStaffProfile(payload),
                "exportHistory" => ExportHistory(),
                "refresh" => "Register refreshed.",
                _ => "Unknown command.",
            };

            _ = SendState(message);
        }
        catch (Exception error)
        {
            _ = SendState(error.Message);
        }
    }

    private string CheckInStaff(JsonElement payload)
    {
        EnsureWritable();

        var bayNumber = GetInt(payload, "bayNumber");
        var personName = GetString(payload, "personName").Trim();
        var carRegistration = GetString(payload, "carRegistration").Trim().ToUpperInvariant();
        var notes = GetString(payload, "notes").Trim();
        var timeIn = GetDateTime(payload, "timeIn");

        if (!IsValidBay(bayNumber))
        {
            return "Choose a valid bay from 1 to 10.";
        }

        if (!IsBayFree(bayNumber))
        {
            return $"Bay {bayNumber} is already occupied.";
        }

        if (string.IsNullOrWhiteSpace(personName) || string.IsNullOrWhiteSpace(carRegistration))
        {
            return "Name and car registration are required.";
        }

        if (timeIn > DateTime.Now.AddMinutes(2))
        {
            return "Start time cannot be in the future.";
        }

        _data.StaffSessions.Add(new ParkingSession
        {
            Id = _data.Metadata.NextStaffSessionId++,
            BayNumber = bayNumber,
            PersonName = personName,
            CarRegistration = carRegistration,
            Notes = notes,
            TimeIn = timeIn,
            Status = RegisterConstants.StaffOccupied,
            CreatedBy = Environment.UserName,
        });

        SaveData();
        return $"Bay {bayNumber} checked in.";
    }

    private string CheckOutStaff(JsonElement payload)
    {
        EnsureWritable();

        var id = GetInt(payload, "id");
        var session = _data.StaffSessions.FirstOrDefault(item => item.Id == id && item.Status == RegisterConstants.StaffOccupied);
        if (session is null)
        {
            return "Could not find an active staff parking session.";
        }

        session.Status = RegisterConstants.StaffCompleted;
        session.TimeOut = DateTime.Now;
        session.CheckedOutBy = Environment.UserName;
        session.UpdatedAt = DateTime.Now;
        SaveData();
        return $"Bay {session.BayNumber} checked out.";
    }

    private string SignInVisitor(JsonElement payload)
    {
        EnsureWritable();

        var visitorName = GetString(payload, "visitorName").Trim();
        var companyName = GetString(payload, "companyName").Trim();
        var visiting = GetString(payload, "visiting").Trim();
        var carRegistration = GetString(payload, "carRegistration").Trim().ToUpperInvariant();
        var doorPassNumber = GetString(payload, "doorPassNumber").Trim();
        var notes = GetString(payload, "notes").Trim();
        var timeIn = GetDateTime(payload, "timeIn");
        var bayNumber = GetNullableInt(payload, "bayNumber");

        if (string.IsNullOrWhiteSpace(visitorName) || string.IsNullOrWhiteSpace(companyName) || string.IsNullOrWhiteSpace(visiting))
        {
            return "Visitor name, company name, and who they are visiting are required.";
        }

        if (bayNumber.HasValue && (!IsValidBay(bayNumber.Value) || !IsBayFree(bayNumber.Value)))
        {
            return bayNumber.HasValue ? $"Bay {bayNumber.Value} is already occupied." : "Choose a valid bay from 1 to 10.";
        }

        if (timeIn > DateTime.Now.AddMinutes(2))
        {
            return "Time in cannot be in the future.";
        }

        _data.VisitorSessions.Add(new VisitorSession
        {
            Id = _data.Metadata.NextVisitorSessionId++,
            VisitorName = visitorName,
            CompanyName = companyName,
            Visiting = visiting,
            CarRegistration = carRegistration,
            DoorPassNumber = doorPassNumber,
            BayNumber = bayNumber,
            Notes = notes,
            TimeIn = timeIn,
            Status = RegisterConstants.VisitorSignedIn,
            CreatedBy = Environment.UserName,
        });

        SaveData();
        return $"{visitorName} signed in.";
    }

    private string SignOutVisitor(JsonElement payload)
    {
        EnsureWritable();

        var id = GetInt(payload, "id");
        var visitor = _data.VisitorSessions.FirstOrDefault(item => item.Id == id && item.Status == RegisterConstants.VisitorSignedIn);
        if (visitor is null)
        {
            return "Could not find an active visitor session.";
        }

        visitor.Status = RegisterConstants.VisitorSignedOut;
        visitor.TimeOut = DateTime.Now;
        visitor.SignedOutBy = Environment.UserName;
        visitor.UpdatedAt = DateTime.Now;
        SaveData();
        return $"{visitor.VisitorName} signed out.";
    }

    private string SaveStaffProfile(JsonElement payload)
    {
        EnsureWritable();

        var personName = GetString(payload, "personName").Trim();
        var carRegistration = GetString(payload, "carRegistration").Trim().ToUpperInvariant();
        var originalPersonName = GetString(payload, "originalPersonName").Trim();
        var originalCarRegistration = GetString(payload, "originalCarRegistration").Trim().ToUpperInvariant();

        if (string.IsNullOrWhiteSpace(personName) || string.IsNullOrWhiteSpace(carRegistration))
        {
            return "Enter a name and car registration before saving a staff member.";
        }

        var existing = _data.StaffProfiles.FirstOrDefault(profile =>
            !string.IsNullOrWhiteSpace(originalPersonName) &&
            profile.PersonName.Equals(originalPersonName, StringComparison.OrdinalIgnoreCase) &&
            profile.CarRegistration.Equals(originalCarRegistration, StringComparison.OrdinalIgnoreCase));

        existing ??= _data.StaffProfiles.FirstOrDefault(profile => profile.PersonName.Equals(personName, StringComparison.OrdinalIgnoreCase));

        var duplicate = _data.StaffProfiles.Any(profile =>
            !ReferenceEquals(profile, existing) &&
            profile.PersonName.Equals(personName, StringComparison.OrdinalIgnoreCase));

        if (duplicate)
        {
            return "A saved staff member with that name already exists.";
        }

        if (existing is null)
        {
            _data.StaffProfiles.Add(new StaffProfile { PersonName = personName, CarRegistration = carRegistration });
        }
        else
        {
            existing.PersonName = personName;
            existing.CarRegistration = carRegistration;
        }

        SaveData();
        return $"{personName} saved on this PC.";
    }

    private string DeleteStaffProfile(JsonElement payload)
    {
        EnsureWritable();

        var personName = GetString(payload, "personName");
        var carRegistration = GetString(payload, "carRegistration");
        var removed = _data.StaffProfiles.RemoveAll(profile => profile.PersonName == personName && profile.CarRegistration == carRegistration);
        SaveData();
        return removed > 0 ? $"{personName} removed." : "Staff member was not found.";
    }

    private string ExportHistory()
    {
        using var dialog = new SaveFileDialog
        {
            AddExtension = true,
            DefaultExt = "xlsx",
            FileName = $"parking-register-history-{DateTime.Now:yyyy-MM-dd}.xlsx",
            Filter = "Excel Workbook (*.xlsx)|*.xlsx",
            Title = "Export parking register history",
        };

        if (dialog.ShowDialog(this) != DialogResult.OK)
        {
            return "Export cancelled.";
        }

        if (File.Exists(dialog.FileName))
        {
            File.Delete(dialog.FileName);
        }

        XlsxExporter.Export(_data, dialog.FileName);
        var openResult = MessageBox.Show("History exported. Open it now?", "Export complete", MessageBoxButtons.YesNo, MessageBoxIcon.Question);
        if (openResult == DialogResult.Yes)
        {
            Process.Start(new ProcessStartInfo(dialog.FileName) { UseShellExecute = true });
        }

        return "History exported.";
    }

    private async Task SendState(string message)
    {
        if (_webView.CoreWebView2 is null)
        {
            return;
        }

        var state = new
        {
            data = _data,
            dataLoaded = _dataLoaded,
            dataPath = _store.DataFilePath,
            loadError = _loadError,
            message,
            now = DateTime.Now,
        };
        var json = JsonSerializer.Serialize(state, JsonOptions);
        await _webView.CoreWebView2.ExecuteScriptAsync($"window.parkingRegisterReceiveState({JsonSerializer.Serialize(json)});");
    }

    private void SaveData()
    {
        EnsureWritable();
        _store.Save(_data);
    }

    private void EnsureWritable()
    {
        if (!_dataLoaded)
        {
            throw new InvalidOperationException("The JSON data file could not be loaded, so changes are disabled to avoid overwriting it.");
        }
    }

    private ParkingSession? ActiveStaffForBay(int bayNumber) =>
        _data.StaffSessions.FirstOrDefault(session => session.BayNumber == bayNumber && session.Status == RegisterConstants.StaffOccupied);

    private VisitorSession? ActiveVisitorForBay(int bayNumber) =>
        _data.VisitorSessions.FirstOrDefault(visitor => visitor.BayNumber == bayNumber && visitor.Status == RegisterConstants.VisitorSignedIn);

    private bool IsBayFree(int bayNumber) => ActiveStaffForBay(bayNumber) is null && ActiveVisitorForBay(bayNumber) is null;

    private static bool IsValidBay(int bayNumber) => bayNumber is >= 1 and <= RegisterConstants.BayCount;

    private static string GetString(JsonElement payload, string propertyName) =>
        payload.TryGetProperty(propertyName, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() ?? "" : "";

    private static int GetInt(JsonElement payload, string propertyName) =>
        payload.TryGetProperty(propertyName, out var value) && value.TryGetInt32(out var result) ? result : 0;

    private static int? GetNullableInt(JsonElement payload, string propertyName)
    {
        if (!payload.TryGetProperty(propertyName, out var value) || value.ValueKind == JsonValueKind.Null)
        {
            return null;
        }

        return value.TryGetInt32(out var result) ? result : null;
    }

    private static DateTime GetDateTime(JsonElement payload, string propertyName)
    {
        var value = GetString(payload, propertyName);
        return DateTime.TryParse(value, out var result) ? result : DateTime.Now;
    }
}
