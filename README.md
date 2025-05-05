# ✨ Cloudflare Manager Telegram Bot ✨

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Manage your Cloudflare KV and Worker environment variables directly through Telegram!**

This bot, deployed on Cloudflare Workers, provides a convenient interface allowing you to manage your Cloudflare KV Namespaces and Worker environment variables without leaving Telegram.

This project has **zero external npm dependencies**, making deployment simple and fast.

Access the public bot <a href='https://t.me/CloudflareEnvBot'>@CloudflareEnvBot</a>

## ✨ Key Features

*   **Cloudflare KV Management:**
    *   List all KV Namespaces.
    *   List Keys under a specified Namespace (supports pagination and prefix filtering).
    *   View, add, modify, and delete specified Key-Value pairs.
*   **Cloudflare Worker Environment Variable Management:**
    *   List Workers under your account.
    *   List environment variables for a specified Worker (distinguishes between plain Variables and Secrets).
    *   View, add, modify, and delete environment variables for a specified Worker.
*   **User-Friendly Telegram Interaction:**
    *   Uses Inline Keyboards for intuitive menu navigation.
*   **Persistent Chat State:**
    *   Utilizes KV storage to save the user's current operation state, supporting multi-step interactions.
*   **Zero External Dependencies:**
    *   Built entirely on the native Cloudflare Workers environment.

## 🚀 Prerequisites

Before you begin deployment, please ensure you have the following information ready:

1.  **Cloudflare Account:**
    *   An active Cloudflare account.
    *   Your **Cloudflare Account ID** ([How to find](https://developers.cloudflare.com/fundamentals/get-started/basic-tasks/find-account-and-zone-ids/)).
2.  **Telegram Bot Token:**
    *   Create a new bot via [@BotFather](https://t.me/BotFather).
    *   Obtain and save your bot's **Token**.
3.  **Cloudflare KV Namespace (for Bot Data):**
    *   Create a KV Namespace in your Cloudflare account.
    *   **This Namespace is used to securely store user Cloudflare credentials (encrypted API Token) and chat state.**
    *   Note down the **Namespace ID** of this KV Namespace.
4.  **Generate Secure Secrets:**
    *   Create a **strong random string** to use as the password for accessing the Worker's `/setup` endpoint (`CF_WORKER_TOKEN`).
    *   Create a **strong random string** to use as the password for Telegram to verify requests to the Worker (`BOT_SECRET`).

## 🛠️ Deployment & Configuration: Using Cloudflare Dashboard

Follow these steps to deploy and configure the Worker using the Cloudflare Dashboard:

1.  **<a href='https://github.com/oy3o/cf-bot/fork'>Fork</a> this project repository.**
2.  **Create and Deploy the Worker:**
    *   Log in to the <a href='https://dash.cloudflare.com/'>Cloudflare Dashboard</a>.
    *   Navigate to `Workers & Pages`.
    *   Click `Create` > `Import a repository` > `cf-bot` > `Save and Deploy`.
3.  **Configure Worker Settings:**
    *   After successful deployment, navigate to the `Settings` tab of the Worker.
    *   **KV Namespace Binding:**
        *   Click `Add binding`.
        *   `Variable name`: Enter `data` (this is the binding name used in the code to access the KV).
        *   `KV namespace`: Select the KV Namespace you created in the "Prerequisites" section.
        *   Click `Save`.
    *   **Environment Variables:**
        *   In the `Environment Variables` section, click `Add variable`.
        *   Add the following variables and their corresponding values one by one:

        ```
        CF_ACCOUNT_ID:      Your Cloudflare Account ID
        CF_API_TOKEN:       The Cloudflare API Token the bot uses for its own operations (e.g., listing resources).
        CF_WORKER_TOKEN:    The secure key you generated, used to access /setup and /shutdown endpoints.
        CF_WORKER_ID:       (e.g.: cf-bot) Give your Worker a descriptive name.
        CF_WORKER_ENDPOINT: Your Worker URL (e.g.: cf-bot.<domain>.workers.dev). **Found on the Worker's overview page after deployment.**
        BOT_ADMIN:          (Optional) Your Telegram User ID (numeric).
        BOT_IS_PUBLIC:      (Optional) (Boolean: true or false) Set to true to allow all users to use the bot.
        BOT_TOKEN:          Your Telegram Bot Token
        BOT_SECRET:         The secure key you generated, used for Telegram Webhook verification, ensuring messages originate from your configured bot.
        ```
        *   For sensitive information (like Tokens and Secrets), use `Add secret` instead of `Add variable` for enhanced security.
        *   Click `Save and deploy` to apply the configuration.

## ⚙️ First Run Setup: Register Telegram Webhook

After the Worker is successfully deployed and configured, you need to manually set up the Telegram Webhook once so that Telegram sends user messages to your Worker.

1.  **Get the Worker URL:** Find the full URL of your Worker on the Cloudflare Dashboard's Worker overview page (usually `cf-bot.<domain>.workers.dev`).
2.  **Access the Setup Endpoint:** Open the following link in your browser (replace placeholders with your actual values):

    ```
    https://<YOUR_WORKER_ENDPOINT>/setup?token=<YOUR_CF_WORKER_TOKEN>
    ```
    *   Replace `<YOUR_WORKER_ENDPOINT>` with the Worker URL obtained in the previous step.
    *   Replace `<YOUR_CF_WORKER_TOKEN>` with the value you configured for `CF_WORKER_TOKEN` in the Worker settings.
3.  **Check the Result:** If the browser page displays `"ok"` or a similar success message, the Webhook setup was successful. If it fails, check if the Worker URL and `CF_WORKER_TOKEN` are correct.

## 💬 Usage Instructions

1.  **Find Your Bot:** Search for the username of the bot you created in the Telegram App.
2.  **Start Interaction:** Send the `/start` command to your bot.
3.  **Log in to Cloudflare:**
    *   Send the `/login` command.
    *   The bot will prompt you to enter your **Cloudflare Account ID** and a **Cloudflare API Token**, one after another.
    *   **Important:** This API Token is the token **you (or the user using the Bot) provide, used to manage your Cloudflare resources**.
        *   **It is strongly recommended to create a dedicated API Token with** **minimal required permissions**. For example, grant only `KV Storage: Read/Write` and `Worker Scripts: Read/Edit` permissions.
        *   **DO NOT** use your Global API Key or a Token with all permissions.
    *   The provided Account ID and API Token will be stored in the Bot data KV Namespace, associated with your Telegram User ID.
4.  **Manage KV Namespaces:** Send the `/db` command to operate via inline keyboards.
5.  **Manage Worker Environment Variables:** Send the `/env` command to operate via inline keyboards.
6.  **Get Help:** Send the `/help` command to see a list of available commands and brief descriptions.

## 📄 License

This project is licensed under the [MIT License](LICENSE).
