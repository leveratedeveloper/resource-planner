# Resource Planner

A workforce management and resource allocation system for managing employee assignments, projects, campaigns, and time-off requests.

## Tech Stack

- **Framework**: Next.js 16.1.1
- **UI**: React 19, TypeScript, Tailwind CSS v4
- **Component Library**: shadcn/ui, Radix UI (primitives)
- **Validation**: Zod
- **Database**: PostgreSQL (Primary) / MySQL (Fallback)
  - PostgreSQL: Assignments database for employee-project allocations
  - MySQL: Local development fallback and proxy to Timetrack API
- **External Integration**: Timetrack API for authentication and employee data
- **State Management**: React Context (auth), TanStack Query (data fetching), Zustand (toast notifications)
- **Utilities**: date-fns (date handling), ExcelJS (export)
- **AI**: OpenAI (insights & recommendations)
- **Testing**: Vitest

## Architecture Overview

```
┌─────────────────┐
│  Resource       │
│  Planner        │
│  (Next.js)      │
└────────┬────────┘
         │
         ├─────────────────┬─────────────────┐
         │                 │                 │
         ▼                 ▼                 ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  Timetrack API  │ │  PostgreSQL     │ │  OpenAI API     │
│  (Auth/Employees)│ │  (Assignments)  │ │  (AI Insights   │
│  (Brands/Projects)│ │                 │ │   via gpt-4o)   │
└─────────────────┘ └─────────────────┘ └─────────────────┘
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
- **Project Type Support**: Campaigns, Operational, and R&D project types with type-specific management
- **Pagination & Incremental Loading**: Efficient data loading for large datasets with infinite scroll
- **Deliverables Management**: Task-level deliverables per project assignment
- **HubSpot Integration**: Pitch tracking with deal IDs
- **Today Marker**: Visual indicator for current date
- **Weekend Toggle**: Show/hide weekends in timeline views

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** v20 or higher
- **PostgreSQL** (local instance or Vercel Postgres / Supabase)
- **Timetrack API** connectivity to `https://demo.timetrack.id/api/v1` (required before starting)

## Environment Configuration

### Local Development
- **Resource Planner**: http://localhost:3000
- **Timetrack API**: https://demo.timetrack.id/api/v1

