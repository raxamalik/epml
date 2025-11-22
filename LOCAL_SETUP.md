# Local Development Setup Guide

This guide will help you set up the project on your local machine using proper environment variable management.

## Prerequisites

- Node.js (version 16 or higher)
- PostgreSQL database
- Git

## Setup Steps

### 1. Clone and Install Dependencies

```bash
git clone <your-repository>
cd <your-project>
npm install
```

### 2. Environment Configuration

1. Copy the example environment file:
```bash
cp .env.example .env
```

2. Edit the `.env` file with your local configuration:

```env
# Database Configuration
DATABASE_URL=postgresql://your_username:your_password@localhost:5432/your_database_name

# PostgreSQL Connection Details (alternative to DATABASE_URL)
PGUSER=your_username
PGHOST=localhost
PGPASSWORD=your_password
PGDATABASE=your_database_name
PGPORT=5432

# Session Configuration (generate a random string)
SESSION_SECRET=your-random-session-secret-key-at-least-32-characters

# Development Environment
NODE_ENV=development

# Server Configuration
PORT=5000
```

### 3. Database Setup

#### Option A: Using PostgreSQL locally

1. Install PostgreSQL on your system
2. Create a database:
```sql
CREATE DATABASE your_database_name;
```

3. Update your `.env` file with the correct database credentials

#### Option B: Using Docker (PostgreSQL)

```bash
docker run --name postgres-dev \
  -e POSTGRES_PASSWORD=your_password \
  -e POSTGRES_DB=your_database_name \
  -p 5432:5432 \
  -d postgres:15
```

### 4. Generate Session Secret

Generate a secure session secret:

```bash
# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Or using OpenSSL
openssl rand -hex 32
```

Add this to your `.env` file as `SESSION_SECRET`.

### 5. Database Setup

#### For Fresh Database Setup
Run the database migration to create tables:

```bash
npm run db:push
```

#### To Restore Your Existing Data

**IMPORTANT**: If you had existing data before, the application is currently using temporary in-memory storage. To restore your database:

1. **If you have a database backup:**
   ```bash
   # Restore from SQL dump
   psql postgresql://username:password@localhost:5432/database_name < your_backup.sql
   ```

2. **If your data was on a hosted service (Neon, Supabase, etc.):**
   - Update your `.env` file with the correct DATABASE_URL
   - The hosted database might be temporarily unavailable

3. **Switch back to database storage:**
   Edit `server/storage.ts` and change:
   ```typescript
   // From:
   export const storage = new MemoryStorage();
   
   // To:
   export const storage = new DatabaseStorage();
   ```

4. **Restart the application:**
   ```bash
   npm run dev
   ```

### 6. Start Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:5000`

## Environment Variables Reference

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `DATABASE_URL` | Yes* | Complete PostgreSQL connection string | `postgresql://user:pass@localhost:5432/db` |
| `PGUSER` | Yes* | PostgreSQL username | `postgres` |
| `PGHOST` | Yes* | PostgreSQL host | `localhost` |
| `PGPASSWORD` | Yes* | PostgreSQL password | `mypassword` |
| `PGDATABASE` | Yes* | PostgreSQL database name | `myapp` |
| `PGPORT` | No | PostgreSQL port | `5432` |
| `SESSION_SECRET` | Yes | Secret key for sessions | `abc123...` |
| `NODE_ENV` | No | Environment mode | `development` |
| `PORT` | No | Server port | `5000` |

*Either `DATABASE_URL` OR the individual `PG*` variables are required.

## Common Issues and Solutions

### Database Connection Issues

1. **Connection refused**: Ensure PostgreSQL is running
2. **Authentication failed**: Check username/password in `.env`
3. **Database not found**: Create the database first
4. **Port conflicts**: Change the PORT in `.env` if 5000 is occupied

### Environment Variables Not Loading

1. Ensure `.env` file is in the project root
2. Check that dotenv is properly imported in `server/index.ts`
3. Restart the development server after changing `.env`

### Session Issues

1. Generate a proper SESSION_SECRET (at least 32 characters)
2. Ensure the secret is set in your `.env` file

## Production Deployment

For production deployment:

1. Set `NODE_ENV=production`
2. Use a secure session secret
3. Enable SSL for your database connection
4. Use environment variables instead of `.env` files
5. Ensure proper security headers and HTTPS

## Security Notes

- Never commit `.env` files to version control
- Use strong, unique session secrets
- Regularly rotate credentials
- Use SSL/TLS for database connections in production
- Keep dependencies updated