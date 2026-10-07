using System.Net.Http.Json;
using Markdig;

namespace CyclingBlog.Services;

public sealed class BlogContentClient
{
    private static readonly MarkdownPipeline Pipeline = new MarkdownPipelineBuilder()
        .UseAdvancedExtensions()
        .Build();

    private readonly HttpClient _http;

    public BlogContentClient(HttpClient http)
    {
        _http = http;
    }

    public async Task<List<BlogPostBrief>> BrowsePostsAsync(int limit)
    {
        var posts = await LoadPublishedPostsAsync();
        return posts
            .OrderByDescending(p => p.PublishedAt ?? DateTimeOffset.MinValue)
            .Take(limit)
            .Select(ToBrief)
            .ToList();
    }

    public async Task<BlogPost?> ReadPostBySlugAsync(string slug)
    {
        var posts = await LoadPublishedPostsAsync();
        return posts.FirstOrDefault(p =>
            string.Equals(p.Slug, slug, StringComparison.OrdinalIgnoreCase));
    }

    private async Task<List<BlogPost>> LoadPublishedPostsAsync()
    {
        var index = await _http.GetFromJsonAsync<ContentIndexFile>("content/index.json")
                    ?? new ContentIndexFile();

        var results = new List<BlogPost>();
        foreach (var entry in index.posts)
        {
            if (string.IsNullOrWhiteSpace(entry.slug))
                continue;

            var parsed = await ReadMarkdownFileAsync(entry.slug.Trim());
            if (parsed is null || parsed.Value.IsDraft)
                continue;

            results.Add(parsed.Value.Post);
        }

        return results;
    }

    private async Task<(BlogPost Post, bool IsDraft)?> ReadMarkdownFileAsync(string slug)
    {
        using var response = await _http.GetAsync($"content/posts/{Uri.EscapeDataString(slug)}.md");
        if (!response.IsSuccessStatusCode)
            return null;

        var markdown = await response.Content.ReadAsStringAsync();
        if (!MarkdownFrontMatter.TryParse(markdown, out var fields, out var body))
        {
            body = markdown;
            fields = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                ["title"] = slug
            };
        }

        var html = Markdown.ToHtml(body, Pipeline);
        html = RewriteContentUrls(html);

        var post = new BlogPost
        {
            Slug = slug,
            Title = GetField(fields, "title") ?? slug,
            PublishedAt = MarkdownFrontMatter.ParseDate(GetField(fields, "date")),
            Excerpt = GetField(fields, "excerpt"),
            FeatureImage = RewriteContentUrl(GetField(fields, "feature_image")),
            Tags = MarkdownFrontMatter.ParseTags(GetField(fields, "tags")),
            Html = html
        };

        var isDraft = MarkdownFrontMatter.ParseBool(GetField(fields, "draft"), defaultValue: false);
        return (post, isDraft);
    }

    private static BlogPostBrief ToBrief(BlogPost post) => new()
    {
        Slug = post.Slug,
        Title = post.Title,
        PublishedAt = post.PublishedAt,
        Excerpt = post.Excerpt,
        FeatureImage = post.FeatureImage,
        Tags = post.Tags
    };

    private string RewriteContentUrls(string html)
    {
        var prefix = _http.BaseAddress?.ToString().TrimEnd('/') + "/";
        if (string.IsNullOrEmpty(prefix))
            return html;

        return html
            .Replace("src=\"/uploads/", $"src=\"{prefix}uploads/", StringComparison.Ordinal)
            .Replace("href=\"/uploads/", $"href=\"{prefix}uploads/", StringComparison.Ordinal)
            .Replace("src=\"uploads/", $"src=\"{prefix}uploads/", StringComparison.Ordinal)
            .Replace("href=\"uploads/", $"href=\"{prefix}uploads/", StringComparison.Ordinal);
    }

    private string? RewriteContentUrl(string? url)
    {
        if (string.IsNullOrWhiteSpace(url))
            return null;

        if (url.StartsWith("http://", StringComparison.OrdinalIgnoreCase)
            || url.StartsWith("https://", StringComparison.OrdinalIgnoreCase)
            || url.StartsWith("data:", StringComparison.OrdinalIgnoreCase))
        {
            return url;
        }

        var prefix = _http.BaseAddress?.ToString().TrimEnd('/') + "/";
        if (string.IsNullOrEmpty(prefix))
            return url;

        if (url.StartsWith("/uploads/", StringComparison.Ordinal))
            return prefix + url.TrimStart('/');

        if (url.StartsWith("uploads/", StringComparison.Ordinal))
            return prefix + url;

        return url;
    }

    private static string? GetField(Dictionary<string, string> fields, string key)
        => fields.TryGetValue(key, out var value) && !string.IsNullOrWhiteSpace(value)
            ? value.Trim()
            : null;
}
