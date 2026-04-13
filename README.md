# Resource Planner

A workforce management and resource allocation system for managing employee assignments, projects, campaigns, and time-off requests.

## Tech Stack

- **Framework**: Next.js 16.1.1
- **UI**: React 19, TypeScript, Tailwind CSS v4
- **Database**: MySQL
  - Main data via Timetrack API (employees, brands, projects, campaigns)
  - Assignments database for employee-project allocations
- **External Integration**: Timetrack API for authentication and employee data
- **State Management**: Zustand, TanStack Query
- **Testing**: Vitest

## Architecture Overview

```
┌─────────────────┐
│  Resource       │
│  Planner        │
│  (Next.js)      │
└────────┬────────┘
         │
         ├─────────────────┐
         │                 │
         ▼                 ▼
┌─────────────────┐ ┌─────────────────┐
│  Timetrack API  │ │  MySQL          │
│  (Auth/Employees)│ │  (Assignments)  │
│  (Brands/Projects)│ │                 │
└─────────────────┘ └─────────────────┘
```

## Features

### Core Features

- **Timeline View**: Visual timeline for employee assignments with multiple views (week, month, quarter, half-year, year)
- **Assignment Management**: Create, edit, and manage employee-project assignments with drag & drop
- **Time-off Management**: Handle employee leave requests and time-off assignments
- **Resource Filtering**: Filter by brand, department, project, category, status, and search queries
- **AI Insights**: Capacity analysis, conflict detection, and forecasting with AI-powered recommendations
- **Brand & Client Management**: Manage brands, business units, and departments
- **Project Management**: Handle campaigns and pitches with budget tracking
- **Employee Management**: Directory with RBAC (Full Access vs Restricted Access)
- **Reporting & Export**: Excel/CSV exports for assignments, conflicts, projects, and utilization
- **HubSpot Integration**: Pitch tracking with deal IDs
- **Today Marker**: Visual indicator for current date
- **Weekend Toggle**: Show/hide weekends in timeline views

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** v20 or higher
- **MySQL Server** (local instance for assignments database)
- **Timetrack API** running locally on port 8000 (required before starting)

## Environment Configuration

### Local Development
- **Resource Planner**: http://localhost:3000
- **Timetrack API**: http://127.0.0.1:8000/api/v1

### Staging
- **Resource Planner**: https://resource-planner-drab.vercel.app/
- **Timetrack API**: https://demo.timetrack.id/api/v1

## Step-by-Step Setup Guide

### Step 1: Install Dependencies

```bash
npm install
```

### Step 2: Ensure Timetrack API is Running ⚠️ **IMPORTANT**

The Timetrack API **must be running BEFORE** starting Resource Planner. It provides:
- User authentication (login)
- Employee data (department, position for RBAC)

#### Setting Up Timetrack API Locally

