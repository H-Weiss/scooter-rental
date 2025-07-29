# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
This is a Scooter Rental Management System built with React and Vite. It uses Supabase as the backend database and features a calendar-based rental management interface with real-time statistics.

## Development Commands

### Running the Development Server
```bash
npm run dev
```

### Building for Production
```bash
npm run build
```

### Preview Production Build
```bash
npm run preview
```

### Code Quality
Currently no linting or testing commands are configured in package.json. Consider adding:
- ESLint configuration exists but no lint script
- No test framework configured

## Architecture Overview

### Tech Stack
- **Frontend**: React 18 with Vite
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **UI Components**: Custom components with Lucide React icons
- **Calendar**: react-big-calendar for rental scheduling

### Key Components Structure

1. **Authentication Layer** (`src/context/AuthContext.jsx`)
   - Manages user authentication state
   - Wraps the entire application
   - Controls access to the main app

2. **Data Layer**
   - `src/lib/supabase.js`: Supabase client configuration
   - `src/lib/database.js`: All database operations (CRUD for scooters and rentals)
   - `src/context/StatisticsProvider.jsx`: Global state management for statistics

3. **Main Application Flow** (`src/App.jsx`)
   - Dashboard with real-time statistics
   - Calendar view for rental management
   - Tab-based navigation for different management sections

4. **Core Features**
   - **Scooter Management**: Add, edit, delete scooters with status tracking
   - **Rental Management**: Create and manage rentals with customer details
   - **Customer Management**: Add customers, track rental history, send WhatsApp review requests
   - **Reports**: Generate rental reports with date ranges, income analysis by motorcycle
   - **Calendar Integration**: Visual representation of rental schedules
   - **Real-time Statistics**: Available scooters, active rentals, maintenance status

### Environment Variables Required
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Database Schema
The app expects three main tables in Supabase:
- `scooters`: id, license_plate, color, year, mileage, status
- `rentals`: id, order_number, scooter_id, customer details, dates, status, payment info
- `customers`: passport_number (PK), name, whatsapp_country_code, whatsapp_number, email, notes, created_at

### Data Flow Pattern
1. Components use database functions from `src/lib/database.js`
2. Database functions handle Supabase operations and data conversion
3. StatisticsProvider manages global state and caching
4. Components refresh data through callbacks passed via props

### Important Notes
- The app uses Hebrew comments in some places
- Order numbers are generated automatically (format: YYMMDDXXX)
- Rental statuses: 'pending', 'active', 'completed'
- Scooter statuses: 'available', 'rented', 'maintenance'
- Customer identification: Uses passport number as unique identifier
- Auto-fill feature: Typing passport number in rental form auto-fills customer details
- WhatsApp integration: Click-to-send review requests to customers