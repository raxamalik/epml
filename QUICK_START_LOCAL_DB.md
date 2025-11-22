# Quick Start: Local Database Setup

## ✅ Step 1: Create Database (Run in Terminal)

Copy and paste these commands one by one:

```bash
# Create user
sudo -u postgres psql -c "CREATE USER epml_user WITH PASSWORD 'epml_local_password_123';"

# Create database
sudo -u postgres psql -c "CREATE DATABASE epml OWNER epml_user;"

# Grant privileges
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE epml TO epml_user;"

# Grant schema privileges
sudo -u postgres psql -d epml -c "GRANT ALL ON SCHEMA public TO epml_user;"
```

## ✅ Step 2: Verify .env.local is Updated

The `.env.local` file has been updated to use:
- **Database:** `epml`
- **User:** `epml_user`
- **Password:** `epml_local_password_123`
- **Host:** `localhost`
- **Port:** `5432`

## ✅ Step 3: Restart Server

```bash
npm run dev
```

You should see: `Database connection successful`

## ✅ Step 4: Run Migrations

```bash
npm run db:push
```

This will create all the tables (users, companies, sessions, etc.)

## ✅ Step 5: Test Login/Signup

1. Open browser: http://localhost:5000
2. Click "Sign Up" tab
3. Create a new account
4. Try logging in

## 🎉 Done!

Your app is now using a local PostgreSQL database. No more IPv6 issues!

## Troubleshooting

### "role epml_user does not exist"
Run: `sudo -u postgres psql -c "CREATE USER epml_user WITH PASSWORD 'epml_local_password_123';"`

### "database epml does not exist"
Run: `sudo -u postgres psql -c "CREATE DATABASE epml OWNER epml_user;"`

### "password authentication failed"
Check that the password in `.env.local` matches: `epml_local_password_123`

### Still connecting to Supabase?
Make sure the local `DATABASE_URL` comes AFTER the commented Supabase one in `.env.local`

