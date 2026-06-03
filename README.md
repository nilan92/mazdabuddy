# AutoPulse — Workshop Management System

Cloud-based workshop management for auto repair shops. Multi-tenant SaaS.

**Live:** https://nilan92.github.io/mazdabuddy/

## Stack
- React 19 + Vite + TypeScript + Tailwind CSS v4
- Supabase (PostgreSQL, Auth, Edge Functions, Realtime)
- Framer Motion (modals/toasts) + CSS animations (page transitions)
- Tesseract.js (on-device OCR), jsPDF, text.lk SMS, Web Push

## Features
- Multi-tenant workshop management (jobs, customers, vehicles, inventory)
- Kanban job board with drag-and-drop
- Invoicing with PDF generation
- SMS notifications via text.lk (auto on job status changes)
- SmartScan — license plate OCR (no internet required)
- AI diagnostics via OpenRouter
- Push notifications (Web Push + VAPID)
- Audit log, CSV export, MFA/TOTP

## Dev
```bash
cp .env.example .env   # add Supabase keys
node_modules/.bin/vite --port 5173
```

See `CLAUDE.md` for full architecture, known issues, and development notes.
