# Deploying MTN to Production

This guide covers deploying MTN to a hosted environment using Supabase and Cloudflare Pages.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Production Stack                      │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  Frontend: Cloudflare Pages (Static SPA)                │
│  Database/Auth: Supabase (Hosted)                       │
│  CORS Proxy: Cloudflare Worker                          │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

## Prerequisites

- Supabase account (free tier available)
- Cloudflare account (free tier available)
- GitHub account (for Cloudflare Pages deployment)
- Domain name (optional)

## Step 1: Set Up Supabase

### 1.1 Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click "New Project"
3. Choose an organization and enter project details
4. Wait for the project to be provisioned (~2 minutes)

### 1.2 Run Database Migrations

1. In your Supabase dashboard, go to **SQL Editor**
2. Click "New Query"
3. Copy the contents of `supabase/migrations/20260321_initial_schema.sql`
4. Paste and click "Run"
5. Verify tables were created in **Table Editor**

### 1.3 Configure Authentication

1. Go to **Authentication** → **Providers**
2. Enable the providers you want (Google, GitHub, Apple)
3. For each provider:
   - Create an OAuth app with the provider
   - Add the Client ID and Secret to Supabase
   - Set the redirect URL to: `https://your-project.supabase.co/auth/v1/callback`

#### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable Google+ API
4. Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
5. Add authorized redirect URI: `https://your-project.supabase.co/auth/v1/callback`
6. Copy Client ID and Secret to Supabase

#### GitHub OAuth Setup

1. Go to GitHub **Settings** → **Developer settings** → **OAuth Apps**
2. Click "New OAuth App"
3. Set Authorization callback URL: `https://your-project.supabase.co/auth/v1/callback`
4. Copy Client ID and Secret to Supabase

### 1.4 Get API Credentials

1. Go to **Settings** → **API**
2. Copy:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon public** key

## Step 2: Deploy CORS Proxy

The CORS proxy is needed to fetch RSS feeds and article content.

### 2.1 Deploy to Cloudflare Workers

```bash
cd cloudflare-worker
npm install
npx wrangler login
npx wrangler deploy
```

### 2.2 Note the Worker URL

After deployment, you'll get a URL like: `https://mtn-cors-proxy.your-subdomain.workers.dev`

## Step 3: Deploy Web App to Cloudflare Pages

### 3.1 Push to GitHub

```bash
git add .
git commit -m "Prepare for deployment"
git push origin main
```

### 3.2 Create Cloudflare Pages Project

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Click **Pages** → **Create a project**
3. Connect your GitHub account
4. Select your MTN repository
5. Configure build settings:
   - **Framework preset**: Vite
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`

### 3.3 Add Environment Variables

In Cloudflare Pages project settings, add:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_STORAGE_MODE=cloud
VITE_CORS_PROXY_URL=https://mtn-cors-proxy.your-subdomain.workers.dev
```

### 3.4 Deploy

Click "Save and Deploy". Cloudflare will build and deploy your app.

Your app will be available at: `https://your-project.pages.dev`

## Step 4: Configure Custom Domain (Optional)

### 4.1 Add Domain to Cloudflare Pages

1. In your Pages project, go to **Custom domains**
2. Click "Set up a custom domain"
3. Enter your domain (e.g., `mtn.yourdomain.com`)
4. Follow the DNS configuration instructions

### 4.2 Update OAuth Redirect URIs

Update all OAuth apps to include your custom domain:
- Google: Add `https://mtn.yourdomain.com` to authorized origins
- GitHub: Update Authorization callback URL
- Supabase: Update Site URL in **Authentication** → **URL Configuration**

## Step 5: Test the Deployment

1. Visit your deployed app
2. Click "Sign In" and test OAuth flow
3. Configure settings (API key, topics, RSS feeds)
4. Generate a daily summary
5. Save an article
6. Generate book recommendations

## Monitoring and Maintenance

### Supabase Dashboard

Monitor your database usage, auth activity, and API requests:
- **Database**: View table sizes, run queries
- **Authentication**: See user signups and logins
- **Logs**: Debug API errors

### Cloudflare Analytics

View traffic, performance, and errors:
- **Pages**: Build history, deployment logs
- **Workers**: Request count, errors, CPU time

### Database Backups

Supabase Pro tier includes automatic daily backups. For free tier:

1. Go to **Database** → **Backups**
2. Click "Download backup" regularly
3. Store backups securely

## Updating the Deployment

### Update Web App

1. Make changes locally
2. Commit and push to GitHub
3. Cloudflare Pages will automatically rebuild and deploy

### Update Database Schema

1. Create a new migration file in `supabase/migrations/`
2. Run it in Supabase SQL Editor
3. Commit the migration file to version control

### Update CORS Proxy

```bash
cd cloudflare-worker
# Make changes to worker.js
npx wrangler deploy
```

## Cost Estimates

### Free Tier (Hobby Projects)

- **Supabase Free**: 500MB database, 50K MAUs, unlimited API requests
- **Cloudflare Pages Free**: Unlimited requests, 500 builds/month
- **Cloudflare Workers Free**: 100K requests/day

**Total: $0/month**

### Paid Tier (Production)

- **Supabase Pro**: $25/month (8GB database, 100K MAUs, daily backups)
- **Cloudflare Pages Pro**: $20/month (5K builds/month, advanced features)
- **Cloudflare Workers Paid**: $5/month (10M requests)
- **Domain**: ~$12/year

**Total: ~$50/month + domain**

## Security Checklist

- [ ] Enable RLS policies on all tables (done in migrations)
- [ ] Use environment variables for all secrets
- [ ] Enable HTTPS (automatic with Cloudflare)
- [ ] Configure CORS properly in worker
- [ ] Set up rate limiting in Supabase (Pro tier)
- [ ] Enable 2FA on Supabase and Cloudflare accounts
- [ ] Regularly update dependencies
- [ ] Monitor error logs

## Troubleshooting

### Build Fails on Cloudflare Pages

- Check build logs for errors
- Verify environment variables are set
- Ensure `package.json` scripts are correct

### Authentication Not Working

- Verify OAuth redirect URIs match exactly
- Check Supabase auth logs
- Ensure Site URL is configured correctly

### CORS Errors

- Verify CORS proxy URL is correct
- Check worker logs in Cloudflare dashboard
- Ensure worker has correct allowed origins

### Database Connection Issues

- Verify Supabase URL and anon key
- Check RLS policies are enabled
- Review Supabase logs for errors

## Support

For deployment issues:
- Supabase: https://supabase.com/docs
- Cloudflare Pages: https://developers.cloudflare.com/pages
- MTN GitHub: https://github.com/yourusername/mtn/issues
