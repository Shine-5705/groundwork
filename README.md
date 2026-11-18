# Groundwork for Jira

**Get Jira issues ready for AI coding agents before you hand them off.**

Coding agents (Cursor, Claude Code, Codex, Rovo Dev) are only as good as the ticket they are given. A vague issue produces a confident, wrong pull request. Groundwork is an Atlassian Forge app that checks a Jira issue against seven explainable readiness checks, tells the reporter exactly what to fix, and writes a clean markdown brief that an agent can act on. When the issue is ready, one click posts the brief as a comment and labels the issue `agent-ready`.

Built for **Codegeist 2026**, category **Apps for Software Teams**, bonus **Best Agents (Rovo)**.

Live preview of the engine (runs in your browser on hand-written sample issues): https://shine-5705.github.io/groundwork/

## What it does

| Surface | Forge module | What you get |
| --- | --- | --- |
| Issue panel | `jira:issuePanel` (UI Kit, native render) | Readiness verdict, a pass/fail list with a fix for each gap, brief preview, "Hand off to agent" |
| Rovo agent | `rovo:agent` | "Is this issue ready for a coding agent?" in Rovo chat |
| Rovo actions | `action` x3 | `check-readiness`, `get-agent-brief`, `post-agent-handoff`, reusable by any Rovo agent |

### The seven checks

1. Summary is specific (5+ words)
2. Description has real context (40+ words)
3. Acceptance criteria are written down (a heading, Given/When/Then, or a task list)
4. Bugs have repro steps and expected vs actual; other work names a component or label
5. Points at code: a file path or a symbol
6. No unanswered questions in the comments
7. Not blocked by an open issue

The score is simply checks passed out of seven. A missing acceptance criterion or an open blocker makes the issue **not ready**, and the handoff action refuses to post. Anything else is **needs work**. Groundwork never invents acceptance criteria, file paths or decisions: if the issue lacks them, the brief says so.

### The brief

The brief has the task, the files it mentions, related issues with their status, the latest decisions from the comments, any open questions, the gaps, and a short working agreement: restate the acceptance criteria, stay in scope, add a failing-then-passing test, reference the issue key in the branch, commit and PR.

## Architecture

```
manifest.yml            Forge modules, scopes (read:jira-work, write:jira-work), Node 22 runtime
src/index.js            Resolver for the panel + 3 Rovo action handlers
src/lib/brief.js        normaliseIssue(), readiness(), buildBrief()  (pure, unit-tested)
src/lib/adf.js          Atlassian Document Format <-> text
src/lib/jira.js         Jira REST v3 calls through @forge/api (asUser)
src/frontend/index.jsx  UI Kit issue panel
prompts/agent.md        Rovo agent instructions
test/                   node:test suite with two hand-written fixture issues
```

Data stays inside Atlassian: Groundwork only calls the Jira REST API through Forge, with the user's own permissions (`asUser`). No external egress, no storage.

## Install (judges)

Use the installation link on the Devpost submission, pick your Jira Cloud site, then open any issue: the **Groundwork** panel appears under the issue description, and the **Groundwork** agent appears in Rovo chat.

## Develop

```bash
npm install
npm test                          # 6 tests, no Atlassian account needed
npm install -g @forge/cli
forge login                       # Atlassian account + API token
forge register                    # writes the real app id into manifest.yml
forge deploy -e production
forge install --product jira --site <your-site>.atlassian.net -e production
```

Sharing for judges: Developer console -> Groundwork -> Distribution -> Edit -> Sharing on -> copy the installation link.

## Honest status

- The readiness engine, brief builder and ADF conversion are tested (`npm test`, 6 passing).
- The panel and Rovo modules are written against Forge's documented module schema. They still need to be deployed and run against a real Jira Cloud site (`forge deploy`), which needs the author's Atlassian login. `manifest.yml` keeps a placeholder app id until `forge register` runs.
- Sample issues in `test/fixtures` and on the preview site are hand-written, not customer data.

## License

MIT, see [LICENSE](LICENSE).
