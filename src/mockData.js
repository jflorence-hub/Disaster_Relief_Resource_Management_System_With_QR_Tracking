// src/mockData.js

let idCounter = 100;
export const generateId = () => ++idCounter;

export const initialResources = [
  { id: 1, name: 'Rice (25kg)', category: 'Food', quantity: '300 bags', status: 'Available', location: 'Warehouse A', lastUpdated: '2026-08-06' },
  { id: 2, name: 'Water Bottles (500ml)', category: 'Water', quantity: '150 packs', status: 'Low Stock', location: 'Warehouse B', lastUpdated: '2026-08-06' },
  { id: 3, name: 'Paracetamol (500mg)', category: 'Medicine', quantity: '80 boxes', status: 'Reserved', location: 'Medical Hub', lastUpdated: '2026-08-05' },
  { id: 4, name: 'Tents (Family Size)', category: 'Shelter', quantity: '25 units', status: 'Available', location: 'Warehouse A', lastUpdated: '2026-08-05' },
  { id: 5, name: 'Blankets', category: 'Clothing', quantity: '200 pieces', status: 'Available', location: 'Warehouse C', lastUpdated: '2026-08-05' },
  { id: 6, name: 'First Aid Kit', category: 'Medicine', quantity: '45 units', status: 'Available', location: 'Medical Hub', lastUpdated: '2026-08-04' },
  { id: 7, name: 'Canned Goods', category: 'Food', quantity: '500 cans', status: 'Reserved', location: 'Warehouse B', lastUpdated: '2026-08-04' },
  { id: 8, name: 'Water Purification Tablets', category: 'Water', quantity: '200 packs', status: 'Low Stock', location: 'Warehouse C', lastUpdated: '2026-08-03' },
];

export const initialScans = [
  { id: 1, resource: 'Rice (25kg)', scannedBy: 'Admin', location: 'Warehouse A', status: 'Verified', time: 'Today, 10:35 AM' },
  { id: 2, resource: 'Water Bottles (500ml)', scannedBy: 'Juan Dela Cruz', location: 'Barangay San Isidro', status: 'Verified', time: 'Today, 09:15 AM' },
  { id: 3, resource: 'Paracetamol (500mg)', scannedBy: 'Maria Santos', location: 'Medical Hub', status: 'Pending', time: 'Yesterday, 04:20 PM' },
  { id: 4, resource: 'Tents (Family Size)', scannedBy: 'Admin', location: 'Evacuation Center', status: 'Verified', time: 'Yesterday, 11:30 AM' },
  { id: 5, resource: 'Blankets', scannedBy: 'Juan Dela Cruz', location: 'Barangay San Isidro', status: 'Failed', time: 'Yesterday, 10:00 AM' },
];

export const initialDistributions = [
  { id: 1, resource: 'Rice (25kg)', quantity: '50 bags', location: 'Barangay San Isidro', assignedTo: 'Juan Dela Cruz', status: 'Completed', date: '2026-08-06' },
  { id: 2, resource: 'Water Bottles (500ml)', quantity: '30 packs', location: 'Barangay San Jose', assignedTo: 'Maria Santos', status: 'In Progress', date: '2026-08-06' },
  { id: 3, resource: 'First Aid Kit', quantity: '10 units', location: 'Medical Hub', assignedTo: 'Admin', status: 'Pending', date: '2026-08-05' },
  { id: 4, resource: 'Tents (Family Size)', quantity: '5 units', location: 'Evacuation Center', assignedTo: 'Juan Dela Cruz', status: 'Completed', date: '2026-08-05' },
  { id: 5, resource: 'Blankets', quantity: '50 pieces', location: 'Barangay San Isidro', assignedTo: 'Maria Santos', status: 'In Progress', date: '2026-08-04' },
  { id: 6, resource: 'Paracetamol (500mg)', quantity: '20 boxes', location: 'Medical Hub', assignedTo: 'Admin', status: 'Pending', date: '2026-08-04' },
];

