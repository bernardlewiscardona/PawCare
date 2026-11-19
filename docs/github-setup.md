# GitHub repository setup

Do this once, after creating the repository and pushing `main`. It covers SETUP-01's "pull-request review, branch protection and secret scanning".

## 1. Create and push

```bash
gh repo create <org>/pawcare --private --source . --push
```

## 2. Protect `main`

Require a pull request with one approval, and both CI jobs passing, before anything merges:

```bash
gh api -X PUT repos/<org>/pawcare/branches/main/protection \
  -H "Accept: application/vnd.github+json" \
  --input - <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["Lint, typecheck, build, test", "Mobile bundle smoke test"]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true
}
JSON
```

The two check names must match the `name:` of the jobs in `.github/workflows/ci.yml`. Run CI once (open any PR) before you apply this, so GitHub knows the check names.

Once approvers are confirmed (open decision in `docs/decisions.md`), fill in `.github/CODEOWNERS` and set `require_code_owner_reviews` to `true`.

## 3. Secret scanning and push protection

Settings → Code security → turn on **Secret scanning** and **Push protection**. Or:

```bash
gh api -X PATCH repos/<org>/pawcare \
  -F 'security_and_analysis[secret_scanning][status]=enabled' \
  -F 'security_and_analysis[secret_scanning_push_protection][status]=enabled'
```

(For private repositories on some plans, this requires GitHub Advanced Security.)

## 4. Dependabot

`.github/dependabot.yml` is already committed. Turn on **Dependabot alerts** and **security updates** under Settings → Code security. Expo and React Native packages are excluded from routine bumps on purpose: upgrade them together during an Expo SDK upgrade with `npx expo install --fix`.
