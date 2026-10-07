namespace CyclingBlog.Services;

public class BlogPostBrief
{
    public string Slug { get; set; } = "";
    public string Title { get; set; } = "";
    public DateTimeOffset? PublishedAt { get; set; }
    public string? Excerpt { get; set; }
    public string? FeatureImage { get; set; }
    public List<string> Tags { get; set; } = new();
}

public sealed class BlogPost : BlogPostBrief
{
    public string Html { get; set; } = "";
}

internal sealed class ContentIndexFile
{
    public List<ContentIndexEntry> posts { get; set; } = new();
}

internal sealed class ContentIndexEntry
{
    public string slug { get; set; } = "";
}
