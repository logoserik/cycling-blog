# Cycling Blog MVP

Single-page **8-bit light-mode** cycling blog built with **Blazor WebAssembly (.NET 10)**.

Writing lives as **Markdown** in this repo. **Sveltia CMS** is the editor UI (static admin page). The Blazor app reads published posts from `wwwroot/content/`.

## What you must provide

1. **GitHub repo name** — open `wwwroot/admin/config.yml` and set:
   ```yml
   backend:
     repo: YOUR_GITHUB_USER/cycling-blog
   ```
   This folder is not a git repo yet, so create/push one first.
2. **GitHub write access** — you (or anyone who publishes) need permission to push to that repo.
3. **Personal access token (first CMS login)** — in `/admin`, choose **Sign in with Token**, create a fine-grained PAT with **Contents: Read and write** on this repo, paste it once. Stored only in your browser.
4. **Optional: old Ghost posts** — if you want previous Ghost articles migrated, export them (or paste titles/bodies here) and ask to import. Nothing was migrated automatically because Ghost data lived outside this repo.

You do **not** need Docker, MySQL, Azure, or a Ghost API key anymore.

## Risks (read this)

| Risk | What it means | Mitigation |
|---|---|---|
| Public repo = public content | Drafts committed to `main` are visible in GitHub | Keep `draft: true` only if you accept file visibility, or use a private repo |
| GitHub token | A leaked PAT can edit the repo | Use a fine-grained PAT limited to this repo; revoke if lost |
| Publish is not instant | CMS save → GitHub commit → Actions rebuild (1–3 min) | Expected for static hosting |
| Image growth | Uploads live in git; large libraries slow the repo | Keep photos resized (e.g. under ~1 MB each) |
| Markdown HTML | Author can embed HTML/scripts in post body | Only trust people with repo write access |
| Sveltia is still beta | Occasional breaking CMS changes before 1.0 | Pin/watch releases; content remains plain Markdown either way |

Security upside vs Ghost: no always-on CMS server or database to patch.

## 1) Run locally (Blazor)

1. Install .NET 10 SDK.
2. From this folder: `dotnet run`
3. Open the site URL from the terminal.

Sample post: `wwwroot/content/posts/welcome-ride.md`

## 2) Edit content (Sveltia CMS)

After the site is on GitHub Pages:

1. Open `https://<user>.github.io/cycling-blog/admin/`
2. Sign in with a GitHub token (see above)
3. Create/edit a **Ride post**, upload photos, publish
4. Wait for the Actions deploy, then refresh the blog

Local tip: you can also edit Markdown files under `wwwroot/content/posts/` in the editor, then `dotnet run`. After adding a new `.md` file, rebuild once so `scripts/generate-post-index.ps1` refreshes `wwwroot/content/index.json` (this runs automatically on Windows `dotnet build` / publish). GitHub Actions uses `scripts/generate-post-index.sh` on Linux instead.

### Photo upload

- Feature image: post settings field → home card + hero
- Inline photos: Markdown editor image control → saved under `wwwroot/uploads/` as `![alt](/uploads/...)`
- You do **not** need raw HTML for images

### Tags

Use the Tags list field in the CMS. They render as badges on cards and post pages.

## 3) Deploy (GitHub Pages)

`.github/workflows/deploy-pages.yml` publishes the Blazor site to GitHub Pages.

Important:

- Local `dotnet run` uses `<base href="/" />`.
- The workflow rewrites it to `/cycling-blog/` for Pages. If your repo name is not `cycling-blog`, update that value in the workflow **and** keep `admin` base paths consistent.

### GitHub Pages settings

1. Repo → **Settings** → **Pages**
2. Source: **GitHub Actions**

### Deploy notes

Blazor publish output is `publish/wwwroot/` (not the publish root). The Actions workflow verifies required files before upload. You can re-run anytime via **Actions → Deploy (GitHub Pages) → Run workflow**.

## Content layout

```
wwwroot/
  admin/           # Sveltia CMS UI + config.yml
  content/
    index.json     # auto-generated slug list
    posts/*.md     # ride posts (front matter + Markdown body)
  uploads/         # photos from the CMS
```
