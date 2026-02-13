# Vercel CLI Technical Guide

This guide provides a step-by-step walkthrough for using the Vercel CLI to authenticate, configure, and deploy web applications.

## 1. Installation

The Vercel CLI is a Node.js-based tool. You can install it globally using npm, yarn, or pnpm.

```bash
# Using npm
npm i -g vercel

# Using yarn
yarn global add vercel

# Using pnpm
pnpm add -g vercel
```

To verify the installation:

```bash
vercel --version
```

---

## 2. Authentication

Before deploying, you must authenticate your machine with your Vercel account.

### Method A: Browser Login (Recommended)

Run the login command without arguments:

```bash
vercel login
```

1. Select "Continue with Web Browser".
2. A browser window will open automatically.
3. Confirm the login in the browser.
4. The CLI will automatically receive the token.

### Method B: Email Login

1. Run `vercel login`.
2. Select "Email".
3. Enter your email address.
4. Open the verification email sent by Vercel and click the "Verify" button.
5. The CLI will complete the authentication process.

---

## 3. Project Initialization

To link a local directory to a Vercel project, navigate to your project root and run:

```bash
vercel
```

The CLI will prompt you with several questions:

1. **Set up and deploy?** [Y/n] `Y`
2. **Which scope?** (Select your personal account or team)
3. **Link to existing project?** [y/N] `N` (unless you are linking to a pre-created project)
4. **What's your project's name?** (Enter name or press Enter for default)
5. **In which directory is your code located?** `./`
6. **Want to modify build settings?** [y/N] `N` (Vercel auto-detects most frameworks like Next.js, Vite, etc.)

Once completed, a `.vercel` folder is created containing project metadata. **Do not commit this folder to Git.**

---

## 4. Environment Variables

Managing environment variables through the CLI ensures consistency across environments.

### Adding a Variable

```bash
vercel env add <variable-name>
```

You will be prompted for:

1. **Value**: The content of the variable.
2. **Environments**: Select which environments (Production, Preview, Development) should have access to this variable.

### Pulling Variables for Local Development

To sync your Vercel environment variables to a local `.env.local` file:

```bash
vercel env pull .env.local
```

---

## 5. Deployment Commands

Vercel distinguishes between "Preview" and "Production" deployments.

### Preview Deployment (Default)

Use this for testing features or sharing progress. It generates a unique URL that is not your main domain.

```bash
vercel
```

* **Behavior**: Uploads code, triggers a build, and provides a unique `project-name-xyz.vercel.app` URL.
* **Use Case**: Pull requests, staging, internal reviews.

### Production Deployment

Use this when you are ready to update your live site.

```bash
vercel --prod
```

* **Behavior**: Promotes the deployment to your production domains (e.g., `myapp.com` or `myapp.vercel.app`).
* **Use Case**: Final releases, official updates.

---

## 6. Summary of Essential Commands

| Command | Description |
| :--- | :--- |
| `vercel login` | Authenticate the CLI |
| `vercel` | Initialize project or create a Preview deployment |
| `vercel --prod` | Create a Production deployment |
| `vercel dev` | Start a local development server mimicking Vercel's environment |
| `vercel env add` | Add an environment variable to the cloud |
| `vercel logs` | View live logs from your deployments |
| `vercel logout` | Remove the authentication token from your machine |
