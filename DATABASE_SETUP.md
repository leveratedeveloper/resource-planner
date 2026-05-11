# Database Setup Guide

## Overview

This project supports dual database configuration:
- **Local Development**: MySQL
- **Vercel Production**: PostgreSQL (Vercel Postgres / Supabase)

## Local Setup (MySQL)

### 1. Install MySQL
```bash
# Windows: Download from https://dev.mysql.com/downloads/mysql/
# Mac: brew install mysql
# Linux: sudo apt-get install mysql-server
```

### 2. Create Database
```sql
CREATE DATABASE resource_planner_assignments;
```

Or run the schema file:
```bash
mysql -u root -p < lib/mysql-assignments/schema.sql
```

### 3. Environment Variables (`.env.local`)
```bash
# MySQL Assignments Database
MYSQL_ASSIGNMENTS_HOST=127.0.0.1
MYSQL_ASSIGNMENTS_PORT=3306
MYSQL_ASSIGNMENTS_USER=root
MYSQL_ASSIGNMENTS_PASSWORD=your_password
MYSQL_ASSIGNMENTS_DATABASE=resource_planner_assignments
```

## Vercel Setup (PostgreSQL)

### 1. Create Vercel Postgres Database
1. Go to Vercel Dashboard → Your Project → Storage
2. Click "Create Database" → "Postgres"
3. Follow the setup wizard

### 2. Link Database to Project
```bash
vercel link
vercel postgres pull
```

This will automatically add `DATABASE_URL` to your Vercel environment variables.

### 3. Run Schema on PostgreSQL
```bash
# Connect to your Vercel Postgres and run:
psql $DATABASE_URL < lib/mysql-assignments/schema.postgres.sql
```

Or use Vercel CLI:
```bash
vercel postgres execute --file lib/mysql-assignments/schema.postgres.sql
```

## Environment Variables

| Variable | Local | Vercel |
|----------|-------|--------|
| `MYSQL_ASSIGNMENTS_HOST` | ✅ Required | ❌ Not used |
| `MYSQL_ASSIGNMENTS_PORT` | ✅ Required | ❌ Not used |
| `MYSQL_ASSIGNMENTS_USER` | ✅ Required | ❌ Not used |
| `MYSQL_ASSIGNMENTS_PASSWORD` | ✅ Required | ❌ Not used |
| `MYSQL_ASSIGNMENTS_DATABASE` | ✅ Required | ❌ Not used |
| `DATABASE_URL` | ❌ Not used | ✅ Auto-added by Vercel |
| `POSTGRES_URL` | ❌ Not used | ✅ Alternative to DATABASE_URL |

## How It Works

The database client (`lib/mysql-assignments/db.ts`) automatically detects which database to use:

```typescript
// If DATABASE_URL exists → use PostgreSQL
// Otherwise → use MySQL
```

## Testing Connection

```bash
# Test local MySQL connection
node -e "require('./lib/mysql-assignments/db.ts').testConnection()"

# Or use the debug endpoint
curl http://localhost:3000/api/debug-assignments
```

## Migrating Data

If you need to migrate from MySQL to PostgreSQL:

```bash
# Export from MySQL
mysqldump -u root -p resource_planner_assignments > mysql_dump.sql

# Import to PostgreSQL (manual conversion needed)
psql $DATABASE_URL < converted_postgres_dump.sql
```

## Troubleshooting

### Local: MySQL connection failed
- Check if MySQL is running: `mysql -u root -p`
- Verify credentials in `.env.local`

### Vercel: PostgreSQL connection failed
- Check Vercel dashboard for database status
- Verify `DATABASE_URL` is set in project settings
- Check Vercel function logs for errors
