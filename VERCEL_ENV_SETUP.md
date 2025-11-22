# Vercel Environment Variables Setup

## ⚠️ IMPORTANT: Set Environment Variables

Your app is deployed but **won't work** until you set environment variables in Vercel Dashboard.

## Quick Setup

1. **Go to Vercel Dashboard:**
   ```
   https://vercel.com/raxamaliks-projects/epml/settings/environment-variables
   ```

2. **Add these Required Variables:**

   ### Required Variables

   **DATABASE_URL** (Required)
   ```
   Your production PostgreSQL connection string
   Example: postgresql://postgres:password@db.supabase.co:5432/postgres
   
   ⚠️ Use your PRODUCTION database URL, not the local one!
   ```
   
   **SESSION_SECRET** (Required)
   ```bash
   # Generate a secure secret (run this command):
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   
   # Or use:
   openssl rand -hex 32
   
   # Example output: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
   ```
   
   **NODE_ENV** (Required)
   ```
   production
   ```

   ### Optional but Recommended Variables

   **JWT_SECRET** (Optional but Recommended)
   ```bash
   # Generate with:
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   
   # Use a different value than SESSION_SECRET
   ```

   **SENDGRID_API_KEY** (Optional - Required for email functionality)
   ```
   Your SendGrid API key from https://app.sendgrid.com/settings/api_keys
   ```

   **BASE_URL** (Optional - Auto-set by Vercel)
   ```
   Your Vercel deployment URL (e.g., https://epml.vercel.app)
   Vercel sets this automatically, but you can override if needed
   ```

   ### Database Connection Variables (Alternative to DATABASE_URL)

   If you prefer to use individual variables instead of DATABASE_URL:
   - `PGUSER` - Database user
   - `PGHOST` - Database host
   - `PGPASSWORD` - Database password
   - `PGDATABASE` - Database name
   - `PGPORT` - Database port (usually 5432)

## Step-by-Step Setup Instructions

### Step 1: Generate Secure Secrets

Before adding variables, generate secure secrets:

**Option A: Use the helper script (recommended)**
```bash
npm run generate-secrets
```

**Option B: Generate manually**
```bash
# Generate SESSION_SECRET
node -e "console.log('SESSION_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"

# Generate JWT_SECRET (use a different value)
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
```

### Step 2: Add Variables in Vercel Dashboard

1. Go to: https://vercel.com/raxamaliks-projects/epml/settings/environment-variables
2. Click **"Add New"** for each variable
3. **Important**: Select all environments (Production, Preview, Development) or at least Production
4. Add each variable:

   | Variable Name | Value | Environment |
   |--------------|-------|-------------|
   | `DATABASE_URL` | Your production PostgreSQL URL | Production, Preview |
   | `SESSION_SECRET` | Generated secret (32+ chars) | Production, Preview, Development |
   | `NODE_ENV` | `production` | Production |
   | `JWT_SECRET` | Generated secret (different from SESSION_SECRET) | Production, Preview |
   | `SENDGRID_API_KEY` | Your SendGrid API key | Production, Preview |

### Step 3: Redeploy

Variables take effect on the next deployment:

**Option A: Via Dashboard**
- Go to your project → Deployments
- Click "..." on latest deployment → "Redeploy"

**Option B: Via CLI**
```bash
vercel --prod
```

### Step 4: Run Database Migrations

After deployment, ensure your database schema is up to date:

```bash
# Option 1: Pull env vars from Vercel and run migrations
vercel env pull .env.local
npm run db:push

# Option 2: Set DATABASE_URL manually
export DATABASE_URL="your-production-database-url"
npm run db:push
```

### Step 5: Test Your Deployment

1. Visit your deployment URL
2. Try signing up a new user
3. Try logging in
4. Check Vercel logs if anything fails

## Environment Variable Reference

Based on your local `.env` file, here's what to set in Vercel:

```bash
# ✅ REQUIRED - Set these in Vercel
DATABASE_URL=postgresql://postgres:password@your-production-db:5432/postgres
SESSION_SECRET=<generate-secure-32-char-secret>
NODE_ENV=production

# ✅ RECOMMENDED - Set these too
JWT_SECRET=<generate-different-secure-secret>
SENDGRID_API_KEY=<your-sendgrid-api-key>

# ⚠️ DON'T SET THESE IN VERCEL (local only)
# PORT=5000  # Vercel handles this automatically
# BASE_URL=...  # Vercel sets this automatically (or use your custom domain)
# PGHOST, PGUSER, etc.  # Only needed if not using DATABASE_URL
```

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

