# Vercel Environment Variables Setup

## ⚠️ IMPORTANT: Set Environment Variables

Your app is deployed but **won't work** until you set environment variables in Vercel Dashboard.

## Quick Setup

1. **Go to Vercel Dashboard:**
   ```
   https://vercel.com/raxamaliks-projects/epml/settings/environment-variables
   ```

2. **Add these Required Variables:**

   **DATABASE_URL** (Required)
   ```
   Your Supabase PostgreSQL connection string
   Format: postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres
   ```
   
   **SESSION_SECRET** (Required)
   ```bash
   # Generate with:
   openssl rand -hex 32
   ```
   
   **NODE_ENV** (Required)
   ```
   production
   ```

3. **Optional Variables:**
   - `SENDGRID_API_KEY` - For email functionality
   - `JWT_SECRET` - If using JWT authentication

## After Setting Variables

1. **Redeploy** (variables take effect on next deployment):
   ```bash
   vercel --prod
   ```
   
   OR trigger a new deployment from Vercel Dashboard

2. **Run Database Migrations:**
   ```bash
   # Set DATABASE_URL locally to your production database
   export DATABASE_URL="your-production-database-url"
   npm run db:push
   ```

3. **Test Your Deployment:**
   - Visit: https://epml-nmpdxfayb-raxamaliks-projects.vercel.app
   - Try signing up
   - Try logging in

## Current Deployment

- **Production URL**: https://epml-nmpdxfayb-raxamaliks-projects.vercel.app
- **Dashboard**: https://vercel.com/raxamaliks-projects/epml

## Troubleshooting

### "Database connection failed"
- Check DATABASE_URL is set correctly
- Verify Supabase allows connections from Vercel IPs
- Check database migrations ran successfully

### "Unauthorized" errors
- Check SESSION_SECRET is set
- Verify NODE_ENV is "production"

### Check Logs
```bash
vercel logs https://epml-nmpdxfayb-raxamaliks-projects.vercel.app
```

Or view in Vercel Dashboard → Project → Logs

