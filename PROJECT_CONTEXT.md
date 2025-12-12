# MazdaBuddy Project Context

## Overview

MazdaBuddy is a modern, mobile-first web application for managing an auto repair shop. It is built to be "cinematic," responsive, and user-friendly.

## Tech Stack

- **Frontend**: React (Vite), TypeScript, Tailwind CSS (v4).
- **Backend/Database**: Supabase (PostgreSQL, Auth, Realtime).
- **Navigation**: React Router DOM.
- **Icons**: Lucide React.
- **State Management**: React Context (`AuthContext`).

## Key Features

- **Dashboard**: Real-time stats, efficiency tracking, user-specific welcome.
- **Jobs Board**: Kanban-style or list view of repair jobs.
- **Job Details**: Modal-based job management (Parts, Labor, Notes).
- **Customers & Vehicles**: management of client data.
- **Inventory**: Parts tracking.
- **Invoices**: PDF generation and tracking.
- **Settings**: Shop configuration and User Management.

## Project Structure

- `src/components`: UI components (Views and Modals).
- `src/lib`: Utilities (Supabase client, AI services).
- `src/types`: TypeScript definitions.
- `src/context`: Global state (Auth).

## Database Schema (Key Tables)

- `customers`: id, name, phone, email.
- `vehicles`: id, customer_id, license_plate, make, model, vin.
- `job_cards`: id, vehicle_id, status (pending, in_progress, etc.), description, technician_notes, est_hours.
- `parts`: id, name, part_number, stock_quantity, price_lkr.
- `job_parts` / `job_labor`: join tables for job costs.
- `profiles`: id (uuid, refs auth.users), full_name, role (admin, manager, technician).

## AI Agent Instructions

- **Styling**: Always use Tailwind CSS. Aim for "cinematic" dark mode aesthetics (Slate-900/950 backgrounds, Cyan-400/500 accents).
- **Mobile First**: Always ensure layouts work on small screens (pb-safe, touch targets).
- **Code Style**: Functional React components, Hooks, TypeScript interfaces.
- **Data Fetching**: Use `supabase.from(...).select(...)`. Handle loading/error states.

## Future AI Pipelines

- Located in `src/lib/ai.ts`.
- Use OpenRouter for LLM calls.
