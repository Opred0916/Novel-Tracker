# Novel Tracker

记录网络小说的离线 iPhone App。当前完成最小可运行流程：添加一本想读的小说、保存到本地、返回书架查看。

## 本地开发

1. 安装 Node.js LTS、Git 和 iPhone 上的 Expo Go，注册免费的 Expo 账号。
2. 让电脑和 iPhone 连接同一个 Wi-Fi。在项目目录执行 `npm ci`，然后运行 `npx.cmd expo login --browser` 和 `npx.cmd expo start --lan`（Windows PowerShell 使用 `npx.cmd` 可避开脚本执行策略限制）。
3. 电脑上的 Expo CLI 与 iPhone Expo Go 登录同一个 Expo 账号；用 iPhone 扫描终端显示的二维码。
4. 点击“添加小说”，输入书名并保存；返回书架后关闭并重新打开项目，检查记录是否仍在。

项目使用 Expo SDK 57，以配合 iPhone 上的 Expo Go 57。Windows 上可编写和运行开发服务器；iOS 实机操作由用户在自己的手机上完成。

如果浏览器登录后回跳 `localhost` 失败，可在当前 PowerShell 先执行 `$env:BROWSER='none'` 和 `$env:NODE_OPTIONS='--dns-result-order=ipv4first'`，再运行 `npx.cmd expo login --browser`，手动打开终端新生成的链接。若 LAN 二维码显示的不是电脑 Wi-Fi 地址，可在启动前设置 `$env:REACT_NATIVE_PACKAGER_HOSTNAME='电脑的局域网 IPv4 地址'`。

## 数据提示

目前只有书名和想读状态的保存功能。备份与恢复尚未完成；在这之前不要用它保存唯一的一份重要阅读记录。清除或卸载 Expo Go 可能会删除其中尚未导出的项目数据。独立安装版将有自己的存储空间，未来须通过导出和导入迁移记录。

## 开发验证

`npm test -- --runInBand`、`npx tsc --noEmit`、`npx expo lint`、`npx expo export --platform ios`。

详细需求和开发任务见 `docs/superpowers/`。
