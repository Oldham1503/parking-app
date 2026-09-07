namespace ParkingRegister.WinForms;

public sealed class RegisterData
{
    public AppMetadata Metadata { get; set; } = new();
    public List<ParkingSession> StaffSessions { get; set; } = [];
    public List<VisitorSession> VisitorSessions { get; set; } = [];
    public List<StaffProfile> StaffProfiles { get; set; } = [];
}

public sealed class AppMetadata
{
    public int NextStaffSessionId { get; set; } = 1;
    public int NextVisitorSessionId { get; set; } = 1;
    public DateTime CreatedAt { get; set; } = DateTime.Now;
    public DateTime UpdatedAt { get; set; } = DateTime.Now;
}

public sealed class ParkingSession
{
    public int Id { get; set; }
    public int BayNumber { get; set; }
    public string PersonName { get; set; } = "";
    public string CarRegistration { get; set; } = "";
    public string Notes { get; set; } = "";
    public DateTime TimeIn { get; set; }
    public DateTime? TimeOut { get; set; }
    public string Status { get; set; } = RegisterConstants.StaffOccupied;
    public string CreatedBy { get; set; } = Environment.UserName;
    public string? CheckedOutBy { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.Now;
    public DateTime UpdatedAt { get; set; } = DateTime.Now;
}

public sealed class VisitorSession
{
    public int Id { get; set; }
    public string VisitorName { get; set; } = "";
    public string CompanyName { get; set; } = "";
    public string Visiting { get; set; } = "";
    public string CarRegistration { get; set; } = "";
    public string DoorPassNumber { get; set; } = "";
    public int? BayNumber { get; set; }
    public string Notes { get; set; } = "";
    public DateTime TimeIn { get; set; }
    public DateTime? TimeOut { get; set; }
    public string Status { get; set; } = RegisterConstants.VisitorSignedIn;
    public string CreatedBy { get; set; } = Environment.UserName;
    public string? SignedOutBy { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.Now;
    public DateTime UpdatedAt { get; set; } = DateTime.Now;
}

public sealed class StaffProfile
{
    public string PersonName { get; set; } = "";
    public string CarRegistration { get; set; } = "";

    public override string ToString() => $"{PersonName} - {CarRegistration}";
}

public static class RegisterConstants
{
    public const int BayCount = 10;
    public const string StaffOccupied = "Occupied";
    public const string StaffCompleted = "Completed";
    public const string VisitorSignedIn = "Signed In";
    public const string VisitorSignedOut = "Signed Out";
}
