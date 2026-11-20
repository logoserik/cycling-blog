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
| **Ruleset** on `master` | Who may **change** `master` (PR + approval + CI required) |
| **Deployment branches** on `uat` / `production` | Which workflow branch may **publish** to that environment |

So yes: set environment deployment branches to **`master`**. That means “Run workflow” for Deploy should be started from `master` (after the PR is merged). It does **not** allow direct pushes to `master`, and it blocks deploying a random feature branch straight to UAT/prod.

Intended path: feature branch → approved PR → merge to protected `master` → manually run Deploy from `master`.

### 2) Protect `master` with a **Ruleset** (current GitHub UI)

GitHub moved most of this out of classic **Settings → Branches**. Use:

**Settings → Rules → Rulesets → New ruleset → New branch ruleset**

| Field | Value |
|---|---|
| Ruleset name | e.g. `protect-master` |
| Enforcement status | **Active** |
| Bypass list | **Leave empty** (this replaces “Do not allow bypassing…”) |
| Target branches | **Include by name** → `master` (or **Include default branch**) |

Then under **Branch protections**, enable these rules (names match the Rulesets page):

| Ruleset rule (what you see) | Set to | Old branch-protection name (if you were searching for it) |
|---|---|---|
| **Restrict deletions** | On (usually default) | Allow deletions → Off |
| **Block force pushes** | On (usually default) | Allow force pushes → Off |
| **Require a pull request before merging** | On | same name |
| → Required approvals | `1` (you / release owners) | Require approvals |
| → Require review from Code Owners | On | same idea |
| → Restrict who can dismiss pull request reviews | On → only you / release owners | part of “Restrict who can push / dismiss” |
| **Require status checks to pass before merging** | On | Require status checks |
| → Status checks to add | `Build & verify` (from the `CI` workflow) | same |
| → **Require branches to be up to date before merging** | On (recommended) | same checkbox, nested under status checks |
| **Restrict updates** | On (recommended) | rest of “Restrict who can push…” — blocks direct pushes; changes go through PRs unless someone is on the Bypass list |

Notes:

- You will **not** find “Allow deletions”, “Allow force pushes”, or “Do not allow bypassing” as those exact classic labels on the Rulesets page.
- **Bypass list empty** = nobody skips the rules (admins included, unless you later add them).
- After the first CI run exists, the check name `Build & verify` should appear when you search/add required status checks. If it does not yet, type the name exactly and add it.
- Classic **Settings → Branches → Add classic branch protection rule** still exists on some accounts, but Rulesets is what GitHub documents now: [Creating rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository), [Available rules](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets).

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
