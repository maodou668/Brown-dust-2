# 打包安卓 / iOS 原生 App（Capacitor）

本项目已接入 **Capacitor**，把这个网页游戏封装成「点开即全屏」的原生 App。
Web 代码不变，原生壳只是套在外面；每次改完游戏，重新 `sync` 一次即可。

> 已完成的准备：`package.json`、`capacitor.config.json`、`scripts/build-web.js`（组装 `www/`）、
> 以及游戏内 `Main.initNative()`（原生下自动隐藏状态栏 + 锁横屏）。

---

## 0. 一次性环境准备

```bash
# 在项目根目录
npm install            # 安装 Capacitor 依赖
npm run build:web      # 生成 www/（原生 App 的网页资源）
```

- **安卓**：装 [Android Studio](https://developer.android.com/studio)（自带 Android SDK / Gradle）。
- **iOS**：需要一台 **Mac** + [Xcode](https://developer.apple.com/xcode/)。Windows/Linux 无法编译 iOS。

---

## 1. 安卓（APK / AAB）

```bash
npm run add:android     # 首次：生成 android/ 原生工程
npm run android         # 组装 www → 同步 → 打开 Android Studio
```

在 Android Studio 里：
- **调试自测**：菜单 `Run ▸ Run 'app'`，连真机或模拟器，直接装上跑。
- **出测试包 APK**：`Build ▸ Build Bundle(s)/APK(s) ▸ Build APK(s)`，产物在
  `android/app/build/outputs/apk/`，可直接发给别人安装。
- **上架 Google Play**：`Build ▸ Generate Signed Bundle/APK ▸ Android App Bundle`，
  用你的签名密钥（keystore）生成 `.aab` 上传。

发布要求：
- Google Play 开发者账号，**一次性 $25**。
- 上传 `.aab`、填商店信息、隐私政策、内容分级，审核约 1–3 天。

> 想要真·沉浸式（连底部导航栏也隐藏），可在
> `android/app/src/main/java/.../MainActivity.java` 里启用 immersive sticky；需要的话我可以补。

---

## 2. iOS（需要 Mac）

```bash
npm run add:ios         # 首次：生成 ios/ 原生工程
npm run ios             # 组装 www → 同步 → 打开 Xcode
```

在 Xcode 里：
- **真机自测**：选你的 iPhone，点 ▶ 运行（免费 Apple ID 可装到自己手机，7 天有效）。
- **上架 App Store**：`Product ▸ Archive ▸ Distribute App`，上传到 App Store Connect。

发布要求：
- **Apple Developer Program，$99/年**（不交这个无法上架，也无法长期安装）。
- 在 App Store Connect 填信息、截图、隐私清单，审核约 1–3 天。

---

## 3. 日常迭代（改完游戏后）

```bash
npm run build:game   # 可选：更新单文件 game.html / 网页版
git add -A && git commit && git push   # 网页版（GitHub Pages）照常更新

# 原生 App 同步最新网页内容：
npm run sync         # = build:web + cap sync（把 www 拷进 android/ios 工程）
# 然后在 Android Studio / Xcode 里重新 Run 或出包
```

---

## 4. 账号 / 成本一览

| 平台 | 必备 | 成本 | 出包机器 |
|------|------|------|----------|
| 安卓 | Google Play 开发者账号 | 一次性 $25 | Windows/Mac/Linux 均可 |
| iOS  | Apple Developer Program | $99 / 年 | **必须 Mac** |

> 没有 Mac 时，iOS 可用云 Mac（MacStadium / macincloud）或 CI（如 Codemagic、GitHub Actions macOS runner）出包。

---

## 5. 当前进度

- [x] Capacitor 接入、配置、`www/` 组装脚本
- [x] 原生下自动全屏 + 锁横屏（`Main.initNative`）
- [x] 安卓工程可生成（`npx cap add android` 已验证通过）
- [ ] 在你的机器上装 Android Studio / Xcode 出包
- [ ] 注册开发者账号并上架

`android/`、`ios/`、`www/` 为生成产物，已在 `.gitignore` 中忽略，不进仓库。
