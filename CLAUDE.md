# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
This is a Scooter Rental Management System built with React and Vite. It uses Supabase as the backend database and features a calendar-based rental management interface with real-time statistics.

## Development Commands
```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build
```

## Architecture Overview

### Tech Stack
- **Frontend**: React 18 with Vite
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **UI Components**: Custom components with Lucide React icons
- **Calendar**: react-big-calendar for rental scheduling

### Key Architecture Layers

1. **Authentication Layer** (`src/context/AuthContext.jsx`)
   - Wraps the entire application with auth state
   - Uses localStorage for session persistence (`chapo_auth`, `chapo_user`)

2. **Data Layer**
   - `src/lib/supabase.js`: Supabase client configuration
   - `src/lib/database.js`: All database CRUD operations with automatic field name conversion
   - `src/context/StatisticsProvider.jsx`: Global statistics state with caching
   - `src/context/useStatistics.jsx`: Hook to consume statistics context

3. **Main Application Flow** (`src/App.jsx`)
   - Dashboard stats at top, calendar section below, tab-based navigation for management sections
   - Wrapper components (e.g., `ScooterManagementWrapper`) connect statistics refresh to child components

### Field Naming Convention
**Important**: The codebase uses camelCase in the frontend and snake_case in the database. All conversions happen in `src/lib/database.js`:
- `convertScooterToFrontend()` and `convertRentalToFrontend()` handle DB → frontend conversion
- Insert/update operations manually map camelCase to snake_case

Examples:
- `licensePlate` (frontend) ↔ `license_plate` (database)
- `customerName` (frontend) ↔ `customer_name` (database)
- `startDate` (frontend) ↔ `start_date` (database)

### Environment Variables
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Database Schema
Three main tables in Supabase:
- `scooters`: id, license_plate, color, year, mileage, status
- `rentals`: id, order_number, scooter_id, scooter_license, scooter_color, customer_name, passport_number, whatsapp_country_code, whatsapp_number, start_date, end_date, start_time, end_time, daily_rate, deposit, status, paid, notes, requires_agreement, created_at
- `customers`: passport_number (PK), name, whatsapp_country_code, whatsapp_number, email, notes, created_at

### Key Business Logic
- **Order numbers**: Auto-generated format `YYMMDDXXX` (date + sequence)
- **Rental statuses**: `'pending'`, `'active'`, `'completed'`
- **Scooter statuses**: `'available'`, `'rented'`, `'maintenance'`
- **Customer identification**: Passport number as unique identifier
- **Auto-customer creation**: When adding a rental, customer record is automatically created if not exists
- **Prorated income**: Reports calculate income only for days within the selected date range

### Important Notes
- The app uses Hebrew comments in some places
- Customer auto-fill: Typing passport number in rental form auto-fills customer details from existing records
- WhatsApp integration: Click-to-send review requests to customers
- Statistics caching: `StatisticsProvider` caches data and provides `refreshStatistics(forceReload)` method