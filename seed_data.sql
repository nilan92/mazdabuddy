-- SEED DATA FOR MAZDABUDDY
-- Run this in the Supabase SQL Editor to populate your database with test data.

-- 1. Insert Customers (Using valid UUIDs)
INSERT INTO customers (id, name, phone, email, address) VALUES
('a0000000-0000-0000-0000-000000000001', 'Kamal Perera', '0771234567', 'kamal@example.com', '123 Galle Road, Colombo'),
('a0000000-0000-0000-0000-000000000002', 'Nimal Silva', '0719876543', 'nimal@example.com', '45 Kandy Road, Kelaniya');

-- 2. Insert Vehicles (Linking to Customers)
INSERT INTO vehicles (id, customer_id, license_plate, make, model, year, color, vin) VALUES
('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'CAB-1234', 'Mazda', 'Axela', 2018, 'Soul Red', 'MZ123456789'),
('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 'WP-4567', 'Toyota', 'Premio', 2016, 'Pearl White', 'TY987654321');

-- 3. Insert Parts (Letting Supabase generate IDs)
INSERT INTO parts (name, part_number, stock_quantity, min_stock_level, price_lkr, cost_lkr, location) VALUES
('Oil Filter (Mazda Skyactiv)', 'PE01-14-302', 15, 5, 4500.00, 2800.00, 'Shelf A-1'),
('Brake Pads (Front)', 'K0Y1-33-28Z', 4, 5, 18500.00, 12000.00, 'Shelf B-3'),
('Synthetic Engine Oil 5W-30 (4L)', 'MOBIL-5W30', 20, 10, 32000.00, 24000.00, 'Rack C-1'),
('Air Filter', 'PE07-13-3A0A', 8, 3, 6500.00, 4000.00, 'Shelf A-2'),
('Cabin Filter', 'KD45-61-J6X', 3, 5, 5500.00, 3200.00, 'Shelf A-2');

-- 4. Insert Jobs (Linking to Vehicles)
INSERT INTO job_cards (id, vehicle_id, status, description, technician_notes, estimated_cost_lkr, created_at) VALUES
('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'in_progress', 'Full 50,000km Service', 'Oil change, filter replacement, brake inspection', 45000.00, NOW()),
('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 'waiting_parts', 'Brake Replacement', 'Waiting for ceramic pads', 22000.00, NOW() - INTERVAL '1 day'),
('c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'completed', 'AC Repair', 'Replaced condenser and re-gas', 85000.00, NOW() - INTERVAL '5 days');
