import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normaliseIssue, readiness, buildBrief } from '../src/lib/brief.js';
import { adfToText, textToAdf } from '../src/lib/adf.js';

const load = (n) => normaliseIssue(JSON.parse(readFileSync(new URL(`./fixtures/${n}.json`, import.meta.url))));

test('ADF lists, headings and code survive conversion', () => {
  const t = adfToText({ type: 'doc', content: [
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'AC' }] },
    { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'one' }] }] }] },
    { type: 'codeBlock', attrs: { language: 'js' }, content: [{ type: 'text', text: 'x()' }] }] });
  assert.match(t, /## AC/); assert.match(t, /- one/); assert.match(t, /```js\nx\(\)/);
});

test('a well-written bug is ready: 7/7', () => {
  const r = readiness(load('ready'));
  assert.equal(r.verdict, 'ready');
  assert.equal(r.passed, r.total);
  assert.deepEqual(r.files, ['src/billing/invoices.ts', 'src/billing/invoices.test.ts']);
});

test('a vague, blocked task is not-ready and names every gap', () => {
  const r = readiness(load('vague'));
  assert.equal(r.verdict, 'not-ready');
  const failed = r.checks.filter((c) => !c.pass).map((c) => c.id).sort();
  assert.deepEqual(failed, ['acceptance', 'blockers', 'code', 'description', 'questions', 'scope', 'summary']);
  assert.equal(r.openQuestions[0].q, 'Which customers see this?');
});

test('brief carries task, files, links, decisions and the working agreement', () => {
  const b = buildBrief(load('ready'));
  assert.match(b, /^# PAY-142: Return 404/);
  assert.match(b, /## Files mentioned\n- src\/billing\/invoices.ts/);
  assert.match(b, /is caused by PAY-120: Move invoices to the new ORM \[Done\]/);
  assert.match(b, /Asha: Agreed with the API guild/);
  assert.match(b, /Reference PAY-142 in the branch name/);
  assert.doesNotMatch(b, /Gaps flagged/);
});

test('brief for a vague issue lists open questions and gaps instead of inventing detail', () => {
  const b = buildBrief(load('vague'));
  assert.match(b, /## Open questions[\s\S]*Ravi: Which customers see this\?/);
  assert.match(b, /## Gaps flagged by Groundwork/);
  assert.doesNotMatch(b, /## Files mentioned/);
});

test('handoff comment is valid ADF with the brief in a code block', () => {
  const adf = textToAdf('# X');
  assert.equal(adf.type, 'doc'); assert.equal(adf.content[1].type, 'codeBlock');
});
