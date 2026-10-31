# Working in this repo

## Commits
- Author and committer are garrett391 <garrett.michael@outlook.com>, nobody else.
- No Co-Authored-By, Claude-Session or "Generated with" lines, in commits or PRs.
- Short, plain one-line messages, the way the existing history reads
  (e.g. "Greg's cutscene: art for the challenge at his table").
- Merging is fine without asking; push to main as a single clean commit.

## Versions
- Bump the patch version (0.5.5 → 0.5.6) for each user-facing change, in
  app.json, package.json and package-lock.json together. Mention it at the end
  of the message ("...; v0.5.6"). Docs-only or tooling changes don't need one.

## Before pushing
- `npx tsc --noEmit` and `npm test` pass.
- Campaign canon lives in docs/design/campaign-lore.md; keep it in step with
  story or character changes.
