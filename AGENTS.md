# 项目交接文档（AI 必读）

> 供新的 AI 会话完全接手本项目。读完本文档即可继续开发，无需历史上下文。
> 项目：**互动随笔集网页**（单页 H5，封面→选择页→随笔正文+配乐+彩蛋）
> 目录：`C:\Users\Ws\Desktop\Learn\interactive-essay`

---

## 一、当前状态（速览）

- **随笔共 4 篇**：

| id | 标题 | 副标(listDesc/coverSubtitle) | 配乐 | 音频文件(96k) | 插图 |
|---|---|---|---|---|---|
| `shoubi` | 杂文随笔 | Do or die | 王极 again | again.mp3 1.36MB | photo-1.jpg（倒数第三段后） |
| `ye` | 夜 | Nightly Voyage | 是否 | shifou.mp3 2.54MB | 无 |
| `boycat` | 男孩和猫 | Healing Thrive | Peter Pan Was Right | peterpan.mp3 2.20MB | photo-2.jpg（"猫爱吃零食"与"猫最信任的是男孩"之间） |
| `qiuyi` | 又是一年秋 | Fall · Past | 兰亭序·氛围 | lantingxu.mp3 1.40MB | 无 |

- **双站点（内容相同，互为备份）**：
  - GitHub：`https://providence120.github.io/essay/`
  - Cloudflare：`https://essay-mirror.pages.dev/`
  - 直链：`?id=篇id`（如 `?id=qiuyi`）；不传 `?id=` 出选择页
- **微信注意**：pages.dev 曾被微信风控临时拦截（"所属平台被人恶意利用"），GitHub 链接在微信更稳。若再被拦，让用户试 GitHub 链接；长期方案是自定义域名（暂未做）。

## 二、目录结构

```
interactive-essay/
├── index.html              # 入口：结构 + 资源引用（css/js 带 ?v= 自动版本号）
├── AGENTS.md               # 本文档
├── css/style.css           # 全部样式（主题变量在 :root）
├── js/
│   ├── essays.js           # ★ 所有随笔配置（改文/换歌/插图/主题都在这里）
│   ├── app.js              # ★ 引擎：选择页/渲染/动画/音乐(Web Audio)/彩蛋/粒子
│   ├── egg3d.js            # 彩蛋 3D 亚克力相册（Three.js，移植自 gsap-acrylic-polaroid）
│   └── vendor/             # 本地打包：gsap.min.js、three.min.js（不走 CDN）
├── scripts/
│   ├── build-fonts.js      # 字体子集化重建（subset-font，需源 TTF）
│   ├── deploy.js           # 备用：走 api.github.com 发布（github.com 直连不通时）
│   └── bump.js             # 自动给 index.html 里 css/js 换 ?v= 随机版本号（防缓存）
├── deploy.bat              # 双击发布：跑 bump.js → git add/commit/push
├── assets/
│   ├── fonts/              # 霞鹜文楷子集：essay-regular.woff2 + essay-medium.woff2 + essay-fonts.css
│   ├── audio/              # 4 首音乐（96kbps/44.1kHz）
│   └── images/             # photo-1.jpg / photo-2.jpg / egg-photo.jpg（彩蛋图）
└── docs/dev-log.md         # 最终版开发日志（含维护记录）
```

## 三、核心机制（理解后即可开发）

### 1. 随笔配置驱动（`js/essays.js`）
每篇一个对象：`id / listTitle / listDesc / meta / essay / music / theme`。
- `essay.sections`：每节 `{ heading:'', paragraphs:[...], image:{src,alt,caption} }`，`image` 渲染在该节段落后。
- `music.lyrics`：歌词彩蛋（仅用户手动开关音乐后才轮播显示）。
- `theme`：每篇可独立配色（accent 等，经 CSS 变量注入）。
- 分享链接：`?id=篇id`。

### 2. 页面流程（`js/app.js`）
封面（轻触开启）→ 选择页（4 张卡片，自定义滚动条）→ 点卡进正文（配乐自动播）→ 左上角返回箭头可回选择页。
- 直链 `?id=xxx` 跳过选择页直接进正文。
- 彩蛋：封面 5 颗星从左到右**依次点第 2、2、4 颗**（内部序列 `[1,1,3]`）→ 进入 3D 亚克力相册页（`egg3d.js`），文案"相逢已是上上签"。

