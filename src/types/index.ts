export type JobStatus = 'pending' | 'in_progress' | 'waiting_parts' | 'completed' | 'cancelled';

export interface Customer {
    id: string;
    name: string;
    phone: string;
    email?: string;
    address?: string;
}

export interface Vehicle {
    id: string;
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
  vehicle_id: string;
  description: string;
  status: 'pending' | 'in_progress' | 'waiting_parts' | 'completed' | 'cancelled';
  created_at: string;
  technician_notes?: string;
  estimated_cost_lkr?: number;
  mileage?: number;
  assigned_technician_id?: string; // New
  archived?: boolean; // New
  estimated_hours?: number; // New
  
  // Joins
  vehicles?: Vehicle;
  parts?: JobPart[];
  profiles?: { full_name: string }; // Join for assigned technician
}

export interface JobPart {
    id: string;
    job_id: string;
    part_id: string;
    quantity: number;
    price_at_time_lkr: number;
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
