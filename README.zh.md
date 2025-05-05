# ✨ Cloudflare Manager Telegram Bot ✨

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**通过 Telegram 直接管理您的 Cloudflare KV 和 Worker 环境变量！**

这个机器人部署在 Cloudflare Workers 上，提供了一个便捷的界面，让您无需离开 Telegram 即可管理 Cloudflare KV Namespaces 和 Worker 环境变量。

本项目**零外部 npm 依赖**，部署简单快捷。

访问公开机器人 <a href='https://t.me/CloudflareEnvBot'>@CloudflareEnvBot</a>

## ✨ 主要功能

*   **Cloudflare KV 管理:**
    *   列出所有 KV Namespaces。
    *   列出指定 Namespace 下的 Keys (支持分页和前缀过滤)。
    *   查看、添加、修改、删除指定的 Key-Value 对。
*   **Cloudflare Worker 环境变量管理:**
    *   列出账户下的 Workers。
    *   列出指定 Worker 的环境变量 (区分明文 Variables 和 Secrets)。
    *   查看、添加、修改、删除指定 Worker 的环境变量。
*   **友好的 Telegram 交互:**
    *   使用内联键盘 (Inline Keyboard) 提供直观的菜单导航。
*   **持久化聊天状态:**
    *   利用 KV 存储用户当前操作状态，支持多步骤交互。
*   **零外部依赖:**
    *   完全基于 Cloudflare Workers 原生环境构建。

## 🚀 前置要求

在开始部署之前，请确保您已准备好以下信息：

1.  **Cloudflare 账户:**
    *   一个有效的 Cloudflare 账户。
    *   您的 **Cloudflare Account ID** ([查找方法](https://developers.cloudflare.com/fundamentals/get-started/basic-tasks/find-account-and-zone-ids/))。
2.  **Telegram Bot Token:**
    *   通过 [@BotFather](https://t.me/BotFather) 创建一个新的机器人。
    *   获取并保存好机器人的 **Token (令牌)**。
3.  **Cloudflare KV Namespace (用于 Bot 数据):**
    *   在您的 Cloudflare 账户中创建一个 KV Namespace。
    *   **此 Namespace 用于安全存储用户 Cloudflare 凭据 (加密的 API Token) 和聊天状态。**
    *   记下这个 KV Namespace 的 **Namespace ID**。
4.  **生成 安全密钥 (Secrets):**
    *   创建一个**强随机字符串**作为访问 Worker `/setup` 端点的密码 (`CF_WORKER_TOKEN`)。
    *   创建一个**强随机字符串**作为 Telegram 验证 Worker 请求的密码 (`BOT_SECRET`)。

## 🛠️ 部署与配置: 使用 Cloudflare Dashboard

按照以下步骤通过 Cloudflare Dashboard 部署和配置 Worker：

1.  **<a href='https://github.com/oy3o/cf-bot/fork'>Fork</a> 本项目仓库。**
2.  **创建并部署 Worker:**
    *   登录 <a href='https://dash.cloudflare.com/'>Cloudflare Dashboard</a>。
    *   导航到 `Workers & Pages`。
    *   点击 `Create` > `Import a repository` > `cf-bot` > `Save and Deploy`。。
3.  **配置 Worker 设置:**
    *   部署成功后，导航到该 Worker 的 `Settings` 标签页。
    *   **KV Namespace 绑定 (KV Namespace Bindings):**
        *   点击 `Add binding`。
        *   `Variable name`: 输入 `data` (这是代码中用于访问 KV 的绑定名称)。
        *   `KV namespace`: 选择您在“前置要求”中创建的 KV Namespace。
        *   点击 `Save`。
    *   **环境变量 (Variables):**
        *   在 `Environment Variables` 部分，点击 `Add variable`。
        *   逐个添加以下变量及其对应的值：

        ```
        CF_ACCOUNT_ID:      您的 Cloudflare Account ID
        CF_API_TOKEN:       用于 Bot 自身存储会话
        CF_WORKER_TOKEN:    您生成的安全密钥，用于访问 /setup /shutdown
        CF_WORKER_ID:       (例如: cf-bot) 给您的 Worker 取一个识别名称
        CF_WORKER_ENDPOINT: 您的 Worker URL (例如: cf-bot.<域名>.workers.dev)。**部署后在Worker概览页可找到。**
        BOT_ADMIN:          (可选) 您的 Telegram 用户 ID (数字)。
        BOT_IS_PUBLIC:      (可选) (布尔值: true 或 false) 设置为 true，则允许所有用户使用。
        BOT_TOKEN:          您的 Telegram Bot Token
        BOT_SECRET:         您生成的安全密钥，用于 Telegram Webhook 验证, 确保消息来源于设定的机器人。
        ```
        *   对于敏感信息 (如 Token 和 Secrets)，请使用 `Add secret` 而非 `Add variable` 以增强安全性。
        *   点击 `Save and deploy` 应用配置。

## ⚙️ 首次运行设置: 注册 Telegram Webhook

Worker 部署并配置成功后，需要手动设置一次 Telegram Webhook，以便 Telegram 将用户消息发送到您的 Worker。

1.  **获取 Worker URL:** 在 Cloudflare Dashboard 的 Worker 概览页面找到您的 Worker 的完整 URL (通常是 `cf-bot.<域名>.workers.dev`)。
2.  **访问 Setup 端点:** 在浏览器中打开以下链接 (请替换占位符为您的实际值):

    ```
    https://<YOUR_WORKER_ENDPOINT>/setup?token=<YOUR_CF_WORKER_TOKEN>
    ```
    *   将 `<YOUR_WORKER_ENDPOINT>` 替换为上一步获取的 Worker URL。
    *   将 `<YOUR_CF_WORKER_TOKEN>` 替换为您在 Worker 设置中配置的 `CF_WORKER_TOKEN` 的值。
3.  **检查结果:** 如果浏览器页面显示 `"ok"` 或类似成功的消息，表示 Webhook 设置成功。如果失败，请检查 Worker URL 和 `CF_WORKER_TOKEN` 是否正确。

## 💬 使用说明

1.  **找到您的 Bot:** 在 Telegram App 中搜索您创建的机器人用户名。
2.  **开始交互:** 向您的机器人发送 `/start` 命令。
3.  **登录 Cloudflare:**
    *   发送 `/login` 命令。
    *   机器人会提示您依次输入您的 **Cloudflare Account ID** 和一个 **Cloudflare API Token**。
    *   **重要提示:** 这个 API Token 是**您 (或使用 Bot 的用户) 提供、用于管理其 Cloudflare 资源的 Token**。
        *   **强烈建议创建一个拥有** **最小所需权限** **的专用 API Token。** 例如，仅授予 `KV Storage: Read/Write` 和 `Worker Scripts: Read/Edit` 权限。
        *   **请勿** 使用您的全局 API Key 或拥有所有权限的 Token。
    *   提供的 Account ID 和 API Token 会被存储在与您 Telegram 用户 ID 关联的 Bot 数据 KV Namespace 中。
4.  **管理 KV Namespaces:** 发送 `/db` 命令，通过内联键盘进行操作。
5.  **管理 Worker 环境变量:** 发送 `/env` 命令，通过内联键盘进行操作。
6.  **获取帮助:** 发送 `/help` 查看可用命令列表和简要说明。

## 📄 License

本项目采用 [MIT License](LICENSE)。