export const initialTeam = [
  { id: 1, name: 'Juan Dela Cruz', role: 'Volunteer', email: 'juan@disasterrelief.org', phone: '+63 912 345 6789', location: 'Barangay San Isidro', status: 'Active', joined: '2026-07-15' },
  { id: 2, name: 'Maria Santos', role: 'Team Lead', email: 'maria@disasterrelief.org', phone: '+63 923 456 7890', location: 'Barangay San Jose', status: 'Active', joined: '2026-06-20' },
  { id: 3, name: 'Admin', role: 'Admin', email: 'admin@disasterrelief.org', phone: '+63 934 567 8901', location: 'Main Office', status: 'Active', joined: '2026-01-10' },
  { id: 4, name: 'Pedro Reyes', role: 'Volunteer', email: 'pedro@disasterrelief.org', phone: '+63 945 678 9012', location: 'Evacuation Center', status: 'Inactive', joined: '2026-05-05' },
  { id: 5, name: 'Luzviminda Torres', role: 'Coordinator', email: 'luz@disasterrelief.org', phone: '+63 956 789 0123', location: 'Medical Hub', status: 'Active', joined: '2026-04-12' },
];

export const initialLocations = [
  { id: 1, name: 'Warehouse A', type: 'Warehouse', address: '123 Main St, City', capacity: '500 units', status: 'Active', resources: 120 },
  { id: 2, name: 'Warehouse B', type: 'Warehouse', address: '456 Oak Ave, City', capacity: '350 units', status: 'Active', resources: 85 },
  { id: 3, name: 'Warehouse C', type: 'Warehouse', address: '789 Pine Rd, City', capacity: '200 units', status: 'Active', resources: 45 },
  { id: 4, name: 'Medical Hub', type: 'Medical', address: '101 Health Blvd, City', capacity: '150 units', status: 'Active', resources: 65 },
  { id: 5, name: 'Evacuation Center', type: 'Evacuation', address: '202 Shelter Ln, City', capacity: '300 units', status: 'Active', resources: 90 },
  { id: 6, name: 'Barangay San Isidro', type: 'Distribution', address: 'Barangay San Isidro', capacity: '100 units', status: 'Active', resources: 35 },
];

export const initialReports = [
  { id: 1, title: 'Monthly Resource Summary', type: 'Resource', date: '2026-08-01', status: 'Generated', size: '2.4 MB' },
  { id: 2, title: 'Distribution Report - July 2026', type: 'Distribution', date: '2026-07-31', status: 'Generated', size: '1.8 MB' },
  { id: 3, title: 'QR Scan Activity Report', type: 'QR Tracking', date: '2026-07-30', status: 'Pending', size: '- ' },
  { id: 4, title: 'Team Performance Report', type: 'Team', date: '2026-07-28', status: 'Generated', size: '3.1 MB' },
  { id: 5, title: 'Inventory Audit Report', type: 'Resource', date: '2026-07-25', status: 'Generated', size: '4.2 MB' },
];

export const categoryData = [
  { name: 'Food', count: 450, color: 'bg-emerald-500' },
  { name: 'Medicine', count: 120, color: 'bg-blue-500' },
  { name: 'Water', count: 350, color: 'bg-cyan-500' },
  { name: 'Shelter', count: 60, color: 'bg-amber-500' },
  { name: 'Clothing', count: 274, color: 'bg-purple-500' },
];

// For Dashboard stats
export const mockStats = [
  { label: 'Total Resources', value: '1,254', change: '+12%', trend: 'up', icon: 'Package', color: 'blue' },
  { label: 'QR Codes Scanned', value: '893', change: '+18%', trend: 'up', icon: 'QrCode', color: 'emerald' },
  { label: 'Resources Distributed', value: '542', change: '+8%', trend: 'up', icon: 'Truck', color: 'amber' },
  { label: 'Low Stock Alerts', value: '18', change: '-5%', trend: 'down', icon: 'AlertTriangle', color: 'rose' },
];

export const mockActivities = [
  { text: '50 bags of Rice distributed to Barangay San Isidro', time: '10:35 AM' },
  { text: 'QR Code scanned for Water Bottles (500ml)', time: '09:15 AM' },
  { text: 'New resource added: First Aid Kit (20 units)', time: 'Yesterday, 04:20 PM' },
  { text: 'New volunteer registered: Juan Dela Cruz', time: 'Yesterday, 11:30 AM' },
  { text: 'Low stock alert: Medicine (Paracetamol)', time: 'Yesterday, 09:00 AM' },
];