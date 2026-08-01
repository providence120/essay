# 开发日志

> 项目：互动随笔网页（流动式展示 + 背景音乐 + 手写体 + 可分享）
> 日期：2026-08-01
> 目录：`interactive-essay/`

---

## 1. 需求还原

用户想做一个可以「直接分享到微信/抖音聊天」的互动随笔网页，核心体验：

1. 打开有**缓冲效果**（封面/加载感）；
2. 点击进入后**随笔流动展开**（滚动渐入）；
3. 搭配**背景音乐**增强沉浸感（王极《again》，歌词句：「也许说我爱你这感觉一定很假 / 我不是想要和你搁着屏幕说话」）；
4. 字体要**优美的手写体**；
5. **工程化可维护**：以后换背景音乐、换一篇随笔，只动配置，不改逻辑。

## 2. 调研（GitHub / 网络）

| 项目 | 启发点 |
|---|---|
| `zayennn/foryoumylove.github.io` | 数字情书全套：密码进入 + 情书 + 歌单 + 相册，粉色系 |
| `VanshikaDubey1/Digital-Love-Letter` | 漂浮爱心 + 背景音乐 |
| `cloudysky404/Interactive-Love-Letter-E-Card`、`javimelezzio/do-you-wanna-be-my-gf` | 信封展开动画 → 正文，开启交互解锁音乐 |
| `watermelontip/Handwrite`、`ShuShuHong/FreeFronts`、`chinayin/fonts-handwriting` | 手写体字体资源与许可参考 |

**结论**：这套「封面开启 → 解锁音乐 → 正文滚动展开」是成熟且被验证过的 H5 模式，中文手写体类的可参考落地项目稀少，但技术栈无门槛（原生 HTML/CSS/JS）。

**关键技术点确认**
- 浏览器禁止带声音自动播放 → 必须用「点击封面」这个用户手势解锁音频（iOS/微信同理）。
- 中文字体包体积大 → 采用「分字集 + unicode-range」懒加载（只下载随笔用到的字块），实测霞鹜文楷子集在 jsdelivr 可用，最终改为**本地打包**（国内网络更稳、不依赖 CDN）。
- 分享到微信依赖公网 HTTPS 链接 → 选用 GitHub Pages（免费）。

## 3. 技术选型

| 项 | 选择 | 理由 |
|---|---|---|
| 字体 | 霞鹜文楷 LXGW WenKai（OFL 开源可商用） | 楷体兼仿宋，娟秀清雅，最贴近随笔气质；官方 webfont 包支持分字集懒加载 |
| 背景音乐 | `<audio>` + 失败自动降级为 **Web Audio 合成垫底音** | 用户暂无 mp3，用合成音先保证"有 BGM"的完整体验；拿到 mp3 后换配置即可 |
| 歌词 | 真实音频用 `timeupdate` 同步高亮；试听模式按节奏轮播 | 两种模式共用一个歌词 UI |
| 动画 | CSS transition + IntersectionObserver | 原生、轻量、移动端顺滑 |
| 结构 | `config.js`（数据） + `app.js`（引擎） + `style.css`（样式） | 换正文/音乐只改 config，符合可维护性要求 |

## 4. 落地过程

1. **字体工程**：`npm pack lxgw-wenkai-webfont@1.7.0` → 取出 `regular` / `bold` 两套 css + 194 个分字集 woff2（共约 8.8MB，按需加载）→ 按 css 相对路径整理进 `assets/fonts/`。
2. **配置驱动**：`js/config.js` 暴露 `ESSAY_CONFIG`，覆盖封面文案、随笔正文、歌词插页、落款、音乐、歌词时间轴、主题色、粒子数。页面所有文字均由它渲染。
3. **引擎 `app.js`**：
   - `applyMeta()` / `renderEssay()` 根据配置拼装 DOM；
   - 封面点击 → `body.opened` 退场 + `Music.start()`（手势内解锁音频）；
   - `Music` 对象：优先真实 `<audio>`（4 秒超时或 error 即降级）；合成音用 A2–A3 温暖和弦 + 低频 LFO 做出"呼吸感"；
   - 歌词：真实音频 `timeupdate` 高亮；试听模式 2.6s 轮播；
   - 阅读进度条 + Canvas 漂浮光点（`prefers-reduced-motion` 时自动关闭）。
4. **样式 `style.css`**：深墨夜色渐变 + 暖金点缀 + 大行高居中窄栏（移动端优先），封面脉冲按钮、段落 blur+位移渐入、歌词插页卡片、落款右对齐。
5. **验证**：`node --check` 通过两段 JS；本地静态服务实测 `index.html / config.js / app.js / style.css / 字体css / woff2 子集` 全部 200。

