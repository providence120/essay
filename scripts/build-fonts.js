/*
 * ============================================================
 *  字体子集化构建脚本
 *  ----------------------------------------------------------
 *  作用：从霞鹜文楷完整 TTF 中，只保留当前页面实际会出现的
 *        汉字/符号，生成 2 个小 woff2（正文 + 标题），
 *        并把 194 个分字集文件替换成这 2 个文件。
 *
 *  用法：换过随笔正文/歌词后，重新运行：
 *      node scripts/build-fonts.js
 *  需要：npm 全局或本地安装 subset-font；完整 TTF 放在
 *      assets/fonts/_source/ 下（可从官方 Release 下载）。
 *  ============================================================
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'assets', 'fonts');
/* 源字体目录：默认 assets/fonts/_source，可通过命令行参数指定（部署时不必携带源字库） */
const SRC_DIR = process.argv[2] || path.join(ROOT, 'assets', 'fonts', '_source');
const SUBSET_FONT = 'subset-font';

async function main() {
  let subsetFont;
  try {
    subsetFont = require(SUBSET_FONT);
  } catch (e) {
    console.error('[build-fonts] 请先安装 subset-font： npm i -D subset-font');
    process.exit(1);
  }

  /* 1. 收集页面会渲染的所有文本（来源：config + index.html + app.js 兜底文案） */
  const configSrc = fs.readFileSync(path.join(ROOT, 'js', 'config.js'), 'utf8');
  const indexSrc = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const appSrc = fs.readFileSync(path.join(ROOT, 'js', 'app.js'), 'utf8');
  const sources = configSrc + '\n' + indexSrc + '\n' + appSrc;

  /* 2. 提取唯一字符 + 基础安全集（数字、字母、常见中英标点） */
  const safety =
    '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ' +
    '，。！？；：“”‘’（）《》〈〉—…·、％￥`~!@#$%^&*()_+-=[]{};:,.<>?/\\|"\'' +
    '　 ♪♫♬ ·…—「」『』';

  const chars = new Set(safety.split(''));
  for (const ch of sources) {
    if (ch === '\n' || ch === '\r' || ch === '\t') continue;
    chars.add(ch);
  }
  const text = [...chars].join('');
  console.log('[build-fonts] 字符数：', chars.size);

  /* 3. 生成 woff2 */
  const tasks = [
    { src: 'LXGWWenKai-Regular.ttf', out: 'essay-regular.woff2', weight: 400 },
    { src: 'LXGWWenKai-Medium.ttf',  out: 'essay-medium.woff2',  weight: 600 }
  ];

  const fontCss = tasks.map(t => {
    return [
      '@font-face {',
      "  font-family: 'LXGW WenKai';",
      '  font-style: normal;',
      '  font-weight: ' + t.weight + ';',
      '  font-display: swap;',
      "  src: url('" + t.out + "') format('woff2');",
      '}'
    ].join('\n');
  }).join('\n\n');

  for (const t of tasks) {
    const srcFile = path.join(SRC_DIR, t.src);
    if (!fs.existsSync(srcFile)) {
      console.error('[build-fonts] 缺少源字体：', srcFile);
      process.exit(1);
    }
    const fontBuffer = fs.readFileSync(srcFile);
    const outBuf = Buffer.from(await subsetFont(fontBuffer, text, {
      targetFormat: 'woff2'
    }));
    fs.writeFileSync(path.join(OUT_DIR, t.out), outBuf);
    console.log('[build-fonts] 生成', t.out, Math.round(outBuf.length / 1024) + 'KB');
  }

  fs.writeFileSync(path.join(OUT_DIR, 'essay-fonts.css'), fontCss + '\n');
  console.log('[build-fonts] 生成 essay-fonts.css（' + tasks.length + ' 个字重）');
  console.log('[build-fonts] 完成。可将 assets/fonts/_source 与 scripts 删除以减小体积（保留本脚本以便日后重建）。');
}

main().catch(err => {
  console.error('[build-fonts] 失败：', err);
  process.exit(1);
});