### 3. 音乐引擎（Web Audio，已改为不流式不卡顿）
- 页面加载即 `preloadAll()` 用 `fetch` 下载全部 4 首（微信拦不住 fetch）。
- 播放时 `decodeAudioData` 解码后用 `AudioBufferSourceNode` 从内存播放（loop），**不再流式、永不卡顿**。
- `Music.pool` 缓存 ArrayBuffer；只保留当前篇的解码缓冲（省内存）。
- 暂停/续播用 `realPaused` 判断（**注意：不要用 this.audio，那是旧的 `<audio>` 残留，已删除**）。
- 移动端自动播放：`start()` 必须在点击手势内同步调用（创建 AudioContext + resume）。
- 歌词彩蛋：`_updateIcon` 用 `srcNode && !realPaused` 判断播放态；歌词轮播仅 `userPlayed` 后开启。

### 4. 字体子集化（`scripts/build-fonts.js`）
霞鹜文楷按全站用字生成 2 个 woff2。**换过正文/文案后必须重跑**，否则新字显示为系统楷体。

### 5. 缓存策略
- index.html 里的 css/js/gsap/three 引用带 `?v=随机串`，由 `scripts/bump.js` 在每次发布时自动更换 → 微信/浏览器拉新。
- **音频的 `?v=` 在 essays.js 里手动维护**（当前 `?v=3`）：重编码/换歌后必须手动加 1，否则客户端一直用缓存旧文件。

---

## 四、新增一篇随笔（完整 SOP）

### 步骤 1：解析 docx
docx 是 zip，正文在 `word/document.xml`。用以下 Node 脚本解析为段落（每段一行 `[i] <style> 文本`），空行为段间分组：
```js
const fs = require('fs');
const xml = fs.readFileSync('提取出的document.xml', 'utf8');
const paras = [];
const re = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g; let m;
while ((m = re.exec(xml))) {
  const b = m[1];
  const sm = /<w:pStyle w:val="([^"]+)"/.exec(b); const style = sm ? sm[1] : '';
  let text = '';
  const tRe = /<w:t[^>]*>([\s\S]*?)<\/w:t>|<w:tab\/>|<w:br\/>|<w:cr\/>/g; let tm;
  while ((tm = tRe.exec(b))) {
    if (tm[0].indexOf('<w:t') === 0) text += tm[1];
    else if (tm[0] === '<w:tab/>') text += ' ';
    else text += '\n';
  }
  text = text.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&nbsp;/g,' ');
  paras.push({ style, text: text.trim() });
}
fs.writeFileSync('out.txt', paras.map((p,i)=>`[${i}] <${p.style||'body'}> ${p.text}`).join('\n'));
```
> 注意：段落按空行分组（一段空行=一个节）。**不要擅自给原文加标题/小标题**（用户强调过），`heading` 一律 `''`，段落原样保留。标题用配置里的 `listTitle`/`coverTitle`。

### 步骤 2：处理音乐（检测前奏 + 重编码 + 校验）
```bash
# 1) 复制到 assets/audio/，命名英文
# 2) 检测前奏静音（用 mpg123-decoder，见"常用工具"），有 3s+ 静音则用 ffmpeg 裁剪开头
# 3) 重编码 96kbps（统一规范，手机加载快）：
ffmpeg -y -i 输入.mp3 -b:a 96k -ar 44100 -ac 2 输出.mp3
# 4) 校验时长一致、无解码错误（mpg123-decoder）
# 5) essays.js 里 music.src 加 ?v=（当前最大+1）
```
- 无前奏静音的标准：首 0.5s RMS > 0.01 即可不裁。
- 若需裁前奏（帧级裁剪，无 ffmpeg 也可）：用 MPEG 帧解析跳过前 N 秒（320kbps/48000Hz 每帧 960B 等），见历史。

