# Quick Deployment Guide to Vercel

## Pre-Deployment Checklist

- [x] Build script fixed (`build-vercel.js` created)
- [x] Vercel configuration (`vercel.json`) ready
- [ ] Environment variables prepared
- [ ] Git repository pushed to GitHub/GitLab/Bitbucket

## Step 1: Prepare Environment Variables

Before deploying, generate secure secrets:

```bash
npm run generate-secrets
```

Save the output - you'll need these for Vercel.

## Step 2: Deploy to Vercel

### Option A: Deploy via Vercel Dashboard (Recommended for first time)

1. **Push your code to Git** (if not already):
   ```bash
   git add .
   git commit -m "Ready for Vercel deployment"
   git push origin main
   ```

2. **Go to Vercel Dashboard**:
   - Visit: https://vercel.com/new
   - Sign in with GitHub/GitLab/Bitbucket

3. **Import your repository**:
   - Click "Import Project"
   - Select your repository
   - Vercel will auto-detect settings

4. **Configure Project** (should auto-detect):
   - **Framework Preset**: Other
   - **Root Directory**: `./` (root)
   - **Build Command**: `npm run build:vercel` (already set in vercel.json)
   - **Output Directory**: `dist/public` (already set in vercel.json)
   - **Install Command**: `npm install`

5. **Add Environment Variables**:
   - Click "Environment Variables"
   - Add these variables (select Production, Preview, Development):
     
     | Variable | Value | Notes |
     |----------|-------|-------|
     | `DATABASE_URL` | Your production PostgreSQL URL | Use Supabase production URL |
     | `SESSION_SECRET` | Generated secret (64 chars) | From `npm run generate-secrets` |
     | `NODE_ENV` | `production` | For production environment |
     | `JWT_SECRET` | Generated secret (different) | From `npm run generate-secrets` |
     | `SENDGRID_API_KEY` | Your SendGrid key | Optional, for emails |

6. **Deploy**:
   - Click "Deploy"
   - Wait for build to complete

### Option B: Deploy via Vercel CLI

1. **Install Vercel CLI** (if not installed):
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Deploy**:
   ```bash
   # First deployment (follow prompts)
   vercel

   # Deploy to production
   vercel --prod
   ```

4. **Set Environment Variables via CLI**:
   ```bash
   vercel env add DATABASE_URL production
   vercel env add SESSION_SECRET production
   vercel env add NODE_ENV production
   vercel env add JWT_SECRET production
   vercel env add SENDGRID_API_KEY production
   ```

## Step 3: Run Database Migrations

After deployment, ensure your database schema is up to date:

```bash
# Pull environment variables from Vercel
vercel env pull .env.local

# Run migrations
npm run db:push
```

Or set DATABASE_URL manually:
```bash
export DATABASE_URL="your-production-database-url"
npm run db:push
```

## Step 4: Verify Deployment

1. **Check Build Logs**:
   - Go to Vercel Dashboard → Your Project → Deployments
   - Click on the latest deployment
   - Check "Build Logs" for any errors

2. **Test Your App**:
   - Visit your deployment URL (e.g., `https://your-app.vercel.app`)
   - Test signup/login
   - Check API routes (`/api/analytics`)

3. **Check Function Logs**:
   - Vercel Dashboard → Project → Functions → `api/index.js`
   - Check for any runtime errors

## Troubleshooting

### Build Fails

**Error: "Could not resolve api/index.ts"**
- ✅ Fixed! The build script now handles path aliases correctly

**Error: "Module not found"**
- Check that all dependencies are in `package.json`
- Verify `node_modules` is not committed (should be in `.gitignore`)

**Error: "Build timeout"**
- Vercel free tier has 45min build limit
- Check for large dependencies or slow build steps

### Runtime Errors

**"Database connection failed"**
- Verify `DATABASE_URL` is set correctly in Vercel
- Check Supabase allows connections from Vercel IPs
- Ensure database migrations ran successfully

**"Unauthorized" or Session errors**
- Verify `SESSION_SECRET` is set
- Check `NODE_ENV` is set to `production`
- Ensure secrets are different between environments

**API routes return 404**
- Check `vercel.json` rewrites configuration
- Verify `api/index.js` exists after build
- Check function logs in Vercel Dashboard

### Check Logs

```bash
# View logs via CLI
vercel logs [your-deployment-url]

# Or view in Dashboard
# Vercel Dashboard → Project → Logs
```

## Post-Deployment

- [ ] Set up custom domain (optional)
- [ ] Configure monitoring/alerts
- [ ] Set up CI/CD for automatic deployments
- [ ] Review and optimize function cold starts
- [ ] Set up database backups

## Useful Commands

```bash
# Deploy to production
vercel --prod

# Deploy preview
vercel

# View environment variables
vercel env ls

# Pull environment variables locally
vercel env pull .env.local

# View logs
vercel logs

# Check deployment status
vercel inspect [deployment-url]
```

## Support Resources

- **Vercel Docs**: https://vercel.com/docs
- **Vercel Discord**: https://vercel.com/discord
- **Project Setup**: See `VERCEL_ENV_SETUP.md` for detailed env var setup
- **Deployment Guide**: See `VERCEL_DEPLOYMENT.md` for comprehensive guide

