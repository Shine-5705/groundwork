import api, { route } from '@forge/api';
import { normaliseIssue } from './brief.js';
import { textToAdf } from './adf.js';

const FIELDS = 'summary,description,issuetype,status,priority,labels,components,issuelinks,comment';

export async function fetchIssue(issueKey, asUser = true) {
  const client = asUser ? api.asUser() : api.asApp();
  const res = await client.requestJira(route`/rest/api/3/issue/${issueKey}?fields=${FIELDS}`, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Jira returned ${res.status} for ${issueKey}`);
  return normaliseIssue(await res.json());
}

export async function postHandoff(issueKey, markdown, asUser = true) {
  const client = asUser ? api.asUser() : api.asApp();
  const c = await client.requestJira(route`/rest/api/3/issue/${issueKey}/comment`, {
    method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ body: textToAdf(markdown) }),
  });
  if (!c.ok) throw new Error(`Could not comment on ${issueKey}: ${c.status}`);
  const l = await client.requestJira(route`/rest/api/3/issue/${issueKey}`, {
    method: 'PUT', headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ update: { labels: [{ add: 'agent-ready' }] } }),
  });
  return { commented: true, labelled: l.ok };
}
