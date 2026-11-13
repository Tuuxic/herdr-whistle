# Issue tracker: GitHub issues

Specs and tickets for this repo are issues on github.com/Tuuxic/herdr-whistle.

## Access

The `gh` CLI, run from the repo (`gh issue ...`).

## Statuses

- `ready-for-agent` → open, label `ready-for-agent`
- `ready-for-human` → open, label `ready-for-human`
- `in-progress` → open, label `in-progress`
- `done` → closed (completed)

An issue has at most one of the three labels; changing status swaps the label.

## When a skill says "publish to the issue tracker"

- A spec: `gh issue create --title "<feature>" --label spec,<status> --body-file <file>`.
- A ticket: `gh issue create --title "<ticket>" --label <status> --body-file <file>`, with
  `Part of #<spec>` as the body's first line. Then add `- [ ] #<ticket>` to the spec's task
  list (`gh issue edit <spec> --body-file ...`).

## When a skill says "fetch the relevant ticket"

`gh issue view <number> --comments`. By title: `gh issue list --search "<words> in:title"`.

## Blocking edges

None used natively: write `Blocked by: #<n>, #<m>` in the ticket body.

## When a skill says "close the ticket"

`gh issue close <number> --reason completed --comment "Done in <commit>"`.
