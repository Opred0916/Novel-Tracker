# Novel Tracker

记录网络小说的离线 iPhone App。当前可以添加小说、在书架查看、打开详情，并编辑书名、作者、阅读状态和主角名字。

## 本地开发

1. 安装 Node.js LTS、Git 和 iPhone 上的 Expo Go。
2. 让电脑和 iPhone 连接同一个 Wi-Fi。在项目目录执行 `npm.cmd ci`，然后运行 `npx.cmd expo start --lan`（Windows PowerShell 使用 `.cmd` 可避开脚本执行策略限制）。
3. 用 iPhone 扫描终端显示的二维码。如果二维码无法使用，可在 iPhone Safari 打开 `exp://电脑的局域网 IPv4 地址:8081`，再交给 Expo Go；使用 LAN 地址不需要先完成 Expo CLI 登录。
4. 点击“添加小说”，输入书名并保存。点击书架上的小说进入详情，再点“编辑资料”，可修改书名、作者、状态及主角名字。主角默认显示两个输入框，也可以点“＋ 添加主角”继续增加；空白名字不会保存。
5. 用 iPhone 验收时，先检查第一版已有小说仍在；编辑其中一本，添加三个主角并修改状态。退出并重新进入 Expo Go 项目，确认修改仍在、旧记录也没有丢失。

项目使用 Expo SDK 57，以配合 iPhone 上的 Expo Go 57。Windows 上可编写和运行开发服务器；iOS 实机操作由用户在自己的手机上完成。

若 LAN 二维码显示的不是电脑 Wi-Fi 地址，可在启动前设置 `$env:REACT_NATIVE_PACKAGER_HOSTNAME='电脑的局域网 IPv4 地址'`。只有需要 Expo 账号功能时才运行 `npx.cmd expo login --browser`；如果浏览器不能自动打开，可先设置 `$env:BROWSER='none'`，再手动打开终端新生成的登录链接。

## 数据提示

目前可以保存和修改小说基础资料，但二刷记录、备份与恢复尚未完成；在这之前不要用它保存唯一的一份重要阅读记录。清除或卸载 Expo Go 可能会删除其中尚未导出的项目数据。独立安装版将有自己的存储空间，未来须通过导出和导入迁移记录。

## 开发验证

`npm.cmd test -- --runInBand`、`npx.cmd tsc --noEmit`、`npx.cmd expo lint`、`npx.cmd expo-doctor`、`npx.cmd expo export --platform ios`。

详细需求和开发任务见 `docs/superpowers/`。
