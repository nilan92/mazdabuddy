# Deploying MazdaBuddy to GitHub Pages

This guide explains how to publish your app to GitHub Pages for free hosting.

## Prerequisites

1.  A GitHub Account.
2.  A GitHub Repository for this project.

## Step 0: Initialize Git (First Time Only)

If you see errors like `fatal: not a git repository`, run these commands in your project folder first:

```bash
# Initialize a new git repository
git init

# Add all files
git add .

# Save changes
git commit -m "First commit"

# Rename branch to main
git branch -M main

# Link to your new repository
git remote add origin https://github.com/nilan92/mazdabuddy.git
```

Then proceed to **Step 1**.

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

If you see `Authentication failed` or `Password authentication is not supported`:

1.  Go to GitHub.com > **Settings** (top right profile icon) > **Developer settings** (bottom of sidebar).
2.  Select **Personal access tokens** > **Tokens (classic)**.
3.  Click **Generate new token (classic)**.
4.  Give it a Note (e.g., "MazdaBuddy Deploy").
5.  **Select Scopes**: Check `repo` (Full control of private repositories) and `workflow` (needed for Actions).
6.  Click **Generate token**.
7.  **COPY THIS TOKEN**. You won't see it again.
8.  Back in your terminal, run `git push -u origin main` again.
9.  **Username**: Your GitHub username.
10. **Password**: Paste the **Token** you just copied (NOT your account password).

## Step 3: Configure GitHub Pages

1.  Go to your Repository on GitHub.
2.  Click **Settings** > **Pages** (sidebar).
3.  Under **Build and deployment** > **Source**, select **GitHub Actions**.
4.  The action I created (`.github/workflows/deploy.yml`) will automatically run.
5.  Wait a few minutes. You can check progress in the **Actions** tab.

## Step 4: Configure GitHub Secrets (Crucial for Build)

Since we didn't push the `.env` file (for security), you must tell GitHub these values so it can build your app.

1.  Go to your GitHub Repository.
2.  Click **Settings** > **Secrets and variables** > **Actions**.
3.  Click **New repository secret**.
4.  Add the following two secrets (copy values from your local `.env` file):
    - **Name**: `VITE_SUPABASE_URL`
    - **Value**: (Your Supabase URL)
    - Click **Add secret**.
    - **Name**: `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY`
    - **Value**: (Your Supabase Anon Key)
    - Click **Add secret**.

Once these are added, go to the **Actions** tab and re-run the failed workflow (or push a new commit).

## Step 5: Supabase Configuration (Crucial!)

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
