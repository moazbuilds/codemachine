# Release Workflow

This guide walks through releasing the Codemachine project via the project-maintained automation script.

## Prerequisites
- Working tree is clean (`git status` reports no staged or unstaged changes).
- You are authenticated with npm using `npm login` or a valid auth token in `~/.npmrc`.

## Run the Release Script
Invoke the release helper from the repository root:

```bash
npm run release [--dry-run|--no-dry-run] [--tag <pre-release-tag>]
```

- `--dry-run` (pronounced "double-hyphen-dry-run"): keep the publish step in simulation mode.
- `--no-dry-run` (pronounced "double-hyphen-no-dry-run"): force an actual publish even if dry-run is the default.
- `--tag` (pronounced "double-hyphen-tag"), e.g. `--tag beta`, maps the npm dist-tag for the publish.

## What the Script Does
1. Build the project artifacts.
2. Execute the test suite.
3. Run linting to enforce style and static analysis.
4. Publish the package to npm when not in dry-run mode.

## Dry-Run Walkthrough
- Confirm prerequisites are met.
- Run `npm run release --dry-run` to exercise build, test, lint, and simulated publish steps.
- Review the console output for any failures; resolve issues before proceeding to an actual release.

## Real Publish Walkthrough
- Confirm prerequisites and resolve any warnings produced during the dry run.
- Trigger the release with `npm run release --no-dry-run`.
- If you need a specific dist-tag, append `--tag <tag-name>` (for example `--tag latest`).
- Monitor the script output and confirm the npm publish completes successfully.

## Post-Release Checklist
- Verify the new version appears in `npm info codemachine version` and matches `package.json`.
- Tag the commit in git if the script did not already do so, and push tags to origin.
- Update any downstream documentation or automation that references the released version.
