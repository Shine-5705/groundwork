import { adfToText } from './adf.js';

const AC_RE = /(acceptance criteria|definition of done|\bAC\b|given .+ when .+ then|- \[[ x]\])/i;
const REPRO_RE = /(steps to reproduce|repro|expected( result| behaviou?r)?|actual( result| behaviou?r)?)/i;
const PATH_RE = /([\w.-]+\/)+[\w.-]+\.(js|ts|tsx|jsx|py|go|rs|java|kt|rb|cs|c|cpp|h|swift|php|sql|ya?ml|json)\b/g;
const CODE_REF_RE = /`[^`]+`|\b[a-z]+[A-Z]\w+\(|\b\w+_\w+\(/;

/** Normalise the Jira REST v3 issue payload into the fields Groundwork reasons about. */
export function normaliseIssue(raw) {
  const f = raw.fields || {};
  const description = typeof f.description === 'string' ? f.description : adfToText(f.description).trim();
  const comments = (f.comment?.comments || []).map((c) => ({
    author: c.author?.displayName || 'unknown',
    created: c.created,
    body: typeof c.body === 'string' ? c.body : adfToText(c.body).trim(),
  }));
  const links = (f.issuelinks || []).map((l) => {
    const other = l.outwardIssue || l.inwardIssue;
    const rel = l.outwardIssue ? l.type?.outward : l.type?.inward;
    return { relation: rel || 'relates to', key: other?.key, summary: other?.fields?.summary, status: other?.fields?.status?.name };
  });
  return {
    key: raw.key,
    summary: f.summary || '',
    type: f.issuetype?.name || 'Task',
    status: f.status?.name || '',
    priority: f.priority?.name || '',
    labels: f.labels || [],
    components: (f.components || []).map((c) => c.name),
    description,
    comments,
    links,
  };
}

/** Deterministic readiness checks. Each check is explainable; the score is passed/total, nothing else. */
export function readiness(issue) {
  const text = issue.description || '';
  const isBug = /bug|defect|incident/i.test(issue.type);
  const files = [...new Set(text.match(PATH_RE) || [])];
  const openQuestions = issue.comments.flatMap((c) =>
    c.body.split('\n').filter((l) => l.trim().endsWith('?')).map((q) => ({ author: c.author, q: q.trim() })));
  const blockers = issue.links.filter((l) => /block/i.test(l.relation) && /is blocked/i.test(l.relation) && !/done|closed|resolved/i.test(l.status || ''));

  const checks = [
    { id: 'summary', label: 'Summary is specific (5+ words)', pass: issue.summary.trim().split(/\s+/).length >= 5,
      fix: 'Rewrite the summary as an outcome, e.g. "Return 404 when invoice id is unknown".' },
    { id: 'description', label: 'Description has real context (40+ words)', pass: text.split(/\s+/).filter(Boolean).length >= 40,
      fix: 'Add why this matters and what the current behaviour is.' },
    { id: 'acceptance', label: 'Acceptance criteria are written down', pass: AC_RE.test(text),
      fix: 'Add an "Acceptance criteria" list or Given/When/Then lines. Agents verify against these.' },
    isBug
      ? { id: 'repro', label: 'Bug has repro steps and expected vs actual', pass: REPRO_RE.test(text),
          fix: 'Add "Steps to reproduce", "Expected" and "Actual".' }
      : { id: 'scope', label: 'Scope names a component or label', pass: issue.components.length + issue.labels.length > 0,
          fix: 'Set a component or label so the agent knows which area of the codebase to touch.' },
    { id: 'code', label: 'Points at code (file path or symbol)', pass: files.length > 0 || CODE_REF_RE.test(text),
      fix: 'Name the file, module or function where the change likely lives.' },
    { id: 'questions', label: 'No unanswered questions in comments', pass: openQuestions.length === 0,
      fix: 'Answer or resolve the open questions before handing off.' },
    { id: 'blockers', label: 'Not blocked by an open issue', pass: blockers.length === 0,
      fix: 'Finish or unlink the blocking issue first.' },
  ];
  const passed = checks.filter((c) => c.pass).length;
  const hardFail = checks.some((c) => (c.id === 'acceptance' || c.id === 'blockers') && !c.pass);
  const verdict = passed === checks.length ? 'ready' : hardFail ? 'not-ready' : 'needs-work';
  return { passed, total: checks.length, verdict, checks, files, openQuestions, blockers };
}

/** Build the markdown brief an external coding agent (Claude Code, Cursor, Codex, Rovo Dev) can act on. */
export function buildBrief(issue, r = readiness(issue)) {
  const lines = [];
  lines.push(`# ${issue.key}: ${issue.summary}`);
  lines.push('');
  lines.push(`Type: ${issue.type} | Status: ${issue.status || 'n/a'} | Priority: ${issue.priority || 'n/a'}`);
  if (issue.components.length || issue.labels.length) lines.push(`Area: ${[...issue.components, ...issue.labels].join(', ')}`);
  lines.push(`Readiness: ${r.passed}/${r.total} checks (${r.verdict})`);
  lines.push('');
  lines.push('## Task');
  lines.push(issue.description || '(no description)');
  if (r.files.length) { lines.push(''); lines.push('## Files mentioned'); r.files.forEach((p) => lines.push(`- ${p}`)); }
  if (issue.links.length) {
    lines.push(''); lines.push('## Related issues');
    issue.links.forEach((l) => lines.push(`- ${l.relation} ${l.key}${l.summary ? `: ${l.summary}` : ''}${l.status ? ` [${l.status}]` : ''}`));
  }
  const decisions = issue.comments.filter((c) => !c.body.trim().endsWith('?')).slice(-5);
  if (decisions.length) {
    lines.push(''); lines.push('## Latest discussion');
    decisions.forEach((c) => lines.push(`- ${c.author}: ${c.body.replace(/\s+/g, ' ').slice(0, 280)}`));
  }
  if (r.openQuestions.length) {
    lines.push(''); lines.push('## Open questions (resolve or ask before coding)');
    r.openQuestions.forEach((o) => lines.push(`- ${o.author}: ${o.q}`));
  }
  const gaps = r.checks.filter((c) => !c.pass);
  if (gaps.length) { lines.push(''); lines.push('## Gaps flagged by Groundwork'); gaps.forEach((g) => lines.push(`- ${g.label}: ${g.fix}`)); }
  lines.push('');
  lines.push('## Working agreement for the agent');
  lines.push('1. Restate the acceptance criteria before changing code.');
  lines.push('2. Keep the change scoped to this issue; open a new issue for anything else.');
  lines.push('3. Add or update a test that fails before your change and passes after.');
  lines.push(`4. Reference ${issue.key} in the branch name, commit message and pull request.`);
  return lines.join('\n');
}
