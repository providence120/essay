# assets/audio

把背景音乐 mp3 放进来，然后到 `js/config.js` → `music.src` 填写文件名即可，例如：

```
assets/audio/again.mp3
```

```js
music: {
  title: 'again',
  artist: '王极',
  src: 'assets/audio/again.mp3',   // ← 改成你的文件名
  lyrics: [                        // ← 可选：按秒填歌词时间轴
    { time: 25, text: '也许说 我爱你这感觉一定很假' },
    { time: 28, text: '我不是想要和你搁着屏幕说话' }
  ]
}
```

> 注意：版权歌曲请自行确认是否可以随页面公开分享。
> 目录里没有 mp3 时，页面会自动进入"试听模式"（内置合成垫底音 + 歌词轮播），不影响演示。
