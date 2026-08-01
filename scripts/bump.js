/*
 * ============================================================
 *  发布前自动更新资源版本号（防微信/浏览器缓存旧版）
 *  ----------------------------------------------------------
 *  原理：把 index.html 里 css/js 引用的 ?v=xxx 换成新的随机串，
 *        浏览器/微信看到新 URL 就会重新拉取，不再命中旧缓存。
 *  由 deploy.bat 在发布前自动调用，无需手动改。
 *  ============================================================
 */
'use strict';
const fs = require('fs');
const path = require('path');

const p = path.join(__dirname, '..', 'index.html');
let html = fs.readFileSync(p, 'utf8');
const ver = Date.now().toString(36);
const next = html.replace(/(\?v=)[A-Za-z0-9]+/g, '$1' + ver);
if (next === html) {
  console.warn('[bump] 未找到 ?v= 参数，index.html 需要先加上 ?v=1');
}
fs.writeFileSync(p, next);
console.log('[bump] cache version -> v=' + ver);
