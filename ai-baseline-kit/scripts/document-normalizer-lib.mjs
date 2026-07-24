import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { readJson } from './feature-tools-lib.mjs';

const TEXT_EXTENSIONS = new Set(['.txt', '.md', '.markdown', '.rst', '.csv', '.log', '.yaml', '.yml']);
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.tif', '.tiff']);
function sha256(buffer) { return crypto.createHash('sha256').update(buffer).digest('hex'); }
function question(id, field, text, reason) { return { id, field, question: text, reason, risk: 'L3', blocking: true }; }
function decodeXml(value) { return value.replace(/<w:tab\s*\/>/g, '\t').replace(/<w:br\s*\/>/g, '\n').replace(/<\/w:p>/g, '\n').replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code))); }
function stripHtml(value) { return value.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<\/(?:p|div|li|h[1-6]|tr)>/gi, '\n').replace(/<br\s*\/?\s*>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim(); }
function zipEntry(buffer, wanted) {
  let eocd = -1;
  for (let index = buffer.length - 22; index >= Math.max(0, buffer.length - 65557); index -= 1) if (buffer.readUInt32LE(index) === 0x06054b50) { eocd = index; break; }
  if (eocd < 0) throw new Error('DOCX ZIP 中央目录不存在。');
  const entries = buffer.readUInt16LE(eocd + 10); let offset = buffer.readUInt32LE(eocd + 16);
  for (let index = 0; index < entries; index += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error('DOCX ZIP 中央目录损坏。');
    const method = buffer.readUInt16LE(offset + 10); const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28); const extraLength = buffer.readUInt16LE(offset + 30); const commentLength = buffer.readUInt16LE(offset + 32); const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString('utf8');
    if (name === wanted) {
      if (buffer.readUInt32LE(localOffset) !== 0x04034b50) throw new Error('DOCX ZIP 本地文件头损坏。');
      const localNameLength = buffer.readUInt16LE(localOffset + 26); const localExtraLength = buffer.readUInt16LE(localOffset + 28);
      const start = localOffset + 30 + localNameLength + localExtraLength; const data = buffer.subarray(start, start + compressedSize);
      if (method === 0) return data; if (method === 8) return zlib.inflateRawSync(data); throw new Error(`DOCX 使用了不支持的压缩方法: ${method}`);
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  throw new Error(`DOCX 缺少 ${wanted}。`);
}
function extractDocx(buffer) { return decodeXml(zipEntry(buffer, 'word/document.xml').toString('utf8')).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim(); }
function decodePdfLiteral(value) { return value.replace(/\\([nrtbf()\\])/g, (_, char) => ({ n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', '(': '(', ')': ')', '\\': '\\' }[char])).replace(/\\([0-7]{1,3})/g, (_, octal) => String.fromCharCode(parseInt(octal, 8))); }
function decodePdfHex(value) { const buffer = Buffer.from(value.replace(/\s+/g, ''), 'hex'); if (buffer[0] === 0xfe && buffer[1] === 0xff) { let text = ''; for (let i = 2; i + 1 < buffer.length; i += 2) text += String.fromCharCode(buffer.readUInt16BE(i)); return text; } return buffer.toString('utf8'); }
function extractPdf(buffer) {
  const source = buffer.toString('latin1'); const chunks = [];
  const streamPattern = /([\s\S]{0,300})stream\r?\n([\s\S]*?)\r?\nendstream/g; let match;
  while ((match = streamPattern.exec(source))) {
    let content = Buffer.from(match[2], 'latin1');
    try { if (/\/FlateDecode/.test(match[1])) content = zlib.inflateSync(content); } catch { continue; }
    const text = content.toString('latin1');
    for (const item of text.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)) chunks.push(decodePdfLiteral(item[1]));
    for (const item of text.matchAll(/<([0-9A-Fa-f\s]+)>\s*Tj/g)) chunks.push(decodePdfHex(item[1]));
    for (const array of text.matchAll(/\[([\s\S]*?)\]\s*TJ/g)) {
      for (const item of array[1].matchAll(/\(((?:\\.|[^\\)])*)\)|<([0-9A-Fa-f\s]+)>/g)) chunks.push(item[1] !== undefined ? decodePdfLiteral(item[1]) : decodePdfHex(item[2]));
    }
  }
  return chunks.join(' ').replace(/\s+/g, ' ').trim();
}
function summarizeJson(value) {
  if (value?.openapi || value?.swagger) {
    const lines = [`# OpenAPI ${value.info?.title || 'API Document'}`];
    for (const [route, methods] of Object.entries(value.paths || {})) for (const [method, operation] of Object.entries(methods || {})) if (/^(get|post|put|patch|delete|options|head)$/i.test(method)) lines.push(`API ${method.toUpperCase()} ${route} ${operation.summary || operation.operationId || ''}`.trim());
    return { type: 'openapi', text: lines.join('\n'), structured: value };
  }
  if (value?.document || value?.type === 'DOCUMENT' || value?.name && value?.children) {
    const lines = ['# Figma Design Export']; const visit = (node, depth = 0) => { if (!node || depth > 12) return; if (node.name) lines.push(`${'  '.repeat(depth)}${node.type || 'NODE'}: ${node.name}`); if (typeof node.characters === 'string') lines.push(`${'  '.repeat(depth + 1)}TEXT: ${node.characters}`); for (const child of node.children || []) visit(child, depth + 1); }; visit(value.document || value);
    return { type: 'figma-json', text: lines.join('\n'), structured: value };
  }
  return { type: 'json', text: JSON.stringify(value, null, 2), structured: value };
}
function runAdapter(command, file) {
  if (!command) return null;
  const result = spawnSync(process.execPath, [path.resolve(command), file], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`文档提取适配器失败: ${result.stderr || result.stdout || result.error?.message}`);
  const output = result.stdout.trim(); if (!output) throw new Error('文档提取适配器未返回内容。');
  try { const parsed = JSON.parse(output); return { text: parsed.text || '', type: parsed.type || 'external-adapter', structured: parsed.structured }; } catch { return { text: output, type: 'external-adapter' }; }
}
export function normalizeDocumentInput({ input, text = '', extractor = process.env.AI_BASELINE_DOCUMENT_EXTRACTOR || '' }) {
  if (text || (input && !fs.existsSync(path.resolve(input)))) {
    const value = text || String(input || '');
    const figma = /https?:\/\/(?:www\.)?figma\.com\//i.test(value); const warnings = [];
    if (figma && extractor) {
      try { const extracted = runAdapter(extractor, value); const textValue = extracted?.text?.trim() || ''; if (textValue) return { schemaVersion: 1, kind: 'ai-baseline-normalized-document', status: 'ready', source: { type: extracted.type || 'figma-adapter', path: value, sha256: sha256(Buffer.from(value)) }, content: { text: textValue, structured: extracted.structured }, warnings, requiredQuestions: [] }; } catch (error) { warnings.push(error.message); }
    }
    return { schemaVersion: 1, kind: 'ai-baseline-normalized-document', status: figma ? 'needs-confirmation' : 'ready', source: { type: figma ? 'figma-url' : 'natural-language', path: figma ? value : '', sha256: sha256(Buffer.from(value)) }, content: { text: value }, warnings, requiredQuestions: figma ? [question('figma-extractor', 'document.extractor', '检测到 Figma 链接，请连接 Figma 读取器或提供导出的 Figma JSON/文字说明。', '不能在没有访问凭证时伪造设计内容。')] : [] };
  }
  const file = path.resolve(input || ''); if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) throw new Error('文档输入不存在或不是文件。');
  const buffer = fs.readFileSync(file); const extension = path.extname(file).toLowerCase(); let extracted; const warnings = [];
  try {
    if (TEXT_EXTENSIONS.has(extension)) extracted = { type: extension.slice(1) || 'text', text: buffer.toString('utf8') };
    else if (extension === '.html' || extension === '.htm') extracted = { type: 'html', text: stripHtml(buffer.toString('utf8')) };
    else if (extension === '.json') extracted = summarizeJson(readJson(file));
    else if (extension === '.docx') extracted = { type: 'docx', text: extractDocx(buffer) };
    else if (extension === '.pdf') extracted = { type: 'pdf', text: extractPdf(buffer) };
    else if (IMAGE_EXTENSIONS.has(extension)) extracted = runAdapter(extractor, file);
    else extracted = runAdapter(extractor, file);
  } catch (error) { warnings.push(error.message); extracted = runAdapter(extractor, file); }
  const textValue = extracted?.text?.trim() || ''; const questions = [];
  if (!textValue) questions.push(question('document-extraction', 'document.extractor', `无法可靠提取 ${path.basename(file)} 的文字内容，请配置文档/OCR 提取适配器或提供文本版本。`, '系统不会把空内容或乱码当作产品需求。'));
  return { schemaVersion: 1, kind: 'ai-baseline-normalized-document', status: questions.length ? 'needs-confirmation' : 'ready', source: { type: extracted?.type || (IMAGE_EXTENSIONS.has(extension) ? 'image' : extension.slice(1) || 'binary'), path: file, extension, size: buffer.length, sha256: sha256(buffer) }, content: { text: textValue, structured: extracted?.structured }, warnings, requiredQuestions: questions };
}
