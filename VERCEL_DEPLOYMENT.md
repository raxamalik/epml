# Vercel Deployment Guide

## Prerequisites

1. **Vercel Account**: Sign up at https://vercel.com
2. **GitHub/GitLab/Bitbucket**: Your code should be in a Git repository
3. **Environment Variables**: Prepare all required environment variables

## Deployment Steps

### Step 1: Install Vercel CLI (Optional)

```bash
npm i -g vercel
```

### Step 2: Configure Environment Variables

Before deploying, set these environment variables in Vercel Dashboard:

**Required Variables:**
- `DATABASE_URL` - Your Supabase PostgreSQL connection string
- `SESSION_SECRET` - A secure random string (generate with: `openssl rand -hex 32`)
- `NODE_ENV` - Set to `production`

**Optional Variables:**
- `JWT_SECRET` - JWT signing secret
- `SENDGRID_API_KEY` - For email functionality
- `BASE_URL` - Your Vercel deployment URL (auto-set by Vercel)

### Step 3: Deploy via Vercel Dashboard

1. **Go to Vercel Dashboard**: https://vercel.com/dashboard
2. **Click "Add New Project"**
3. **Import your Git repository**
4. **Configure Project Settings**:
   - **Framework Preset**: Other
   - **Root Directory**: `./` (root)
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist/public`
   - **Install Command**: `npm install`

5. **Add Environment Variables**:
   - Click "Environment Variables"
   - Add all required variables from Step 2

6. **Deploy**: Click "Deploy"

### Step 4: Deploy via CLI (Alternative)

```bash
# Login to Vercel
vercel login

# Deploy (follow prompts)
vercel

# Deploy to production
vercel --prod
```

## Project Structure for Vercel

```
EPML/
├── api/
│   └── index.ts          # Vercel serverless function handler
├── server/                # Express server code
├── client/                # React frontend
├── shared/                # Shared types/schema
├── vercel.json            # Vercel configuration
└── package.json
```

## Build Process

Vercel will automatically:
1. Run `npm install`
2. Run `npm run build` (builds frontend + backend)
3. Deploy static files from `dist/public`
4. Deploy serverless function from `api/index.ts`

## Environment Variables Setup

### In Vercel Dashboard:

1. Go to your project → Settings → Environment Variables
2. Add each variable for **Production**, **Preview**, and **Development**:

```
DATABASE_URL=postgresql://...
SESSION_SECRET=your-secret-key
NODE_ENV=production
JWT_SECRET=your-jwt-secret
SENDGRID_API_KEY=your-sendgrid-key (optional)
BASE_URL=https://your-app.vercel.app
```

## Database Migrations

After deployment, run migrations:

```bash
# Set environment variables locally
export DATABASE_URL="your-production-database-url"

# Run migrations
npm run db:push
```

Or use Vercel CLI:

```bash
vercel env pull .env.local
npm run db:push
```

## Troubleshooting

### Build Fails

1. **Check build logs** in Vercel Dashboard
2. **Verify Node.js version**: Vercel uses Node.js 20.x by default
3. **Check dependencies**: Ensure all dependencies are in `package.json`

### API Routes Not Working

1. **Check `vercel.json`** routing configuration
2. **Verify `api/index.ts`** exports default handler
3. **Check function logs** in Vercel Dashboard

### Database Connection Issues

1. **Verify `DATABASE_URL`** is set correctly in Vercel
2. **Check Supabase** allows connections from Vercel IPs
3. **Use connection pooler** for better performance

### Static Files Not Loading

1. **Verify build output** directory is `dist/public`
2. **Check `vite.config.ts`** build configuration
3. **Verify rewrites** in `vercel.json`

## Post-Deployment Checklist

- [ ] Environment variables are set
- [ ] Database migrations are run
- [ ] API routes are working (`/api/auth/user`)
- [ ] Frontend is loading correctly
- [ ] Static assets are served properly
- [ ] Database connection is working
- [ ] Sessions are persisting

## Custom Domain Setup

1. Go to Vercel Dashboard → Project → Settings → Domains
2. Add your custom domain
3. Update DNS records as instructed
4. Update `BASE_URL` environment variable

## Monitoring

- **Logs**: View in Vercel Dashboard → Project → Logs
- **Analytics**: Enable in Vercel Dashboard → Project → Analytics
- **Errors**: Check Vercel Dashboard → Project → Functions → Errors

## Performance Optimization

1. **Enable Edge Functions** for static routes (if needed)
2. **Use CDN** for static assets (automatic with Vercel)
3. **Optimize database queries** to reduce cold starts
4. **Enable caching** for API responses where appropriate

## Support

- Vercel Docs: https://vercel.com/docs
- Vercel Discord: https://vercel.com/discord
- Project Issues: Check GitHub repository

