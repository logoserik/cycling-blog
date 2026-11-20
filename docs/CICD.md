# CI/CD guide (UAT + production)

This repo uses **GitHub Actions + GitHub Pages** with **manual (or scheduled) deploys**. Merging a PR does **not** publish the site.

| Environment | URL | Floating tag |
|---|---|---|
| UAT | https://logoserik.github.io/cycling-blog/uat/ | `env/uat` |
| Production | https://logoserik.github.io/cycling-blog/ | `env/production` |

Both sites are published in one Pages artifact (prod at site root, UAT under `/uat/`) so you can review UAT without overwriting production.

## Pipeline map

```
feature branch ──PR──► master (protected)
                         │
                         │  (no auto deploy)
                         ▼
              Actions → Deploy (workflow_dispatch)
                         │
          ┌──────────────┼──────────────────┐
          ▼              ▼                  ▼
    deploy-uat   deploy-production   promote-uat-to-production
          │              │                  │
          └──────────────┴──────────────────┘
                         ▼
              GitHub Pages (uat/ + /)
```

| Workflow | Trigger | Purpose |
|---|---|---|
| `CI` | pull_request → `master` | Build & verify before merge |
| `Deploy` | **workflow_dispatch** only (schedule optional) | Publish UAT and/or production |

## One-time GitHub setup (required)

These settings need repo **admin** access in the GitHub UI (Actions cannot create them from this PR alone).

### 1) Environments

Repo → **Settings** → **Environments** → create:

**`uat`**
- URL: `https://logoserik.github.io/cycling-blog/uat/`
- **Required reviewers**: leave **off / empty** — UAT should deploy with no approval wait so you can kick it off immediately after merge
- **Deployment branches**: Selected branches → **`master` only**

**`production`**
- URL: `https://logoserik.github.io/cycling-blog/`
- **Required reviewers**: you (and future release owners only)
- Optional: wait timer (e.g. 5 minutes) as a freeze/think gate
- **Deployment branches**: Selected branches → **`master` only** (same as UAT)

Keep the auto-created `github-pages` environment (Pages publish target). The workflow enters `uat` or `production` first (production can pause for reviewers), then publishes through `github-pages`.

#### Why “deployment branches = master” does **not** weaken branch protection

These are two different locks:

| Control | What it governs |
|---|---|
| **Branch protection** on `master` | Who may **change** `master` (PR + approval + CI required) |
| **Deployment branches** on `uat` / `production` | Which workflow branch may **publish** to that environment |

So yes: set environment deployment branches to **`master`**. That means “Run workflow” for Deploy should be started from `master` (after the PR is merged). It does **not** allow direct pushes to `master`, and it blocks deploying a random feature branch straight to UAT/prod.

Intended path: feature branch → approved PR → merge to protected `master` → manually run Deploy from `master`.

### 2) Branch protection on `master`

Repo → **Settings** → **Branches** → rule for `master`:

| Setting | Value |
|---|---|
| Require a pull request before merging | On |
| Require approvals | 1+ (your account / release owners) |
| Require review from Code Owners | On (uses `.github/CODEOWNERS`) |
| Restrict who can push / dismiss | On — only named humans (not broad write; not unknown agents) |
| Require status checks | On → require **`Build & verify`** (from `CI`) |
| Require branches to be up to date | On (recommended) |
| Do not allow bypassing the above settings | On (recommended) |
| Allow force pushes | Off |
| Allow deletions | Off |

Your reading is correct: only approved PRs should land on `master`. Agents/authors open PRs; privileged users merge.

### 3) Pages

Repo → **Settings** → **Pages** → Source: **GitHub Actions** (already in use).

### 4) Actions permissions

Repo → **Settings** → **Actions** → **General**:
- Allow Actions
- Workflow permissions: **Read and write** (needed to move `env/uat` and `env/production` tags after deploy)

## Day-to-day usage

### Land a change

1. Open a PR into `master`.
2. Wait for **CI / Build & verify**.
3. Code owner approves and merges.
4. Nothing is live yet.

### Publish to UAT

1. **Actions** → **Deploy** → **Run workflow**
2. Action: `deploy-uat`
3. Ref: `master` (or a SHA/tag)
4. After the `uat` environment gate (if configured), check:  
   https://logoserik.github.io/cycling-blog/uat/

### Promote the exact UAT build to production

1. **Actions** → **Deploy** → **Run workflow**
2. Action: `promote-uat-to-production`
3. Production receives the **same commit** currently tagged `env/uat` (no “rebuild from a different tip”).

Or choose `deploy-production` with an explicit ref if you intentionally skip UAT.

### Schedule a deploy window

`Deploy` has no active cron by default. When you want a recurring window, uncomment the `schedule:` block in `.github/workflows/deploy.yml` (example: Mondays 09:00 UTC → UAT). You can still use **Run workflow** anytime for an immediate kick-off.

## CMS note

Sveltia writes to the GitHub branch set in `wwwroot/admin/config.yml` (`master`). Content commits still need the normal PR → merge → manual deploy path if writers do not push straight to `master`. For stricter separation later, point the CMS at a `content/uat` branch and open PRs from there.

## Rollback

Re-run **Deploy** with `deploy-production` (or `deploy-uat`) and set **ref** to a known-good commit SHA or to the previous value of `env/production` / `env/uat` from the Tags page.

## Fast-delivery checklist — what this PR adds vs what is still missing

### Implemented here

- [x] Separated UAT and production URLs on Pages
- [x] Manual deploy + optional schedule hook (no merge auto-deploy)
- [x] Promotion path (UAT SHA → production)
- [x] PR CI gate (build/verify)
- [x] CODEOWNERS for privileged review
- [x] Dependabot for Actions + NuGet
- [x] Floating `env/*` tags as deploy inventory

### Configure in GitHub UI (you)

- [ ] `uat` / `production` environments + reviewers
- [ ] `master` branch protection + required check `Build & verify`
- [ ] Restrict push/merge to specific users

### Recommended next (not in this PR)

| Gap | Why it matters |
|---|---|
| PR preview / content screenshot | Reviewers see the site without deploying UAT |
| Post-deploy smoke test (Playwright) | Catch broken base href, missing posts, 404s after publish |
| Uptime / synthetic check on prod URL | Know when Pages or DNS fails |
| Explicit release notes / changelog on promote | Audit what content went live |
| Agent identity model | Dedicated bot accounts with **PR-only** access; humans own merge + prod approve |
| CMS editorial workflow branch | Stop direct writes to `master` from `/admin` |
| Image budget / CI check on upload size | Protect repo growth called out in README risks |
| Secrets hygiene | Prefer fine-grained PATs; never store CMS tokens in the repo |
| Backup / export of `wwwroot/content` | Cheap insurance beyond git history |
| Change calendar / prod wait timer | Pair with environment wait timer for freeze windows |
