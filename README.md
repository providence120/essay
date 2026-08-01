# 流动随笔 · essays

一封会呼吸的互动随笔网页。打开封面 → 音乐响起 → 文字随滚动慢慢浮现。
适配微信内置浏览器，适合直接分享链接给朋友。

> 深墨夜色 + 暖金点缀 + **霞鹜文楷**（LXGW WenKai）手写质感。
> 内置背景音乐引擎：放一首 mp3 进去就是你的 BGM；不放，也会自动用"试听模式"合成一段轻柔的垫底音。

---

## 一、改随笔 / 新增随笔（最常用）

**所有文章都在 `js/essays.js` 里**，每篇是一个 `{ ... }` 对象。改文字、加段落都在这里，纯文本，无需懂代码：

```js
{
  id: 'shoubi',                 // ← 分享链接用：网址?id=shoubi
  listTitle: '慢慢写下一切',     // ← 目录页显示名
  listDesc: '一篇关于记录与热爱的随笔',
  meta: { coverTitle: '...', coverSubtitle: '...', coverHint: '轻触 开启', date: '2026 · 夏', ... },
  essay: {
    hero: '致屏幕那边的你：',
    sections: [
      { heading: '一、那节语文课', paragraphs: ['第一段……', '第二段……'] }
    ],
    lyricInterlude: ['也许说 我爱你这感觉一定很假', '我不是想要和你搁着屏幕说话'],
    sign: ['——', '写于某一天的深夜']
  },
  music: { title: 'again', artist: '王极', src: 'assets/audio/again.mp3', lyrics: [...] },
  theme: { accent: '#e8c68a', ... }   // 每篇可独立配色
}
```

- **新增一篇**：复制上面整个 `{...}` 块，换一个 `id`、改内容，放到 `window.ESSAYS` 数组里（注意块与块之间用英文逗号隔开）。
- **每篇独立链接**：`网址?id=你的id`（如 `.../?id=shoubi`），互不覆盖，旧文章永远可访问。
- **目录页**：访问 `网址`（不带 `?id=`）——只有一篇时自动打开；多篇时显示文章列表。
- **每篇可换歌**：`music` 里的 `src` 指向各自的 mp3 文件（放进 `assets/audio/`）。
- **换文后若出现新字**，记得重新生成字体子集（见"三、换字体"）。

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

**方式 0：双击一键发布（已配置好，最省事）**

已经完成 git 初始化并关联远程仓库，以后更新内容只需：

1. 确保本机代理已开启（当前 git 走 `127.0.0.1:7897`，改代理端口需在项目里执行 `git config http.proxy http://127.0.0.1:新端口`）。
2. **双击 `deploy.bat`** → 自动 `git add / commit / push` → 等 1~2 分钟生效。

> 安全性提示：推送用的 token 保存在本地 `interactive-essay/.git/config` 里（明文）。建议：
> - 每次发布完，到 GitHub `Settings → Developer settings → Personal access tokens` 删除该 token；
> - 下次要发布时重新生成一个再更新 `git remote set-url origin https://新token@github.com/你的用户名/essay.git`。
> 删除 token 前远程 URL 里的旧 token 也会失效，所以更新前先换掉 URL。

**方式 1：网页上传（备用）**


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
├── js/essays.js            # ★ 所有随笔配置（新增/修改都在这）
├── js/app.js               # 引擎：选文/渲染/动画/音乐/歌词/进度
├── deploy.bat              # ★ 双击即发布到 GitHub Pages
├── scripts/build-fonts.js  # 换文后重建字体的脚本（可选）
├── scripts/deploy.js       # 备用：github.com 直连不通时用 API 发布
├── assets/fonts/           # 霞鹜文楷子集（2 个 woff2 + css + OFL 授权）
├── assets/audio/           # 每篇随笔的背景音乐 mp3 都放这里
└── docs/dev-log.md         # 开发日志
```

详细开发过程见 [docs/dev-log.md](docs/dev-log.md)。