### Staging
- **Resource Planner**: [https://resource-planner-drab.vercel.app/](https://resource-planner-drab.vercel.app/)
  - Deployed from: `https://github.com/Sarah27-dotcom/resource-planner.git`
  - Branch: `develop-sarah`
  - Database: Vercel Postgres / Supabase
- **Timetrack API**: https://demo.timetrack.id/api/v1

## Step-by-Step Setup Guide

### Step 1: Install Dependencies

```bash
npm install
```

### Step 2: Verify Timetrack API Connectivity

Resource Planner connects directly to the Timetrack API at `https://demo.timetrack.id/api/v1`. It provides:
- User authentication (login)
- Employee data (department, position for RBAC)
- Brand and Project data

Verify connectivity:
```bash
curl https://demo.timetrack.id/api/v1
```

### Step 3: Set Up PostgreSQL Database (Assignments)

Resource Planner uses a PostgreSQL database for storing assignments.

1. **Create/Import Database**:
   Import the `resource_planner_assignments` database dump into your PostgreSQL instance.

2. **Manual Schema Setup (If no dump available)**:
   ```bash
   psql your_database_url < lib/mysql-assignments/schema.postgres.sql
   ```

This database stores:
- Table: `assignments` (for employee-project allocations/plan)
- Table: `actual` (for actual time spent/allocation)

### Step 4: Configure Environment Variables

1. **Copy the example environment file**:
   ```bash
   cp .env.example .env.local
   ```

2. **Edit `.env.local`** with your actual values:

   ```bash
   # ==========================================
   # NextAuth Configuration (Legacy - Not Currently Used)
   # ==========================================
   # NEXTAUTH_SECRET=
   # NEXTAUTH_URL=http://localhost:3000/

   # ==========================================
   # OpenAI Configuration
   # ==========================================
   OPENAI_API_KEY=

   # ==========================================
   # Timetrack API Configuration (Required)
   # ==========================================
   TIMETRACK_API_URL=https://demo.timetrack.id/api/v1

   # ==========================================
   # MySQL API Authentication (service account for server-side API calls)
   # ==========================================
   MYSQL_API_USERNAME=
   MYSQL_API_PASSWORD=
   MYSQL_API_TOKEN_EXPIRY_MS=3600000

   # ==========================================
   # API Security
   # ==========================================
   API_SECRET_KEY=
   INSIGHTS_API_TOKEN=

   # ==========================================
   # PostgreSQL Assignments Database (Primary)
   # ==========================================
   DATABASE_URL=

   # ==========================================
   # MySQL Assignments Database (Fallback - for local development)
   # These are used in code but not in .env.example
   # ==========================================
   # MYSQL_ASSIGNMENTS_HOST=127.0.0.1
   # MYSQL_ASSIGNMENTS_PORT=3306
   # MYSQL_ASSIGNMENTS_USER=root
   # MYSQL_ASSIGNMENTS_PASSWORD=
   # MYSQL_ASSIGNMENTS_DATABASE=resource_planner_assignments
   ```

### Step 5: Import Existing Data (Optional)

Use the bulk import API endpoint to import assignments from an Excel file:
- `POST /api/import-assignments` -- accepts an Excel file upload
- Expected sheet format: sheets named by month (e.g. "Jan 25", "Feb 25")

### Step 6: Start Development Server

```bash
npm run dev
```

1. Open [http://localhost:3000](http://localhost:3000) in your browser
2. Login with the credentials provided below.

## Credentials & Login

> **Security Warning**: The credentials listed below are for **local development only**. For staging and production environments, always use environment variables and never commit credentials to source control. Rotate any credentials that have been exposed in documentation or version control.

### Local Development
| Environment | Email | Password |
|-------------|-------|----------|
| **Resource Planner (Local)** | `test.brand@leverategroup.asia` | `password` |
| **Timetrack API (Local)** | `super@timetrack.id` | `SEMOGABERKAH2023!#` |

### Staging / Demo
| Environment | URL | Email | Password |
|-------------|-----|-------|----------|
| **Resource Planner (Vercel)** | [resource-planner-drab.vercel.app](https://resource-planner-drab.vercel.app/) | `super@timetrack.id` | `SEMOGABERKAH2023!#` |
| **Timetrack Demo** | [demo.timetrack.id](https://demo.timetrack.id/) | `super@timetrack.id` | `SEMOGABERKAH2023!#` |

## User Task Flows

### Project Team Assignment

Flow untuk mengelola team assignment pada sebuah project/campaign.

1. **Login** — Buka app, login dengan akun yang punya **Full Access** (e.g. `super@timetrack.id`). User dengan role Restricted Access tidak bisa mengakses Setup.
2. **Buka Setup** — Klik tombol **"Setup"** di header/navbar dari halaman utama (Timeline). Ini membuka Setup Manager modal.
3. **Pilih Tab Projects** — Di Setup modal, klik tab **"Projects"** untuk melihat daftar semua project.
4. **Pilih Project** — Cari atau klik salah satu project dari daftar. Projects di-group berdasarkan brand untuk memudahkan navigasi.
5. **Project Detail** — Dialog project detail terbuka, menampilkan informasi project (nama, brand, budget, tanggal) dan daftar team yang sudah di-assign.
6. **Manage Team** — Klik tombol **"Manage Team"** atau **"Assign Team"** untuk membuka Assign Employees Dialog.
7. **Assign Team Members** — Pilih employee dari daftar available employees, lalu klik **Assign** untuk menambahkan ke project.
8. **Set Date Range** — Tentukan **start date** dan **end date** untuk setiap assignment employee ke project.
9. **Pilih Deliverables** — Untuk setiap assigned member, pilih deliverables yang relevan via popover/checkbox (e.g. Design, Development, Strategy, dll).
10. **Save Team Assignment** — Klik **Save** untuk menyimpan semua assignment ke database PostgreSQL. Data assignment akan langsung terlihat di Timeline view.

> **Komponen terkait**: `SetupManager.tsx`, `ProjectSetup.tsx`, `AssignEmployeesDialog.tsx`

## Available NPM Scripts

```bash
# Development
npm run dev          # Start development server (http://localhost:3000)
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint

# Database Migrations
npm run migration:add-total-hours    # Add total_hours column to assignments
npm run migration:add-is-adjustment  # Add is_adjustment column to assignments

# Testing
npm run test         # Run tests
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Run tests with coverage report
```

## Troubleshooting

### Timetrack API Not Responding
**Problem**: Resource Planner can't connect to Timetrack API

**Solutions**:
- Verify connectivity: `curl https://demo.timetrack.id/api/v1`
- Check that `TIMETRACK_API_URL` in `.env.local` is set to `https://demo.timetrack.id/api/v1`
- Check network/firewall settings

### Database Connection Errors
**Problem**: Can't connect to PostgreSQL or MySQL

**Solutions**:
- Verify PostgreSQL is running: `pg_isready` or `psql -U postgres -c "SELECT 1;"`
- Verify MySQL is running (fallback): `mysql -u root -p -e "SHOW DATABASES;"`
- Check `DATABASE_URL` (PostgreSQL) and MySQL credentials in `.env.local`
- Ensure `resource_planner_assignments` database exists

### Authentication Not Working
**Problem**: Login fails or session not persisting

**Solutions**:
- Verify Timetrack API is reachable: `curl https://demo.timetrack.id/api/v1`
- Check that `TIMETRACK_API_URL` is set correctly in `.env.local`
- Verify your credentials work by testing directly against Timetrack API
- Check browser developer tools for the `session` cookie (httpOnly)
- Check server logs for authentication error messages

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

**PostgreSQL** (Primary - Assignments & Operational Data):
- Assignments (employee-project allocations with deliverables)
- Actual time tracking (time spent/allocation records)
- Deliverables (task-level deliverables per project assignment)
- Supports operational, campaign, and R&D project types

**MySQL** (Fallback & Proxy):
- Used as local development fallback when PostgreSQL is unavailable
- MySQL Bridge API routes proxy requests to Timetrack API
- Not used for primary data storage in production

**OpenAI API** (AI Insights):
- Powers capacity analysis, conflict detection, and forecasting
- Uses GPT-4o model for recommendations
- Triggered via `/api/insights` endpoint

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
TIMETRACK_API_URL=https://demo.timetrack.id/api/v1
MYSQL_API_USERNAME=super@timetrack.id
MYSQL_API_PASSWORD=your-password-here
MYSQL_API_TOKEN_EXPIRY_MS=3600000
```

#### Authentication Flow

1. **Login**: User submits email/password via `/api/auth/login`, which proxies to Timetrack API `POST /login`
2. **Session**: On success, an httpOnly cookie named `session` is set containing JSON user data (not JWT, not NextAuth)
3. **Session Duration**: Cookie expires after 7 days
4. **Access Level**: Determined by user's department and position via hardcoded rules (Full Access vs Restricted Access)
5. **Server-side API Calls**: The server uses service account credentials (`MYSQL_API_USERNAME`/`MYSQL_API_PASSWORD`) to obtain a Bearer token for Timetrack API requests; token auto-refreshes on expiry (default: 1 hour)

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

#### Key Implementation Files

- `lib/mysql/api-client.ts` - Main API client with authentication
- `lib/mysql/auth.ts` - Token management and login
- `app/api/brands/route.ts` - Brands API endpoint
- `app/api/projects/route.ts` - Projects API endpoint

### API Routes

#### Authentication

| Route | Method | Description |
|-------|--------|-------------|
| `/api/auth/login` | POST | User authentication with email/password |
| `/api/auth/logout` | POST | End user session |
| `/api/auth/me` | GET | Get current authenticated user |

#### Core Data

| Route | Method | Description |
|-------|--------|-------------|
| `/api/assignments` | GET, POST | List (paginated) and create assignments |
| `/api/assignments/[id]` | GET, PUT, DELETE | Get, update, or delete a single assignment |
| `/api/actual` | GET, POST | List and create actual time records |
| `/api/actual/[uuid]` | GET, PUT, DELETE | Get, update, or delete an actual time record |
| `/api/projects` | GET | List all projects (campaigns + pitches) |
| `/api/projects/[type]/[id]/deliverables` | GET, POST | Manage deliverables for a project (campaign/operational/rnd) |
| `/api/employees` | GET | List employees with RBAC data |
| `/api/brands` | GET | List brands (1 min cache) |
| `/api/brands/lookup` | GET | Brand lookup by name or ID |
| `/api/departments` | GET | List departments |
| `/api/business-units` | GET | List business units |
| `/api/deliverables` | GET | List deliverable templates |
| `/api/project-categories` | GET | List project categories |
| `/api/channel-classifications` | GET | List channel classifications |

#### MySQL Bridge (Timetrack Proxy)

| Route | Method | Description |
|-------|--------|-------------|
| `/api/mysql-bridge/brands` | GET | Proxy to Timetrack brands API |
| `/api/mysql-bridge/campaigns` | GET | Proxy to Timetrack campaigns API |
| `/api/mysql-bridge/employees` | GET | Proxy to Timetrack employees API |
| `/api/mysql-bridge/assignments` | GET | Proxy to Timetrack assignments API |

#### Export

| Route | Method | Description |
|-------|--------|-------------|
| `/api/export/assignments` | GET | Export assignments data |
| `/api/export/projects` | GET | Export projects data |
| `/api/export/utilization` | GET | Export utilization report |
| `/api/export/conflicts` | GET | Export conflict report |
| `/api/export/assignments/excel` | GET | Excel export for assignments |
| `/api/export/projects/excel` | GET | Excel export for projects |
| `/api/export/utilization/excel` | GET | Excel export for utilization |
| `/api/export/conflicts/excel` | GET | Excel export for conflicts |

> **Note**: Some routes have POST stubs returning 501 Not Implemented: `/api/employees`, `/api/departments`, `/api/business-units`, `/api/project-categories`, `/api/deliverables`.
>
> Some test/debug routes exist but are not documented (development only).

#### AI Insights

| Route | Method | Description |
|-------|--------|-------------|
| `/api/insights` | POST | AI-powered capacity analysis and recommendations |

#### Import

| Route | Method | Description |
|-------|--------|-------------|
| `/api/import-assignments` | POST | Bulk import assignments from file |

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
   git clone https://github.com/hfebri/resource-planner.git
   cd resource-planner
   git checkout develop-sarah

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
