#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { spawn } from 'node:child_process';
import { access, readFile, writeFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { join } from 'node:path';

/**
 * 生成并写入 CHANGELOG.md 的脚本（复用 release.ts 的核心逻辑）。
 *
 * 设计目标：
 * 1) 不新增依赖，仅使用 Node.js 内置能力
 * 2) 以现有 git tag 为基线生成变更范围
 * 3) 输出内容可直接作为 GitHub Release body 使用
 */

const { values } = parseArgs({
  options: {
    version: { type: 'string' },
    date: { type: 'string' },
    'from-tag': { type: 'string' },
    'to-ref': { type: 'string' },
    changelog: { type: 'string' },
    'out-entry': { type: 'string' },
    'dry-run': { type: 'boolean' },
  },
});

const dryRun = values['dry-run'] === true;

await main();

async function main() {
  const repoRoot = process.cwd();
  await assertGitRepo(repoRoot);

  const pkgPath = join(repoRoot, 'package.json');
  const pkg = JSON.parse(await readFile(pkgPath, 'utf8'));

  // 版本号优先使用参数，其次读取 package.json。
  const version = asNonEmptyString(values.version) ?? pkg.version;
  if (!version || typeof version !== 'string') {
    throw new Error(`无法确定版本号，请传入 --version 或检查 ${pkgPath}`);
  }

  const date = asNonEmptyString(values.date) ?? formatDate(new Date());
  const changelogPath = asNonEmptyString(values.changelog)
    ? join(repoRoot, values.changelog)
    : join(repoRoot, 'CHANGELOG.md');

  const toRef = asNonEmptyString(values['to-ref']) ?? 'HEAD';
  const fromTag = asNonEmptyString(values['from-tag']) ?? (await getLatestGitTag(repoRoot));
  const range = fromTag ? `${fromTag}..${toRef}` : toRef;

  const commits = await getCommits(repoRoot, range);
  const sections = groupCommits(commits);
  const entry = renderChangelogEntry({ version, date, sections });

  // 始终打印生成结果，方便在 CI 中直接重定向或调试。
  process.stdout.write(`${entry.trimEnd()}\n`);

  const outEntryPath = asNonEmptyString(values['out-entry']);
  if (outEntryPath) {
    if (!dryRun) {
      await writeFile(outEntryPath, `${entry.trimEnd()}\n`, 'utf8');
    }
  }

  if (dryRun) {
    return;
  }

  await upsertChangelog(changelogPath, entry);
}

function asNonEmptyString(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

async function assertGitRepo(cwd) {
  try {
    await runCapture(cwd, 'git', ['rev-parse', '--is-inside-work-tree']);
  } catch {
    throw new Error('当前目录不是 git 仓库，无法生成变更日志。');
  }
}

async function getLatestGitTag(cwd) {
  try {
    const result = await runCapture(cwd, 'git', [
      'describe',
      '--tags',
      '--abbrev=0',
    ]);
    const tag = result.stdout.trim();
    return tag || null;
  } catch {
    return null;
  }
}

async function getCommits(cwd, range) {
  const format = '%H%x09%s%x09%an';
  const result = await runCapture(cwd, 'git', [
    'log',
    range,
    '--no-merges',
    `--pretty=format:${format}`,
  ]);
  const lines = result.stdout.split(/\r?\n/).filter(Boolean);
  const commits = [];
  for (const line of lines) {
    const [hash, subject, author] = line.split('\t');
    if (!hash || !subject || !author) continue;
    commits.push({
      hash,
      shortHash: hash.slice(0, 7),
      subject,
      author,
    });
  }
  return commits;
}

function groupCommits(commits) {
  const buckets = {};

  const pushTo = (title, commit) => {
    const list = buckets[title] ?? [];
    list.push(commit);
    buckets[title] = list;
  };

  for (const commit of commits) {
    const parsed = parseConventionalSubject(commit.subject);
    if (parsed?.breaking) {
      pushTo('Breaking Changes', commit);
      continue;
    }
    const type = parsed?.type ?? null;
    if (type === 'feat') pushTo('Features', commit);
    else if (type === 'fix') pushTo('Fixes', commit);
    else if (type === 'docs') pushTo('Docs', commit);
    else if (type === 'refactor') pushTo('Refactors', commit);
    else if (type === 'perf') pushTo('Performance', commit);
    else if (type === 'test') pushTo('Tests', commit);
    else if (type === 'build' || type === 'ci') pushTo('Build/CI', commit);
    else if (type === 'chore' || type === 'style') pushTo('Chores', commit);
    else pushTo('Other', commit);
  }

  const order = [
    'Breaking Changes',
    'Features',
    'Fixes',
    'Performance',
    'Refactors',
    'Docs',
    'Build/CI',
    'Tests',
    'Chores',
    'Other',
  ];

  const sections = [];
  for (const title of order) {
    const list = buckets[title];
    if (list && list.length > 0) {
      sections.push({ title, commits: list });
    }
  }
  if (sections.length === 0) {
    sections.push({ title: 'Other', commits: [] });
  }
  return sections;
}

function parseConventionalSubject(subject) {
  const match = /^(\w+)(?:\(([^)]+)\))?(!)?:\s*(.+)$/.exec(subject);
  if (!match) return null;
  const type = match[1].toLowerCase();
  const scope = match[2] ? match[2].trim() : undefined;
  const breaking = match[3] === '!';
  const description = match[4] ?? '';
  return { type, scope, breaking, description };
}

function formatCommitTitle(commit) {
  const parsed = parseConventionalSubject(commit.subject);
  if (!parsed) return commit.subject;
  const scopePrefix = parsed.scope ? `${parsed.scope}: ` : '';
  return `${scopePrefix}${parsed.description}`;
}

function renderChangelogEntry({ version, date, sections }) {
  const lines = [];
  lines.push(`## v${version} - ${date}`, '');
  const hasCommits = sections.some((s) => s.commits.length > 0);
  if (!hasCommits) {
    lines.push('- No changes recorded.', '');
    return lines.join('\n');
  }
  for (const section of sections) {
    if (section.commits.length === 0) continue;
    lines.push(`### ${section.title}`);
    for (const commit of section.commits) {
      lines.push(`- ${formatCommitTitle(commit)} (${commit.shortHash}, ${commit.author})`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

async function fileExists(path) {
  try {
    await access(path, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function upsertChangelog(changelogPath, entry) {
  const header = '# Changelog';
  const exists = await fileExists(changelogPath);
  if (!exists) {
    await writeFile(changelogPath, `${header}\n\n${entry.trimEnd()}\n`, 'utf8');
    return;
  }

  const existing = await readFile(changelogPath, 'utf8');
  const normalized = existing.replace(/\r\n/g, '\n');

  const headerMatch = /^#\s*Changelog\s*\n(\n)*/.exec(normalized);
  if (!headerMatch) {
    const merged = `${header}\n\n${entry.trimEnd()}\n\n${normalized.trimStart()}`;
    await writeFile(
      changelogPath,
      `${merged.replace(/\n{3,}/g, '\n\n')}\n`,
      'utf8',
    );
    return;
  }

  const insertAt = headerMatch[0].length;
  const merged = `${normalized.slice(0, insertAt)}${entry.trimEnd()}\n\n${normalized
    .slice(insertAt)
    .trimStart()}`;
  await writeFile(
    changelogPath,
    `${merged.replace(/\n{3,}/g, '\n\n')}\n`,
    'utf8',
  );
}

async function runCapture(cwd, command, args) {
  const result = await runCaptureWithCode(cwd, command, args);
  if (result.code === 0) {
    return { stdout: result.stdout, stderr: result.stderr };
  }
  throw new Error(result.stderr || result.stdout || `命令失败：${command}`);
}

async function runCaptureWithCode(cwd, command, args) {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (d) => {
      stdout += String(d);
    });
    child.stderr.on('data', (d) => {
      stderr += String(d);
    });

    child.on('error', reject);
    child.on('close', (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

