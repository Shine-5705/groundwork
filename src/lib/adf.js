// Minimal Atlassian Document Format -> plain text, keeping list and code structure.
export function adfToText(node, depth = 0) {
  if (!node) return '';
  if (typeof node === 'string') return node;
  const kids = (node.content || []).map((c) => adfToText(c, depth + 1));
  switch (node.type) {
    case 'text': return node.text || '';
    case 'hardBreak': return '\n';
    case 'paragraph': return kids.join('') + '\n';
    case 'heading': return '#'.repeat(node.attrs?.level || 2) + ' ' + kids.join('') + '\n';
    case 'bulletList': return (node.content || []).map((li) => '- ' + adfToText(li, depth + 1).trim()).join('\n') + '\n';
    case 'orderedList': return (node.content || []).map((li, i) => `${i + 1}. ` + adfToText(li, depth + 1).trim()).join('\n') + '\n';
    case 'taskList': return (node.content || []).map((t) => `- [${t.attrs?.state === 'DONE' ? 'x' : ' '}] ` + adfToText(t, depth + 1).trim()).join('\n') + '\n';
    case 'codeBlock': return '```' + (node.attrs?.language || '') + '\n' + kids.join('') + '\n```\n';
    case 'inlineCard': return node.attrs?.url || '';
    case 'mention': return node.attrs?.text || '@user';
    default: return kids.join('');
  }
}

export function textToAdf(markdown) {
  // Post as paragraphs + one code block so the brief survives round-trips in Jira.
  return {
    type: 'doc', version: 1,
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'Groundwork: agent handoff brief', marks: [{ type: 'strong' }] }] },
      { type: 'codeBlock', attrs: { language: 'markdown' }, content: [{ type: 'text', text: markdown }] },
    ],
  };
}
