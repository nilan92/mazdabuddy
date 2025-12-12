# Deploying MazdaBuddy to GitHub Pages

This guide explains how to publish your app to GitHub Pages for free hosting.

## Prerequisites

1.  A GitHub Account.
2.  A GitHub Repository for this project.

## Step 1: Configure Base URL

1.  Open `vite.config.ts`.
2.  Find the `base: '/mazdabuddy/'` line.
3.  **Update this** to match your GitHub repository name.
    - Example: If your repo is `https://github.com/myname/auto-shop`, set `base: '/ml/auto-shop/'`.
    - If you changed it, save the file.

## Step 2: Push to GitHub

1.  Commit all changes:
    ```bash
    git add .
    git commit -m "Prepare for deployment"
    ```
2.  Push to your repository:
    ```bash
    git push origin main
    ```

## Step 3: Configure GitHub Pages

1.  Go to your Repository on GitHub.
2.  Click **Settings** > **Pages** (sidebar).
3.  Under **Build and deployment** > **Source**, select **GitHub Actions**.
4.  The action I created (`.github/workflows/deploy.yml`) will automatically run.
5.  Wait a few minutes. You can check progress in the **Actions** tab.

## Step 4: Supabase Configuration (Crucial!)

For Login to work on the live site, you must update Supabase.

1.  Go to [Supabase Dashboard](https://supabase.com/dashboard).
2.  Select your project.
3.  Go to **Authentication** > **URL Configuration**.
4.  **Site URL**: Set this to your live GitHub Pages URL (e.g., `https://myname.github.io/auto-shop/`).
5.  **Redirect URLs**: Add the same URL there.
6.  Click **Save**.

## Verification

- Visit your GitHub Pages URL.
- Try logging in.
- If it works, you're live!

**Note**: Since we switched to `HashRouter`, your URLs will look like `.../mazdabuddy/#/dashboard`. This ensures the app works perfectly on GitHub Pages without "404 Not Found" errors on refresh.
