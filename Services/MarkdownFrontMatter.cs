using System.Globalization;

namespace CyclingBlog.Services;

internal static class MarkdownFrontMatter
{
    public static bool TryParse(string markdown, out Dictionary<string, string> fields, out string body)
    {
        var parsed = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        fields = parsed;
        body = markdown;

        if (!markdown.StartsWith("---", StringComparison.Ordinal))
            return false;

        var end = markdown.IndexOf("\n---", 3, StringComparison.Ordinal);
        if (end < 0)
            return false;

        var yaml = markdown.Substring(3, end - 3).Trim('\r', '\n');
        body = markdown[(end + 4)..].TrimStart('\r', '\n');

        string? listKey = null;
        var listValues = new List<string>();

        void FlushList()
        {
            if (listKey is null)
                return;

            parsed[listKey] = string.Join('\n', listValues);
            listKey = null;
            listValues.Clear();
        }

        foreach (var rawLine in yaml.Split('\n'))
        {
            var line = rawLine.TrimEnd('\r');
            if (string.IsNullOrWhiteSpace(line) || line.TrimStart().StartsWith('#'))
                continue;

            if (line.StartsWith("  - ") || line.StartsWith("- "))
            {
                if (listKey is null)
                    continue;

                var item = line.Trim().TrimStart('-').Trim().Trim('"').Trim('\'');
                if (!string.IsNullOrEmpty(item))
                    listValues.Add(item);
                continue;
            }

            FlushList();

            var colon = line.IndexOf(':');
            if (colon <= 0)
                continue;

            var key = line[..colon].Trim();
            var value = line[(colon + 1)..].Trim();

            if (string.IsNullOrEmpty(value))
            {
                listKey = key;
                continue;
            }

            if (value.StartsWith('[') && value.EndsWith(']'))
            {
                var inner = value[1..^1];
                var parts = inner.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                    .Select(p => p.Trim('"').Trim('\''));
                parsed[key] = string.Join('\n', parts);
                continue;
            }

            parsed[key] = Unquote(value);
        }

        FlushList();
        return true;
    }

    public static DateTimeOffset? ParseDate(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return null;

        if (DateTimeOffset.TryParse(
                value,
                CultureInfo.InvariantCulture,
                DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal,
                out var dto))
        {
            return dto;
        }

        if (DateTime.TryParse(
                value,
                CultureInfo.InvariantCulture,
                DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal,
                out var dt))
        {
            return new DateTimeOffset(DateTime.SpecifyKind(dt, DateTimeKind.Utc));
        }

        return null;
    }

    public static List<string> ParseTags(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return new List<string>();

        return value
            .Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(t => !string.IsNullOrWhiteSpace(t))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    public static bool ParseBool(string? value, bool defaultValue = false)
    {
        if (string.IsNullOrWhiteSpace(value))
            return defaultValue;

        return value.Equals("true", StringComparison.OrdinalIgnoreCase)
               || value.Equals("yes", StringComparison.OrdinalIgnoreCase)
               || value.Equals("1", StringComparison.Ordinal);
    }

    private static string Unquote(string value)
    {
        if (value.Length >= 2)
        {
            if ((value[0] == '"' && value[^1] == '"') || (value[0] == '\'' && value[^1] == '\''))
                return value[1..^1];
        }

        return value;
    }

}
