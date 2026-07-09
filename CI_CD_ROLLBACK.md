# LingoLoop CI/CD and Rollback Guide

## What the pipeline does

GitHub Actions workflow:

- `.github/workflows/ci-cd.yml`

It runs on:

- Pull requests to `main`
- Pushes to `main`
- Manual `workflow_dispatch`

Pipeline stages:

1. Install Node.js dependencies with `npm ci`.
2. Syntax-check every JavaScript file with `node --check`.
3. Parse-check every JSON file.
4. Build the Docker image.
5. On `main` pushes, optionally trigger Render deploy.

## Render deployment secret

To enable automatic Render deployment:

1. Open GitHub repository settings.
2. Go to **Secrets and variables** -> **Actions**.
3. Add a repository secret:

```text
RENDER_DEPLOY_HOOK_URL
```

Use the deploy hook URL from your Render service.

If the secret is missing, the workflow still validates and builds, but it skips deployment.

## Backup created before CI/CD setup

Before adding CI/CD, the current safe commit was backed up as:

```text
backup/pre-cicd-20260710
backup-pre-cicd-20260710
```

The branch and tag were both pushed to GitHub.

## Fast rollback options

### Option 1: Restore from backup branch

```bash
git checkout main
git reset --hard backup/pre-cicd-20260710
git push --force-with-lease origin main
```

### Option 2: Restore from backup tag

```bash
git checkout main
git reset --hard backup-pre-cicd-20260710
git push --force-with-lease origin main
```

### Option 3: Revert only the CI/CD commit

Use this if the app works but the pipeline file has a problem:

```bash
git revert <ci-cd-commit-sha>
git push origin main
```

## Render rollback

Render also keeps deploy history. If a deployment breaks:

1. Open the Render service.
2. Go to **Deploys**.
3. Pick the last working deploy.
4. Use **Rollback**.

## Notes

- Runtime JSON data should not normally be committed.
- `.env` is not copied into Docker images.
- Render deploys should use environment variables/secrets from the Render dashboard.
