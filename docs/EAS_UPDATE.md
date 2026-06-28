# EAS Update 与构建通道

本文记录本项目的 EAS Build / EAS Update 配置、通道规则、常用命令和验证方法。

## 当前配置

- EAS project update URL: `https://u.expo.dev/eb17ed95-0774-4a83-86ba-956550810f0b`
- Runtime version policy: `appVersion`
- 当前 app version / runtimeVersion: `0.1.2`
- 自动检查策略: `checkAutomatically: "ON_LOAD"`
- 启动回退策略: `fallbackToCacheTimeout: 0`

`eas.json` 中两个主要 profile:

- `preview`: Android 内部分发包，写入 `preview` channel。
- `production`: 正式发布包，写入 `production` channel。

App 会在构建时把 channel 写进原生包。也就是说：

- 用 `preview` profile 打出来的包，只检查 `preview` channel。
- 用 `production` profile 打出来的包，只检查 `production` channel。
- App 运行时通常不切换 channel；不同环境靠不同安装包隔离。

一次 OTA 更新能被当前安装包检查到，需要同时满足：

- 同一个 EAS project / `updates.url`
- 同一个平台，例如 Android 对 Android
- 同一个 channel，例如 `preview` 对 `preview`
- 同一个 runtimeVersion，本项目目前由 `app.json` 的 `expo.version` 决定

OTA 只适合 JS 与资源文件更新。只要改到了原生能力、原生依赖、Expo 配置中会影响 native project 的字段，或升级了需要 native rebuild 的包，就必须重新打安装包。

## 初始化记录

Preview channel 已初始化：

- Update group ID: `8063ff51-898c-4c09-8779-28574cfb9c5e`
- Dashboard: https://expo.dev/accounts/lemoncola/projects/yamibo-m/updates/8063ff51-898c-4c09-8779-28574cfb9c5e
- 关联分支: `preview`

Production channel 已初始化：

- Update group ID: `1b50270b-e18e-4f44-94ab-ce12d1906ea7`
- Dashboard: https://expo.dev/accounts/lemoncola/projects/yamibo-m/updates/1b50270b-e18e-4f44-94ab-ce12d1906ea7
- 关联分支: `production`

最近一次 preview Android 构建：

- Build ID: `21f63402-47b8-4b12-a80d-bf87c999c524`
- Build page: https://expo.dev/accounts/lemoncola/projects/yamibo-m/builds/21f63402-47b8-4b12-a80d-bf87c999c524
- APK artifact: https://expo.dev/artifacts/eas/N_J_JEtvuMZGa2d5TpOgmCfJgwxDzeoXQ2L2TEE7lkw.apk
- Channel: `preview`
- Runtime version: `0.1.2`

## 常用命令

本地基础验证：

```bash
npx expo-doctor
npm run typecheck
npm test -- --runInBand
```

构建 preview 包：

```bash
npx --yes eas-cli@latest build --profile preview --platform android
```

构建 production 包：

```bash
npx --yes eas-cli@latest build --profile production --platform android
```

发布 preview OTA：

```bash
npx --yes eas-cli@latest update --channel preview --environment preview --message "Describe the update"
```

发布 production OTA：

```bash
npx --yes eas-cli@latest update --channel production --environment production --message "Describe the update"
```

查看 channel：

```bash
npx --yes eas-cli@latest channel:list
```

查看 Android 构建：

```bash
npx --yes eas-cli@latest build:list --platform android
```

## 验证流程

### 验证安装包

1. 先跑 `npx expo-doctor`、`npm run typecheck`、`npm test -- --runInBand`。
2. 用目标 profile 打包，例如 preview 用 `--profile preview`。
3. 安装 APK 后打开“关于”页，确认版本号、检查更新入口能正常显示。
4. 点击“检查更新”。

如果这个安装包是在 channel 初始化 OTA 之前打出来的，首次检查可能会提示发现更新；下载并重启后，再检查才会显示已经是最新版本。这是正常现象，因为初始化 channel 时发布的 OTA 对旧包来说也是一个可用更新。

如果希望刚安装后立即显示“已是最新版本”，需要先初始化对应 channel，再重新打一个安装包。

### 验证 OTA

1. 在不改原生依赖和 native 配置的前提下，改一处可见 JS 文案或界面。
2. 对安装包所属 channel 发布 OTA。
3. 在已安装的包里点击“检查更新”。
4. 期望看到“发现新版本”，下载后重启。
5. 重启后确认新文案或界面生效，再次检查应显示“已是最新版本”。

## 常见提示

### 暂不支持在线更新

通常表示当前环境没有可用的 EAS Update 能力，例如：

- 正在 Expo Go、dev client 或 web/dev 环境中运行。
- 原生包里没有写入有效的 `updates.url`。
- 原生包没有写入 channel，或当前 runtime 不支持 OTA。

需要用 EAS Build 打出的 preview / production 包验证。

### 检查更新失败

常见原因：

- 网络或 EAS Update 服务请求失败。
- 当前 channel 没有初始化，或没有关联到分支。
- 发布的 OTA 与当前包的 platform / channel / runtimeVersion 不匹配。

排查时先用 `channel:list` 确认 channel 绑定，再检查发布 OTA 时使用的 `--channel` 和安装包 profile 是否一致。

### Doctor schema 报 `newArchEnabled`

Expo SDK 56 的当前配置 schema 不接受顶层 `newArchEnabled` 字段。本项目已移除该字段；不要再加回 `app.json` 顶层。

### Doctor 依赖版本不匹配

如果 `expo-doctor` 提示 Expo SDK 依赖 patch 版本不匹配，优先使用：

```bash
npx expo install --check
```

再按提示升级到 SDK 要求的版本。本项目曾修正过：

- `expo` -> `~56.0.12`
- `@expo/metro-runtime` -> `~56.0.15`
- `expo-updates` -> `~56.0.19`

## 运行时切换 channel

Expo Updates 有运行时覆盖请求头的能力，例如覆盖 `expo-channel-name`，可用于内部测试特殊场景。但这不建议作为普通用户功能：

- 容易让用户下载到不属于当前安装包环境的更新。
- 发布、回滚和排查会更复杂。
- 仍然受 runtimeVersion 等匹配规则约束。

项目默认策略是：preview 包只走 preview channel，production 包只走 production channel。
