#!/usr/bin/env node
import path from 'node:path';
import { normalizeDocumentInput } from './document-normalizer-lib.mjs';
import { parseArgs, resolveRoots } from './project-tools-lib.mjs';
import { writeJson } from './feature-tools-lib.mjs';
const args = parseArgs(process.argv.slice(2)); const { projectRoot } = resolveRoots(import.meta.url);
try {
  const input = args.input || args.file || args.document || args._.join(' '); if (!input && !args.text) throw new Error('请通过 --input <文档> 或 --text <自然语言> 提供需求。');
  const result = normalizeDocumentInput({ input, text: args.text || '', extractor: args.extractor || '' });
  const output = path.resolve(args.output || path.join(projectRoot, 'docs', 'normalized-requirement.json')); writeJson(output, result);
  console.log(`document-normalize: ${result.status === 'ready' ? 'pass' : 'needs-confirmation'}`); console.log(`output: ${output}`); for (const item of result.requiredQuestions) console.log(`question: ${item.question}`); if (args.json) console.log(JSON.stringify(result, null, 2)); if (result.status !== 'ready') process.exit(2);
} catch (error) { console.error(`document-normalize: fail: ${error.message}`); process.exit(1); }