**过程中的坑与修复**
- **编码事故（重要教训）**：曾用 PowerShell 的 `Get-Content`/`Set-Content -Encoding UTF8` 做正则替换，PowerShell 5.1 按系统 ANSI 码页读入 UTF-8 文件，导致 `js/app.js` 全部中文注释变成乱码（如 `·` → `路`）。修复：改用文件写入工具整体重写该文件。**教训：不要用 PowerShell 文本管道修改含中文的源文件。**
- **`play()` 兼容性**：`audio.play()` 在现代浏览器返回 Promise，但在部分内置浏览器（及 jsdom）返回 `undefined`，直接 `.catch` 会报错。抽了 `safePlay()` 统一处理。
- **合成音与真实音频叠加**：从"试听模式"切回真实 mp3 时，必须调用 `_stopSynth()` 渐隐并 `ctx.close()` 释放，否则两路声音叠加。
- **iOS AudioContext**：创建后若处于 `suspended`，需手动 `ctx.resume()` 才能出声。

## 4.5 内容导入（2026-08-01）

- **随笔导入**：解析 `2.docx`（`word/document.xml`），提取 12 段 / 751 字原创随笔（主题：随笔写作与记录、对"框架"的反思、时间的回旋镖）。
  按内容自然切分为 6 节写入 `js/config.js`（那节语文课 / 随笔写什么 / 困在框架里 / 换个角度 / 慢慢写下 / 尾声），标题暂定《慢慢写下一切》。
- **音乐导入**：`王极 - Again.mp3`（4.9MB，ID3 + MPEG 帧校验通过）→ 复制为 `assets/audio/again.mp3`，`music.src` 指向该文件。
- **歌词引擎增强**：真实音频若无 `time` 时间轴，自动降级为按节奏轮播显示（与"试听模式"共用逻辑），避免空白歌词。
- 冒烟测试升级为**配置驱动**：从 `config.js` 动态读取期望值断言（封面/按钮/徽标/段落数/小节数/插页/落款/标签闭合），换内容后无需改测试。

## 4.6 字体子集化 + 部署瘦身（2026-08-01）

- **背景**：用户部署到静态托管后发现"点开要登录"（其实是 Netlify 预览地址而非公开链接），决定换用 GitHub Pages；但 194 个分字集文件让网页上传很痛苦，且微信加载 9MB 字体太重。
- **方案**：从官方 Release 下载完整 TTF（Regular/Medium 各 ~24MB），用 `subset-font`（纯 WASM 子集化）按页面实际用字（config + index.html + app.js 兜底文案，共 603 字符）生成 2 个 woff2：
  - `essay-regular.woff2` 128KB（正文，weight 400）
  - `essay-medium.woff2` 128KB（标题，weight 600）
  - 字体总占用 **8.8MB → 261KB**。
- **可维护性**：提供 `scripts/build-fonts.js` 重建脚本，换文后重新跑一遍即可（依赖 `subset-font`，源 TTF 不入库，通过命令行参数指定）。
- 源 TTF 未入库（部署不携带 48MB 源字库），OFL 授权文件保留以符合开源协议。
- 校验：新 woff2 magic 为 `wOF2`；全部资源 200；配置驱动冒烟测试 8 项通过。

## 5. 遗留问题与已知限制

1. **音乐版权**：王极《again》为商业版权歌曲，已内置本地 mp3；公网分享需自行确认版权合规。
2. **抖音限制**：抖音私信/聊天内默认禁止打开外部链接，只能"浏览器打开后复制链接"再发送；微信内置浏览器体验最佳。
3. **歌词时间轴**：当前《again》歌词未填 `time`，走轮播模式；想精确跟唱可听歌后按 `mm:ss` 补时间轴。
4. **iOS 静音键**：受系统静音开关影响，`<audio>` 播放可能无声，这是平台限制，无法绕过（除非用 Web Audio）。
5. 本机未安装 git/ffmpeg，GitHub Pages 部署未实测，README 中已给出网页上传与命令行两种方式。

## 6. 下一步（可选项）

- [ ] 确认/更换随笔标题与作者署名（改 `js/config.js` 的 `meta`）
- [ ] 听歌后为歌词补 `time` 时间轴，实现精确同步
- [ ] 生成分享封面 `share-cover.png` 并更新 `og:image`
- [ ] 按需补充一个"章节目录/进度百分比"浮层
- [ ] 若需多篇随笔切换，可扩展为 `config` 数组 + URL 参数选篇