1. **Clone the timetrack repository** (if you haven't already):
   ```bash
   git clone https://gitlab.com/developerleverate/timetrack.git
   cd timetrack
   ```

2. **Configure the `.env` file** in the timetrack directory:
   ```bash
   # Timetrack .env configuration
   APP_NAME=Laravel
   APP_ENV=local
   APP_KEY=base64:GsYzXDEQ7uaUwZzAUGpAc4Z0o80m7Vs2DzYAL528EzE=
   APP_URL=http://localhost

   DB_CONNECTION=mysql
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_DATABASE=timetrack1
   DB_USERNAME=root
   DB_PASSWORD=

   BROADCAST_DRIVER=log
   CACHE_DRIVER=file
   QUEUE_CONNECTION=sync
   SESSION_DRIVER=file
   SESSION_LIFETIME=120

   REDIS_HOST=127.0.0.1
   REDIS_PASSWORD=null
   REDIS_PORT=6379

   # Mailhog for email testing (local)
   MAIL_MAILER=smtp
   MAIL_HOST=mailhog
   MAIL_PORT=1025
   MAIL_USERNAME=null
   MAIL_PASSWORD=null
   MAIL_ENCRYPTION=null
   ```

3. **Install dependencies and run migrations**:
   ```bash
   composer install
   php artisan migrate
   ```

4. **Start the Timetrack server**:
   ```bash
   php artisan serve
   ```

5. **Verify Timetrack is running**:
   ```bash
   curl http://127.0.0.1:8000/api/v1
   ```

   You should see a response from the API. Keep this server running in the background.

### Step 3: Set Up MySQL Database (Assignments)

Create the MySQL database for assignments:

```bash
# Create the assignments database
mysql -u root -p < lib/mysql-assignments/schema.sql
```

This creates:
- Database: `resource_planner_assignments`
- Table: `assignments` (for employee-project allocations)

### Step 4: Configure Environment Variables

1. **Copy the example environment file**:
   ```bash
   cp .env.example .env.local
   ```

2. **Edit `.env.local`** with your actual values:

   ```bash
   # ==========================================
   # Timetrack API Configuration (Required)
   # ==========================================
   TIMETRACK_API_URL=http://127.0.0.1:8000/api/v1

   # ==========================================
   # MySQL REST API Configuration
   # ==========================================
   MYSQL_API_BASE_URL=http://127.0.0.1:8000/api/v1
   MYSQL_API_USERNAME=super@timetrack.id
   MYSQL_API_PASSWORD=your-mysql-api-password
   MYSQL_API_TOKEN_EXPIRY_MS=3600000

   # ==========================================
   # MySQL Assignments Database Connection
   # ==========================================
   MYSQL_ASSIGNMENTS_HOST=127.0.0.1
   MYSQL_ASSIGNMENTS_PORT=3306
   MYSQL_ASSIGNMENTS_USER=root
   MYSQL_ASSIGNMENTS_PASSWORD=
   MYSQL_ASSIGNMENTS_DATABASE=resource_planner_assignments

   # ==========================================
   # Email Server Configuration (for authentication)
   # ==========================================
   # Option 1: Gmail (Recommended for testing)
   # 1. Enable 2FA on your Gmail account
   # 2. Create an App Password: Google Account -> Security -> App Passwords
   # 3. Use App Password as EMAIL_SERVER_PASSWORD
   EMAIL_SERVER_HOST=smtp.gmail.com
   EMAIL_SERVER_PORT=587
   EMAIL_SERVER_USER=your-email@leverategroup.asia
   EMAIL_SERVER_PASSWORD=your-gmail-app-password
   EMAIL_FROM="Resource Planner <your-email@leverategroup.asia>"

   # Option 2: Resend (Recommended for production)
   # EMAIL_SERVER_HOST=smtp.resend.com
   # EMAIL_SERVER_PORT=587
   # EMAIL_SERVER_USER=resend
   # EMAIL_SERVER_PASSWORD=your-resend-api-key
   # EMAIL_FROM="Resource Planner <noreply@leverategroup.asia>"

   # Option 3: Company SMTP Server
   # EMAIL_SERVER_HOST=smtp.your-company.com
   # EMAIL_SERVER_PORT=587
   # EMAIL_SERVER_USER=your-smtp-username
   # EMAIL_SERVER_PASSWORD=your-smtp-password
   # EMAIL_FROM="Resource Planner <noreply@leverategroup.asia>"

   # ==========================================
   # NextAuth Configuration (Legacy - Not Currently Used)
   # ==========================================
   NEXTAUTH_SECRET=your-nextauth-secret-here-generate-with-openssl-rand-base64-32
   NEXTAUTH_URL=http://localhost:3000
   ```

### Step 5: Start Development Server

If you have a Timetrack SQL dump and want to import existing data:

```bash
# Import all data
npx tsx lib/db/import-from-timetrack.ts

# Import with limits (useful for testing)
npx tsx lib/db/import-from-timetrack.ts --limit-employees 50 --limit-brands 20
```

### Step 7: Start Development Server

```bash
npm run dev
```

1. Open [http://localhost:3000](http://localhost:3000) in your browser
2. Login with your Timetrack credentials
3. Start managing resources!

## Available NPM Scripts

```bash
# Development
npm run dev          # Start development server (http://localhost:3000)
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint

# Testing
npm run test         # Run tests
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Run tests with coverage report
```

## Troubleshooting

### Timetrack API Not Responding
**Problem**: Resource Planner can't connect to Timetrack API

**Solutions**:
- Ensure Timetrack is running: `curl http://127.0.0.1:8000/api/v1`
- Check that `TIMETRACK_API_URL` in `.env.local` points to `http://127.0.0.1:8000/api/v1`
- Verify Timetrack server is running on port 8000
- Check Timetrack logs for errors

### Database Connection Errors
**Problem**: Can't connect to MySQL

**Solutions**:
- Verify MySQL is running: `mysql -u root -p -e "SHOW DATABASES;"`
- Check database credentials in `.env.local`
- Ensure `resource_planner_assignments` database exists

### Authentication Not Working
**Problem**: Login fails or magic links not sending

**Solutions**:
- Check email server settings in `.env.local`
- For Gmail: Ensure you're using an App Password (not your regular password)
- Check spam folder for magic link emails
- Verify email format is correct
- Check server logs for error messages

### Port Already in Use
**Problem**: Error starting development server

**Solutions**:
- Change Next.js port: `npm run dev -- -p 3001`
- Kill process using port 3000: `npx kill-port 3000` (Windows: use Task Manager)

## Project Architecture

### Data Sources

**Timetrack API** (Main Data via REST API):
- Employees (with department, position for RBAC)
- Brands (with company info, contacts, industry)
- Campaigns (with budget tracking: budget, ASF, grand total)
- Pitches (with status tracking: on_going, win, loss)
- Authentication (login with email/password)

**MySQL** (Operational Data):
- Assignments (employee-project allocations)
- Time-off requests
- Other transactional data

### Timetrack API Integration

The Resource Planner fetches the following data from the Timetrack API:

#### Data Fetched from Timetrack

| Data Type | API Endpoint | Description |
|-----------|-------------|-------------|
| **Brands** | `GET /api/v1/brands` | Client brands with company info, contacts, industry |
| **Campaigns** | `GET /api/v1/campaigns` | Active campaigns with budget tracking (budget, ASF, grand total) |
| **Pitches** | `GET /api/v1/pitches` | Sales pitches with status tracking (on_going, win, loss) |
| **Employees** | `GET /api/v1/employees` | Employee data for RBAC (department, position, role) |
| **Authentication** | `POST /api/v1/login` | User authentication via email/password |

#### API Configuration

Environment variables (`.env.local`):
```bash
TIMETRACK_API_URL=http://127.0.0.1:8000/api/v1
MYSQL_API_USERNAME=super@timetrack.id
MYSQL_API_PASSWORD=your-password-here
MYSQL_API_TOKEN_EXPIRY_MS=3600000
```

#### Authentication Flow

1. **Login**: Resource Planner authenticates with Timetrack using service account credentials
2. **Token Storage**: Access token is stored and reused for subsequent requests
3. **Token Refresh**: Token automatically refreshes on expiry (default: 1 hour)
4. **Request Headers**: All API calls include `Authorization: Bearer {token}` header

#### API Response Format

```typescript
interface ApiResponse<T> {
  status: number;
  success: boolean;
  message: string;
  data: T;
  meta?: {
    current_page: number;
    per_page: number;
    total: number;
    last_page: number;
  };
}
```

#### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | number | Page number for pagination (default: 1) |
| `per_page` | number | Items per page (default: 15) |
| `search` | string | Full-text search query |
| `brand_id` | string | Filter by brand UUID |
| `include` | string | Include related entities (e.g., "brand,company") |

#### Data Structures

**Brand:**
```typescript
{
  uuid: string;
  brand_name: string;
  company_name: string;
  client_code: string;
  industry_category: string;
  pic_brand_name: string;
  pic_email: string;
  flag: 'active' | 'inactive';
}
```

**Campaign:**
```typescript
{
  uuid: string;
  io_number: string;
  campaign_name: string;
  brand_id: number;
  budget: number;
  asf: number;
  grand_total: number;
  start_date: string;
  end_date: string;
  state: 'draft' | 'publish' | 'archive';
}
```

**Pitch:**
```typescript
{
  uuid: string;
  pitch_number: string;
  pitch_name: string;
  brand_id: number;
  status: 'on_going' | 'win' | 'loss';
  budget: number;
  value_total: number;
  region: 'ID' | 'SG';
}
```

#### API Routes in Resource Planner

- `/api/brands` - Brands endpoint with caching (1 min cache)
- `/api/projects` - Combined campaigns + pitches endpoint
- `/api/mysql-bridge/brands` - Direct proxy to Timetrack brands API
- `/api/mysql-bridge/campaigns` - Direct proxy to Timetrack campaigns API
- `/api/mysql-bridge/pitches` - Direct proxy to Timetrack pitches API

#### Key Implementation Files

- `lib/mysql/api-client.ts` - Main API client with authentication
- `lib/mysql/auth.ts` - Token management and login
- `app/api/brands/route.ts` - Brands API endpoint
- `app/api/projects/route.ts` - Projects API endpoint

## Development Workflow

1. **Make changes** to source code
2. **Test locally** with `npm run dev`
3. **Run tests** with `npm run test`
4. **Build** with `npm run build` to check for production issues
5. **Commit** your changes

## Contributing

We welcome contributions to the Resource Planner project! Please follow these guidelines:

### Development Workflow

1. **Fork and Clone**
   ```bash
   git clone https://github.com/your-username/resource-planner.git
   cd resource-planner
   ```

2. **Create a Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make Changes and Test**
   ```bash
   npm run dev          # Start development server
   npm run test         # Run tests
   npm run lint         # Check code quality
   npm run build        # Verify production build
   ```

4. **Commit Your Changes**
   ```bash
   git add .
   git commit -m "feat: description of your changes"
   ```

5. **Push and Create Pull Request**
   ```bash
   git push origin feature/your-feature-name
   ```

### Code Style

- Use TypeScript for all new files
- Follow existing code patterns and conventions
- Use Tailwind CSS v4 for styling
- Write meaningful commit messages using conventional commits:
  - `feat:` for new features
  - `fix:` for bug fixes
  - `docs:` for documentation changes
  - `refactor:` for code refactoring
  - `test:` for adding tests
  - `chore:` for maintenance tasks

### Testing

- Write tests for new features using Vitest
- Ensure all tests pass before submitting PR
- Test manually in the browser for UI changes

### Pull Request Guidelines

- Provide a clear description of changes
- Reference related issues (if any)
- Ensure all CI checks pass
- Request review from at least one team member

### Questions?

Contact the development team for clarification or guidance.

## License

Proprietary - Leverate Group

## Support

For issues and questions, contact the development team.
