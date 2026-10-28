namespace CyclingBlog.Services;

public static class RideSearch
{
    public static bool Matches(string? query, string? title, IEnumerable<string>? tags, string? body, string? excerpt = null)
    {
        if (string.IsNullOrWhiteSpace(query))
            return true;

        var haystack = string.Join(
            '\n',
            title ?? "",
            excerpt ?? "",
            string.Join('\n', tags ?? Array.Empty<string>()),
            body ?? "");

        var tokens = query.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        foreach (var token in tokens)
        {
            if (haystack.IndexOf(token, StringComparison.OrdinalIgnoreCase) < 0)
                return false;
        }

        return true;
    }
}

public sealed class RideSearchState
{
    public string Query { get; private set; } = "";

    public event Action? Changed;

    public void Set(string? query)
    {
        query ??= "";
        if (query == Query)
            return;

        Query = query;
        Changed?.Invoke();
    }
}
