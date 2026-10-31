import {
    LayoutDashboard, PenTool, FileText, Settings, Package, PieChart, Users, Truck, Award, Calendar, ClipboardList,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type NavRole = 'admin' | 'manager' | 'technician' | 'accountant';

export interface NavItem {
    key: string; // stable id for usage tracking ("nav:<key>"), never shown
    to: string;
    icon: LucideIcon;
    label: string;
    roles: NavRole[];
}

// The one place the menu order lives. Sidebar, bottom bar (first 4 a role can see)
// and the "More" sheet all follow this order, so reordering is moving a line.
export const NAV_ITEMS: NavItem[] = [
    { key: 'dashboard', to: '/', icon: LayoutDashboard, label: 'Dashboard', roles: ['admin', 'manager', 'technician', 'accountant'] },
    { key: 'jobs', to: '/jobs', icon: PenTool, label: 'Jobs Board', roles: ['admin', 'manager', 'technician'] },
    { key: 'bookings', to: '/bookings', icon: Calendar, label: 'Bookings', roles: ['admin', 'manager', 'technician', 'accountant'] },
    { key: 'performance', to: '/performance', icon: Award, label: 'Performance', roles: ['admin', 'manager'] },
    { key: 'quotations', to: '/quotations', icon: ClipboardList, label: 'Quotations', roles: ['admin', 'manager', 'accountant'] },
    { key: 'invoices', to: '/invoices', icon: FileText, label: 'Invoices', roles: ['admin', 'manager', 'accountant'] },
    { key: 'customers', to: '/customers', icon: Users, label: 'Customers', roles: ['admin', 'manager', 'accountant'] },
    { key: 'suppliers', to: '/suppliers', icon: Truck, label: 'Suppliers', roles: ['admin', 'manager', 'accountant'] },
    { key: 'inventory', to: '/inventory', icon: Package, label: 'Inventory', roles: ['admin', 'manager'] },
    { key: 'finances', to: '/finances', icon: PieChart, label: 'Finance', roles: ['admin', 'manager', 'accountant'] },
    { key: 'settings', to: '/settings', icon: Settings, label: 'Settings', roles: ['admin', 'manager', 'technician', 'accountant'] },
];
