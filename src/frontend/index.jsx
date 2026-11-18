import React, { useEffect, useState } from 'react';
import ForgeReconciler, { Box, Stack, Inline, Heading, Text, Lozenge, Button, CodeBlock, SectionMessage, Spinner, ProgressBar, Icon } from '@forge/react';
import { invoke } from '@forge/bridge';

const tone = { ready: 'success', 'needs-work': 'moved', 'not-ready': 'removed' };

function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [posting, setPosting] = useState(false);
  const [posted, setPosted] = useState(null);
  const [showBrief, setShowBrief] = useState(false);

  const load = () => invoke('analyse').then(setData).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  if (error) return <SectionMessage appearance="error" title="Groundwork could not read this issue"><Text>{error}</Text></SectionMessage>;
  if (!data) return <Spinner label="Reading issue" />;
  const r = data.readiness;

  const onHandoff = async () => {
    setPosting(true);
    const res = await invoke('handoff');
    setPosting(false); setPosted(res);
  };

  return (
    <Stack space="space.200">
      <Inline spread="space-between" alignBlock="center">
        <Heading size="small">Agent readiness</Heading>
        <Lozenge appearance={tone[r.verdict]} isBold>{r.verdict.replace('-', ' ')}</Lozenge>
      </Inline>
      <ProgressBar value={r.passed / r.total} ariaLabel={`${r.passed} of ${r.total} checks pass`} />
      <Text>{r.passed} of {r.total} checks pass</Text>
      <Stack space="space.075">
        {r.checks.map((c) => (
          <Box key={c.id}>
            <Inline space="space.100" alignBlock="start">
              <Icon glyph={c.pass ? 'check-circle' : 'cross-circle'} label={c.pass ? 'pass' : 'fail'} primaryColor={c.pass ? 'color.icon.success' : 'color.icon.danger'} />
              <Stack space="space.025">
                <Text weight="medium">{c.label}</Text>
                {!c.pass && <Text size="small" color="color.text.subtle">{c.fix}</Text>}
              </Stack>
            </Inline>
          </Box>
        ))}
      </Stack>
      <Inline space="space.100">
        <Button appearance="primary" onClick={onHandoff} isDisabled={posting || r.verdict === 'not-ready'}>{posting ? 'Posting…' : 'Hand off to agent'}</Button>
        <Button onClick={() => setShowBrief(!showBrief)}>{showBrief ? 'Hide brief' : 'Preview brief'}</Button>
        <Button appearance="subtle" onClick={() => { setData(null); load(); }}>Re-check</Button>
      </Inline>
      {posted && (posted.ok
        ? <SectionMessage appearance="success" title="Brief posted"><Text>The brief is on this issue as a comment and the issue is labelled agent-ready.</Text></SectionMessage>
        : <SectionMessage appearance="warning" title="Not handed off"><Text>{posted.reason}</Text></SectionMessage>)}
      {showBrief && <CodeBlock language="markdown" text={data.brief} showLineNumbers={false} />}
    </Stack>
  );
}

ForgeReconciler.render(<React.StrictMode><App /></React.StrictMode>);