### 步骤 3：插入配置到 `js/essays.js`
用脚本在 `  /* ========== 第二篇示例` 注释前插入新对象（第一篇结尾是 `  },`）。结构模板：
```js
{
  id: '新id', listTitle: '标题', listDesc: '副标',
  meta: { pageTitle:'标题', coverTitle:'标题', coverEyebrow:'一篇随笔', coverSubtitle:'副标', coverHint:'轻触 开启', author:'佚名', date:'2026 · ?', tip:'', footerNote:'' },
  essay: { hero:'', sections:[ { heading:'', paragraphs:['…','…'], image:{src:'assets/images/xx.jpg', alt:'', caption:''} } ], lyricInterlude:[], sign:['——','…'] },
  music: { title:'歌名', artist:'', src:'assets/audio/xx.mp3?v=N', loop:true, volume:0.6, lyrics:[{text:'歌词彩蛋行1'},{text:'行2'}] },
  theme: { fontFamily:"'LXGW WenKai', 'Kaiti SC', 'STKaiti', 'KaiTi', serif", accent:'#e8c68a', accentSoft:'rgba(232,198,138,0.16)', text:'#e9e2d0', textDim:'#9b8f7d', bgTop:'#0d0e13', bgBottom:'#16171f', particles:110 }
}
```

### 步骤 4：插图（如需）
原图常 4-7MB，用 System.Drawing 压缩到**宽 1280 / quality 85**（约 40-200KB）存 `assets/images/`，在对应小节加 `image:{src, alt:'', caption:''}`。

### 步骤 5：重建字体子集（必做）
```bash
$env:NODE_PATH = "$env:TEMP\lxgw\subset\node_modules"
node scripts/build-fonts.js "$env:TEMP\lxgw\fontsrc"
```

### 步骤 6：测试（jsdom 冒烟）
确保 `node --check js/*.js` 通过；跑选择页/正文/彩蛋断言（见"常用工具"，脚本按需重建）。

### 步骤 7：部署（双端）
见"七、部署 SOP"。

---

## 五、音乐引擎排障要点（重要）

- **音柱不动 / 开关失效**：检查 `_updateIcon` 是否用了 `this.srcNode && !this.realPaused`；不要用 `this.audio`（已删除）。若"重复 toggle"存在，删旧留新。
- **暂停后不能续播**：`toggle` 用 `if (this.realPaused)` 判断续播，**不要**用 `else if (this.srcNode)`（暂停时 srcNode 为空）。
- **手机卡顿/不播**：用 Web Audio（fetch+decode），不要在移动端依赖 `<audio preload>`（微信不理会）。播放必须在点击手势内同步 start。
- **退出后还在播**：`reset()` 清 `fallbackTimer` + `srcNode.stop()`。

## 六、彩蛋（egg3d.js）排障要点

- 相册不显示：检查 **`scene.environment = buildEnvironment(renderer)` 必须在 `renderer` 创建之后**（曾在之前导致整页崩溃）。所有初始化已 try/catch。
- 背面发黑：`renderer.setClearColor(0x000000, 0)` 透明清屏已加。
- 背面要镜像：背板贴图**只模糊不预镜像**（`createBlurTexture`），配合背板 rotateY(180°) 呈现镜像。
- 粉色：已移除粉色轮廓光与环境光面（四边亚克力统一）。
- 三首彩蛋触发序列：`EGG_SEQ=[1,1,3]`（第 2、2、4 颗星）。

---

## 七、部署 SOP（双端）

### 通用前置
- 本项目在 `C:\Users\Ws\Desktop\Learn\interactive-essay`，已初始化 git，remote 指向 `https://github.com/providence120/essay.git`。
- **网络坑**：`github.com` 直连时而通时而断（GFW）。git 配置了 `http.proxy http://127.0.0.1:7897`（Clash 代理，用户时开时关）。
  - 推送策略：先试直连 `git -c http.proxy= push origin main`；失败则检查 7897 端口，开了就用默认配置 `git push origin main`（走代理）。
  - 若都失败：本地提交保留，稍后重试，或告知用户开代理。

### GitHub 端
```bash
node scripts/bump.js          # 自动更新 index.html 资源版本号
git add -A
git commit -m "feat/fix: 说明"
git -c http.proxy= push origin main    # 或走代理
```

