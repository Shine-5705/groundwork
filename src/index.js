import Resolver from '@forge/resolver';
import { fetchIssue, postHandoff } from './lib/jira.js';
import { readiness, buildBrief } from './lib/brief.js';

// ---- Issue panel resolver (UI Kit) ----
const resolver = new Resolver();
resolver.define('analyse', async ({ context }) => {
  const key = context.extension.issue.key;
  const issue = await fetchIssue(key);
  const r = readiness(issue);
  return { key, readiness: r, brief: buildBrief(issue, r) };
});
resolver.define('handoff', async ({ context }) => {
  const key = context.extension.issue.key;
  const issue = await fetchIssue(key);
  const r = readiness(issue);
  if (r.verdict === 'not-ready') return { ok: false, reason: 'Fix the blocking gaps first.', readiness: r };
  return { ok: true, ...(await postHandoff(key, buildBrief(issue, r))) };
});
export const panelHandler = resolver.getDefinitions();

// ---- Rovo actions (also used by the Groundwork agent and any other Rovo agent) ----
const keyFrom = (payload) => payload?.issueKey || payload?.context?.jira?.issueKey;

export async function getBrief(payload) {
  const key = keyFrom(payload);
  if (!key) return 'Give me a Jira issue key, for example PAY-142.';
  const issue = await fetchIssue(key);
  return buildBrief(issue);
}

export async function checkReadiness(payload) {
  const key = keyFrom(payload);
  if (!key) return 'Give me a Jira issue key, for example PAY-142.';
  const r = readiness(await fetchIssue(key));
  return { issueKey: key, passed: r.passed, total: r.total, verdict: r.verdict,
    gaps: r.checks.filter((c) => !c.pass).map((c) => ({ check: c.label, fix: c.fix })) };
}

export async function handoff(payload) {
  const key = keyFrom(payload);
  const issue = await fetchIssue(key);
  const r = readiness(issue);
  if (r.verdict === 'not-ready') return { issueKey: key, posted: false, reason: 'Readiness is not-ready', gaps: r.checks.filter((c) => !c.pass).map((c) => c.label) };
  const res = await postHandoff(key, buildBrief(issue, r));
  return { issueKey: key, posted: res.commented, labelled: res.labelled };
}
