using System.Text.Json;

namespace ParkingRegister.WinForms;

public sealed class RegisterDataStore
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    public string DataDirectory { get; }
    public string DataFilePath { get; }

    public RegisterDataStore()
    {
        DataDirectory = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "C365Cloud",
            "ParkingRegisterWinForms");
        DataFilePath = Path.Combine(DataDirectory, "register-data.json");
    }

    public RegisterData Load()
    {
        Directory.CreateDirectory(DataDirectory);

        if (!File.Exists(DataFilePath))
        {
            var created = new RegisterData();
            Save(created);
            return created;
        }

        try
        {
            using var stream = File.OpenRead(DataFilePath);
            return JsonSerializer.Deserialize<RegisterData>(stream, JsonOptions) ?? new RegisterData();
        }
        catch (JsonException error)
        {
            throw new InvalidDataException(
                $"The register data file is not valid JSON and was not overwritten:{Environment.NewLine}{DataFilePath}",
                error);
        }
    }

    public void Save(RegisterData data)
    {
        Directory.CreateDirectory(DataDirectory);
        data.Metadata.UpdatedAt = DateTime.Now;

        var temporaryPath = $"{DataFilePath}.tmp";
        using (var stream = File.Create(temporaryPath))
        {
            JsonSerializer.Serialize(stream, data, JsonOptions);
        }

        File.Move(temporaryPath, DataFilePath, overwrite: true);
    }
}
