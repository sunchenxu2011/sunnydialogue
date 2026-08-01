# 🌅 Sunny Dialogue

> *"想探求你暗恋的那个她的一些心理想法，但又不敢直接表达？来试试该项目吧，通过构建简易、安全、私密的一次问卷，了解你心上之人的情感态度~"*  
> 本项目是一个专为**那一抹未竟的晨光**设计的互动对话与心理探访系统，基于 **Cloudflare Workers** 与 **KV 存储** 构建，提供极致轻量的无服务器架构部署。

---

## 🌟 特点

- **🌸 专属轻量设计**：优雅温暖的 UI 风格，专为单人/特定对象的暗恋对话与互动问卷打造。
- **⚡ 零成本部署**：基于 Cloudflare Workers + KV 构建，全边缘节点响应，无需购买服务器。
- **🔐 极简安全控制**：包含基于 Cookie 的轻量级管理面板鉴权，支持管理密钥保护。
- **📊 实时作答追踪**：
  - 自动记录**首次访问时间**、**完成时间**及**中途退出/刷新次数**等作答痕迹。
  - 实时查看作答选项与最后的**520字心里话/反馈留言**。
- **🛠️ 动态问卷配置**：
  - 支持多套对话/问卷创建。
  - 支持一键激活/停用/重置测试数据及可视化管理界面。
  - 支持夜间 / 日间模式一键切换。

---

## 🏗️ 技术栈

- **Runtime**: Cloudflare Workers (Edge Computing)
- **Database**: Cloudflare KV (`SUNNY_DATA_MAIN`, `SUNNY_DATA_FEEDBACK`)
- **Frontend**: Native HTML5 / CSS3 / Vanilla JavaScript (Single File / Zero Dependencies)

---

## 📁 目录架构与路由说明

整个项目采用单文件高效架构部署：

| 路由路径 | 说明 |
| :--- | :--- |
| `/authentication` | 管理员登录页面 |
| `/administrator` | 后台管理面板（包含对话管理与反馈查看） |
| `/chat/{uuid}` | 互动问卷与反馈提交页面（采取UUID配置，最大限度确保安全私密） |

---

## 🚀 快速部署指南

### 1. 准备工作

一个[Cloudflare账号](https://dash.cloudflare.com/)，其它没了。

### 2. 快速部署项目

- 下载本项目的[压缩文件](https://github.com/sunchenxu2011/sunnydialogue/archive/refs/heads/main.zip)。
- 登录你的Cloudflare账号，找到Workers and Pages选项，创建一个新的Pages项目。
- 给你的项目取上一个个性化的名字，然后上传刚刚下载的压缩文件，点击部署，搞定！

### 3.配置环境变量与绑定

在 Cloudflare 控制台中创建两个 KV 命名空间：
1. `SUNNY_DATA_MAIN`（存储对话问卷与作答进度）
2. `SUNNY_DATA_FEEDBACK`（存储对方留下的反馈/留言）

在 Cloudflare Workers 设置 -> **变量** 中添加：

#### **KV 命名空间绑定**：
- `SUNNY_DATA_MAIN` ➡️ 绑定对应的 KV 数据库
- `SUNNY_DATA_FEEDBACK` ➡️ 绑定对应的 KV 数据库

#### **环境变量**：
- `SUNNY_KEY`: ➡️ 你的后台管理密码

---

## 💡 使用说明

1. 访问 `/authentication` 输入设置的 `SUNNY_KEY` 登录后台。
2. 点击 **“➕ 新建”** 创建一套问卷，保存后点击 **“激活”**。
3. 点击 **“📋 复制链接”**，将生成的专属对话链接发给**你喜欢的人**（祝你好运...）。
4. 待对方完成后，可在后台实时查看其选选项与最终的**留言反馈**。

---

## 💌 写在最后

喜欢一个人怎么舍得不表达出来？
为什么要错过？
干就完了！
即使结果仍然不如意，
只需要做到，长大之后
**没有后悔，没有愧疚，有的只是释怀。**
