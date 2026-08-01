# 流动随笔 · essays

一封会呼吸的互动随笔网页。打开封面 → 音乐响起 → 文字随滚动慢慢浮现。
适配微信内置浏览器，适合直接分享链接给朋友。

> 深墨夜色 + 暖金点缀 + **霞鹜文楷**（LXGW WenKai）手写质感。
> 内置背景音乐引擎：放一首 mp3 进去就是你的 BGM；不放，也会自动用"试听模式"合成一段轻柔的垫底音。

---

## 一、改随笔（最常用）

打开 `js/config.js`，改 `essay` 部分即可，纯文字，无需懂代码：

```js
essay: {
  hero: '致屏幕那边的你：',
  sections: [
    { heading: '一、那首歌', paragraphs: ['第一段……', '第二段……'] },
    { heading: '二、屏那边的光', paragraphs: ['……'] }
  ],
  lyricInterlude: ['也许说 我爱你这感觉一定很假', '我不是想要和你搁着屏幕说话'],
  sign: ['——', '写于某一天的深夜', '海风记得，我也记得']
}
```

- `heading`：小节标题，可留空 `''`。
- `paragraphs`：每段一行，段数不限，章节不限。
- `lyricInterlude`：正文中间的歌词语录卡（装饰段落）。
- `sign`：落款，逐行显示。
- `meta` 里的 `coverTitle / coverSubtitle / coverHint / author / date` 是封面与页头信息，一起改。

## 二、换背景音乐

当前已内置 `assets/audio/again.mp3`（王极《again》，4.9MB）。

1. 想换歌：把新 mp3 放进 `assets/audio/`（例如 `assets/audio/new.mp3`）。
2. 在 `js/config.js` → `music.src` 填上文件名。
3. 可选：给每句歌词配时间轴（秒），滚动到对应播放时刻歌词会自动高亮：

```js
lyrics: [
  { time: 0,   text: '……' },
  { time: 25,  text: '也许说 我爱你这感觉一定很假' },
  { time: 28,  text: '我不是想要和你搁着屏幕说话' }
]
```

> 歌词**可以不配 time**，页面会自动按节奏轮播显示（当前《again》即为此模式）；
> 填上 time 后即为精确歌词同步。
> 注意：版权歌曲请自行确认是否可以随页面公开分享。

## 三、换字体 / 换主题色

- 字体：霞鹜文楷（LXGW WenKai，OFL 开源可商用）已**按本篇随笔子集化**成 2 个小文件
  `assets/fonts/essay-regular.woff2`（正文）+ `essay-medium.woff2`（标题），共约 260KB。
- **改完随笔正文后，若新增了没出现过的字，需要重新生成子集**：
  1. 把官方完整 TTF（`LXGWWenKai-Regular.ttf`、`LXGWWenKai-Medium.ttf`）放入 `assets/fonts/_source/`
  2. 安装依赖并重建：`npm i subset-font && node scripts/build-fonts.js`
  3. 重建后删除 `_source` 即可（部署不需要源字库）
- 想换别的字体：替换 `essay-fonts.css` 里的 `@font-face` 源，再改 `js/config.js` → `theme.fontFamily`。
- 主题色 / 粒子数量：改 `js/config.js` → `theme` 里的 `accent / text / bgTop / particles` 等。
- 更多配色/间距在 `css/style.css` 顶部的 `:root` 变量里。

## 四、本地预览

```bash
cd interactive-essay
npx http-server -c-1 -p 8080
# 浏览器打开 http://localhost:8080
```

> 直接用浏览器双击打开 `index.html` 也可以看效果；但字体文件在部分场景下需要 HTTP 服务，建议用上面的命令。

## 五、部署到 GitHub Pages（分享用）

**方式 0：一键自动部署（推荐，无需懂 GitHub）**

1. 注册 GitHub：`github.com/signup`（邮箱 + 密码 + 验证邮件）。
2. 拿"钥匙"：登录后右上角头像 → `Settings` → 左下角 `Developer settings` → `Personal access tokens` → `Tokens (classic)` → `Generate new token (classic)`，勾选 `repo`，点生成并复制 `ghp_...`。
3. 在终端运行（或把 token 交给 AI 代跑）：

```bash
$env:GH_TOKEN = "ghp_你的token"
node scripts/deploy.js essay     # 最后一个参数是仓库名，可改成你喜欢的
```

4. 等 1~2 分钟，脚本会输出 `https://<你的用户名>.github.io/essay/`，发到微信即可。
5. 部署完成后可到 `Settings → Developer settings → Personal access tokens` 删掉 token。

**方式 A：GitHub 网页上传（无需命令行）**
1. 新建仓库 → `Add file → Upload files`，把 `interactive-essay/` 整个目录的内容传上去。
2. 仓库 `Settings → Pages → Source: Deploy from a branch → main / (root)` → Save。
3. 等 1~2 分钟，即可用 `https://<你的用户名>.github.io/<仓库名>/` 访问。

**方式 B：命令行**
```bash
git init
git add .
git commit -m "feat: 流动随笔 v1"
git remote add origin https://github.com/<你的用户名>/<仓库名>.git
git push -u origin main
# 再到 GitHub 仓库 Settings → Pages 开启即可
```

分享前把 `index.html` 里的 `og:title / og:description / og:image`（微信分享卡片）改成你的。

## 六、微信 / 抖音分享提示

- **微信**：直接发链接即可，好友在微信内打开体验最好（建议点开后再关掉弹层）。
- **抖音**：抖音私信/聊天内默认限制打开外部链接，可先在浏览器打开，再"复制链接"发给对方；对方用浏览器打开即可。

## 目录结构

```
interactive-essay/
├── index.html              # 入口（og 分享卡片信息也在这）
├── css/style.css           # 全部样式（配色变量在 :root）
├── js/config.js            # ★ 唯一要改的配置（正文/音乐/歌词/主题）
├── js/app.js               # 引擎：渲染/动画/音乐/歌词/进度
├── scripts/build-fonts.js  # 换文后重建字体的脚本（可选）
├── assets/fonts/           # 霞鹜文楷子集（2 个 woff2 + css + OFL 授权）
├── assets/audio/again.mp3  # 背景音乐（王极《again》）
└── docs/dev-log.md         # 开发日志
```

详细开发过程见 [docs/dev-log.md](docs/dev-log.md)。
