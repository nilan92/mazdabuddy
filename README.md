# MazdaBuddy 🛠️

**The Next-Generation Workshop Management System.**

![Status](https://img.shields.io/badge/Status-Active-emerald)
![Version](https://img.shields.io/badge/Version-V7.0-cyan)
![Stack](https://img.shields.io/badge/Tech-React%20%7C%20Supabase%20%7C%20Tailwind_v4-blue)

## 🚀 Overview

MazdaBuddy is a high-performance, mobile-first web application designed to streamline operations for modern automotive workshops. Built to solve the chaos of paper-based tracking, it provides a unified interface for job management, inventory control, invoicing, and customer relationships.

Designed with a **"Technician-First"** philosophy, the UI is optimized for high-contrast visibility in workshop environments and touch-friendly interaction on mobile devices.

## ✨ Key Features

- **📋 Digital Job Cards**: Real-time tracking of vehicle repairs, status updates, and technician assignments.
- **🔧 Inventory & Parts**: Live stock tracking with automatic deduction upon job usage.
- **👥 Team Management**: Role-based access control (Admin/Technician) for secure operations.
- **💳 Smart Invoicing**: One-click invoice generation with labor and parts calculation + PDF export.
- **🤖 AI Diagnostics**: Integrated AI assistant to suggest repairs based on vehicle symptoms.
- **📱 Mobile-First Design**: Fully responsive interface that works perfectly on tablets and phones.
- **🔍 Smart Scan**: VIN and License Plate scanning integration (Future Roadmap).

## 🛠️ Technical Architecture

Built on a modern, scalable, and type-safe stack:

- **Frontend**: React 18 (Vite), TypeScript, Tailwind CSS v4.
- **Backend / DB**: Supabase (PostgreSQL), Row Level Security (RLS) for enterprise-grade security.
- **State Management**: React Context API + Custom Hooks.
- **Icons**: Lucide React.
- **Deployment**: GitHub Pages + GitHub Actions (CI/CD).

## 📦 Installation & Setup

1.  **Clone the repository**

    ```bash
    git clone https://github.com/nilan92/mazdabuddy.git
    cd mazdabuddy
    ```

2.  **Install Dependencies**

    ```bash
    npm install
    ```

3.  **Environment Setup**
    Create a `.env` file in the root directory:

    ```env
    VITE_SUPABASE_URL=your_supabase_url
    VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=your_supabase_key
    ```

4.  **Run Locally**
    ```bash
    npm run dev
    ```

## 🔒 Security

- **Auth**: Managed via Supabase Auth (Email/Password & Username support).
- **Data Access**: All database queries are protected by Row Level Security (RLS) policies, ensuring users only access authorized data.
- **Secrets**: Environment variables are strictly managed and never exposed in the client bundle (except public keys).

## 🤝 Contributing

Contributions are welcome! Please fork the repository and submit a pull request for review.

---

_Built with ❤️ by Nilan Iddawela._
