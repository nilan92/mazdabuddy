export interface Tenant {
    id: string;
    name: string;
    logo_url?: string;
    address?: string;
    phone?: string;
    terms_and_conditions?: string;
    currency?: string;
    brand_color?: string;
    created_at: string;
}

export interface UserProfile {
    id: string;
    full_name: string;
    role: 'admin' | 'manager' | 'technician' | 'accountant';
    tenant_id: string;
    tenants?: Tenant;
}

export type JobStatus = 'pending' | 'in_progress' | 'waiting_parts' | 'completed' | 'cancelled';

export interface Customer {
    id: string;
    tenant_id: string;
    name: string;
    phone: string;
    email?: string;
    address?: string;
}

export interface Vehicle {
    id: string;
    tenant_id: string;
    customer_id: string;
    make: string;
    model: string;
    year: string;
    license_plate: string;
    vin?: string;
    color?: string;
    customers?: Customer; // For joins
}

export interface Part {
    id: string;
    tenant_id: string;
    name: string;
    part_number?: string;
    stock_quantity: number;
    min_stock_level?: number;
    price_lkr: number;
    cost_lkr: number;
    location?: string;
}

export interface JobCard {
  id: string;
  tenant_id: string;
  vehicle_id: string;
  description: string;
  status: 'pending' | 'in_progress' | 'waiting_parts' | 'completed' | 'cancelled';
  created_at: string;
  technician_notes?: string;
  estimated_cost_lkr?: number;
  mileage?: number;
  assigned_technician_id?: string;
  archived?: boolean;
  estimated_hours?: number;
  
  // Efficiency Tracking
  started_at?: string;
  completed_at?: string;
  last_start_time?: string;
  total_labor_time?: number; // In minutes

  // Joins
  vehicles?: Vehicle;
  parts?: JobPart[];
  profiles?: { full_name: string };
}

export interface JobPart {
    id: string;
    job_id: string;
    part_id: string | null;
    quantity: number;
    price_at_time_lkr: number;
    is_custom?: boolean;
    custom_name?: string;
    parts?: Part; // Join
}

export interface JobLabor {
    id: string;
    job_id: string;
    mechanic_name?: string;
    hours: number;
    description: string;
    hourly_rate_lkr: number;
}