### Cloudflare 镜像端
需先登录 wrangler（本机已登录，OAuth token 存于用户目录；若失效需重新 `npx wrangler login --browser=false` 设备授权）。
```bash
# 用临时目录拼纯站点文件（不含 scripts/docs/.git），然后：
npx wrangler pages deploy <临时目录> --project-name=essay-mirror
```
- **wrangler 偶发崩溃**（`Assertion failed: UV_HANDLE_CLOSING` 或上传中断）：重跑一次即可，已上传文件不会重复传。
- **边缘缓存**：部署后新 css/js/音频可能要等几十秒~几分钟才在边缘生效；验证时给 URL 加 `?v=时间戳` 或访问部署专属 URL（输出里有）。

### 验证
- `curl/fetch` 首页与关键资源返回 200；检查 essays.js 含新 id、音频大小正确。
- 手机微信测试需**刷新**（`···`→刷新）让新 `?v=` 生效。

---

## 八、常用工具与依赖（都在系统临时目录，**会被系统清理**，需重建）

路径 `%TEMP%\lxgw\`（即 `C:\Users\Ws\AppData\Local\Temp\lxgw\`），以下每次需要时重新安装：

```bash
npm install subset-font --prefix "$env:TEMP\lxgw\subset"          # 字体子集化
npm install mpg123-decoder --prefix "$env:TEMP\lxgw\dec"           # mp3 解码/时长/静音检测
npm install jsdom --prefix "$env:TEMP\lxgw\jsdom"                  # 冒烟测试
npm install @ffmpeg-installer/ffmpeg --prefix "$env:TEMP\lxgw\ffs" # 重编码（win32-x64 二进制）
# 字体源 TTF（重跑字体子集前需下载，约 24MB 各）：
Invoke-WebRequest -Uri "https://github.com/lxgw/LxgwWenKai/releases/download/v1.522/LXGWWenKai-Regular.ttf" -OutFile "$env:TEMP\lxgw\fontsrc\LXGWWenKai-Regular.ttf"
Invoke-WebRequest -Uri "https://github.com/lxgw/LxgwWenKai/releases/download/v1.522/LXGWWenKai-Medium.ttf" -OutFile "$env:TEMP\lxgw\fontsrc\LXGWWenKai-Medium.ttf"
```

- ffmpeg 路径：`$env:TEMP\lxgw\ffs\node_modules\@ffmpeg-installer\win32-x64\ffmpeg.exe`
- 冒烟测试：用 jsdom 加载 `index.html + js/essays.js + js/app.js`，断言选择页卡片数、点卡进正文、彩蛋序列 `[1,1,3]` 触发/可关、无 `jsdomError`。（历史脚本在 `%TEMP%\lxgw\smoke*.js`，可参考重建。）

---

## 九、用户习惯与约定（务必遵守）

1. **每次改动前先读本文件 + `docs/dev-log.md`**（用户明确要求）。
2. **改完一定更新 `docs/dev-log.md`**（维护记录）。
3. **不要自己造轮子**：先搜索 GitHub/网络找成熟方案借鉴。
4. **不擅自给随笔加标题/小标题**，原文原样保留；每篇 `heading:''`。
5. 用户说"回溯上一版" = 用 `git revert <最近一次改动commit>` 撤销，然后 bump + 部署双端。
6. **模型无法读图片**：用户发截图时，用 GLM-4V skill 读取：
   `node "C:\Users\Ws\.claude\skills\glm4v-vision\scripts\vision.mjs" <图片路径> --prompt "…"`
7. 用户可能在微信里遇到：音乐卡顿/不播、彩蛋相框不显示/黑边、微信拦域名等，见上面排障。
8. 中文输出；回复尽量简洁但把关键状态说清。

---

## 十、已知限制

- 音乐为商业版权歌曲，公网分享需自行确认合规。
- 抖音私信默认拦外链（先浏览器打开再复制链接）。
- iOS 静音键：Web Audio 不受影响，但 `<audio>` 曾有此问题。
- pages.dev 曾被微信风控临时拦截（备选 GitHub 链接；长期可上自定义域名）。
- github.com 直连不稳定，推送需代理或重试。
- 歌词未配时间轴（走轮播），可在 `lyrics` 加 `time` 秒精确同步。
