/*
 * ============================================================
 *  一键部署到 GitHub Pages（无需 git / 无需理解 GitHub）
 *  ----------------------------------------------------------
 *  前提：
 *   1. 已注册 GitHub 账号
 *   2. 已创建 Personal Access Token（见 README「部署」一节）
 *  用法：
 *     $env:GH_TOKEN = "你的token"
 *     node scripts/deploy.js [仓库名]      # 不填默认 essay
 *  ============================================================
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TOKEN = process.env.GH_TOKEN;
const REPO = process.argv[2] || 'essay';

if (!TOKEN) {
  console.error('[deploy] 缺少 GH_TOKEN 环境变量。');
  console.error('[deploy] 示例：$env:GH_TOKEN = "ghp_xxxx"  然后  node scripts/deploy.js');
  process.exit(1);
}

const API = 'https://api.github.com';

async function req(method, url, body, token) {
  const res = await fetch(API + url, {
    method,
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
      'User-Agent': 'essay-deploy'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch (e) {}
  if (!res.ok) {
    const msg = (data && data.message) || text;
    throw new Error(method + ' ' + url + ' -> ' + res.status + ' ' + msg);
  }
  return data;
}

async function main() {
  console.log('[deploy] 1/4 创建仓库 …');
  let repo;
  try {
    repo = await req('POST', '/user/repos', {
      name: REPO,
      private: false,
      description: '流动随笔 · 一篇写给自己的文章',
      auto_init: false
    }, TOKEN);
  } catch (e) {
    if (/already exists/i.test(e.message)) {
      repo = await req('GET', '/repos/' + process.env.GITHUB_USER + '/' + REPO, null, TOKEN);
      console.log('[deploy] 仓库已存在，继续上传…');
    } else {
      throw e;
    }
  }

  const owner = repo.owner.login;
  const branch = repo.default_branch || 'main';
  const full = owner + '/' + REPO;

  /* 收集要上传的文件（排除脚本/文档目录与 _source） */
  const skipDirs = new Set(['scripts', 'docs', 'node_modules']);
  const skipFiles = new Set(['deploy.js', 'README.md', 'dev-log.md']);
  const files = [];
  (function walk(dir, prefix) {
    for (const name of fs.readdirSync(dir)) {
      if (skipDirs.has(name)) continue;
      const p = path.join(dir, name);
      if (fs.statSync(p).isDirectory()) walk(p, prefix + name + '/');
      else files.push({ rel: prefix + name, abs: p });
    }
  })(ROOT, '');

  /* 跳过本地开发用文件 */
  const keep = files.filter(f => !skipFiles.has(f.rel) && !f.rel.startsWith('assets/fonts/_source'));

  console.log('[deploy] 2/4 上传 ' + keep.length + ' 个文件到 ' + full + ' …');
  for (let i = 0; i < keep.length; i++) {
    const f = keep[i];
    const content = fs.readFileSync(f.abs).toString('base64');
    await req('PUT', '/repos/' + full + '/contents/' + f.rel, {
      message: 'deploy ' + f.rel,
      content
    }, TOKEN);
    console.log('  ✔ ' + f.rel + ' (' + Math.round(fs.statSync(f.abs).size / 1024) + 'KB)');
  }

  console.log('[deploy] 3/4 开启 GitHub Pages …');
  try {
    await req('POST', '/repos/' + full + '/pages', {
      source: { branch, path: '/' }
    }, TOKEN);
  } catch (e) {
    if (/already been enabled/.test(e.message)) {
      console.log('[deploy] Pages 已开启');
    } else {
      throw e;
    }
  }

  const url = 'https://' + owner + '.github.io/' + REPO + '/';
  console.log('[deploy] 4/4 完成！');
  console.log('');
  console.log('  ┌──────────────────────────────────────────────┐');
  console.log('  │  分享地址（等 1~2 分钟生效）：                │');
  console.log('  │  ' + url);
  console.log('  └──────────────────────────────────────────────┘');
  console.log('');
  console.log('[deploy] 提示：部署完成后可删除 token（Settings → Developer settings → Personal access tokens）。');
}

main().catch(e => {
  console.error('[deploy] 失败：', e.message);
  process.exit(1);
});
