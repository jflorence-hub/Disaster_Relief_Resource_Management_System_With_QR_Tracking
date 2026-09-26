<?php

namespace Database\Seeders;

use App\Models\Distribution;
use App\Models\Location;
use App\Models\QrScan;
use App\Models\Resource;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
        PurokSeeder::class,
        ]);
        // --- System settings -------------------------------------------------
        Setting::set('app_name', 'Disaster Relief Resource Management');
        Setting::set('organization_contact_email', 'ops@disasterrelief.test');
        Setting::set('organization_phone', '+63 917 000 0000');
        Setting::set('low_stock_default_threshold', '20');

        // --- Locations -----------------------------------------------------
        $locations = collect([
            ['name' => 'Central Warehouse', 'type' => 'warehouse', 'address' => '120 Harbor Rd', 'city' => 'Ormoc City', 'latitude' => 11.0064, 'longitude' => 124.6075, 'capacity' => 5000, 'contact_person' => 'Maria Santos', 'contact_phone' => '+63 917 000 1001', 'status' => 'active'],
            ['name' => 'Tacloban Distribution Center', 'type' => 'distribution_center', 'address' => '45 Real St', 'city' => 'Tacloban City', 'latitude' => 11.2543, 'longitude' => 125.0000, 'capacity' => 3000, 'contact_person' => 'Jose Ramirez', 'contact_phone' => '+63 917 000 1002', 'status' => 'active'],
            ['name' => 'Barangay San Isidro Shelter', 'type' => 'shelter', 'address' => 'San Isidro Elementary School', 'city' => 'Ormoc City', 'latitude' => 10.9800, 'longitude' => 124.5900, 'capacity' => 400, 'contact_person' => 'Ana Cruz', 'contact_phone' => '+63 917 000 1003', 'status' => 'active'],
            ['name' => 'Palo Field Office', 'type' => 'field_office', 'address' => '78 Rizal Ave', 'city' => 'Palo', 'latitude' => 11.1580, 'longitude' => 125.0290, 'capacity' => 150, 'contact_person' => 'Carlos Reyes', 'contact_phone' => '+63 917 000 1004', 'status' => 'active'],
            ['name' => 'Baybay Warehouse Annex', 'type' => 'warehouse', 'address' => 'Purok 3, Poblacion', 'city' => 'Baybay City', 'latitude' => 10.6790, 'longitude' => 124.8000, 'capacity' => 2000, 'contact_person' => 'Liza Fernandez', 'contact_phone' => '+63 917 000 1005', 'status' => 'maintenance'],
        ])->map(fn ($attrs) => Location::create($attrs));

        // --- Team members / user accounts ------------------------------------
        $admin = User::create([
            'name' => 'Admin User',
            'email' => 'admin@disasterrelief.test',
            'password' => Hash::make('password'),
            'role' => 'admin',
            'phone' => '+63 917 000 0001',
            'status' => 'active',
            'location_id' => $locations[0]->id,
            'responsibilities' => 'System administration and operations oversight',
        ]);

        $team = collect([
            ['name' => 'Maria Santos', 'email' => 'maria.santos@disasterrelief.test', 'role' => 'staff', 'phone' => '+63 917 000 1001', 'location_id' => $locations[0]->id, 'status' => 'active', 'responsibilities' => 'Warehouse coordinator'],
            ['name' => 'Jose Ramirez', 'email' => 'jose.ramirez@disasterrelief.test', 'role' => 'staff', 'phone' => '+63 917 000 1002', 'location_id' => $locations[1]->id, 'status' => 'active', 'responsibilities' => 'Distribution coordinator'],
            ['name' => 'Ana Cruz', 'email' => 'ana.cruz@disasterrelief.test', 'role' => 'staff', 'phone' => '+63 917 000 1003', 'location_id' => $locations[2]->id, 'status' => 'active', 'responsibilities' => 'Field response staff'],
            ['name' => 'Carlos Reyes', 'email' => 'carlos.reyes@disasterrelief.test', 'role' => 'staff', 'phone' => '+63 917 000 1004', 'location_id' => $locations[3]->id, 'status' => 'on_leave', 'responsibilities' => 'Field response staff'],
            ['name' => 'Liza Fernandez', 'email' => 'liza.fernandez@disasterrelief.test', 'role' => 'staff', 'phone' => '+63 917 000 1005', 'location_id' => $locations[4]->id, 'status' => 'active', 'responsibilities' => 'Volunteer coordinator'],
            ['name' => 'Miguel Torres', 'email' => 'miguel.torres@disasterrelief.test', 'role' => 'staff', 'phone' => '+63 917 000 1006', 'location_id' => $locations[1]->id, 'status' => 'inactive', 'responsibilities' => 'Logistics volunteer'],
        ])->map(function ($attrs) {
            return User::create([
                ...$attrs,
                'password' => Hash::make('password'),
            ]);
        });

        // --- Resources -------------------------------------------------------
        $resourceDefs = [
            ['name' => 'Rice (25kg sacks)', 'category' => 'food', 'unit' => 'sacks', 'quantity' => 320, 'minimum_threshold' => 50],
            ['name' => 'Canned Goods Assortment', 'category' => 'food', 'unit' => 'boxes', 'quantity' => 180, 'minimum_threshold' => 40],
            ['name' => 'Bottled Drinking Water (500ml)', 'category' => 'water', 'unit' => 'cases', 'quantity' => 60, 'minimum_threshold' => 80],
            ['name' => 'Water Purification Tablets', 'category' => 'water', 'unit' => 'boxes', 'quantity' => 25, 'minimum_threshold' => 30],
            ['name' => 'First Aid Kits', 'category' => 'medical', 'unit' => 'kits', 'quantity' => 95, 'minimum_threshold' => 20],
            ['name' => 'Paracetamol (500mg)', 'category' => 'medical', 'unit' => 'boxes', 'quantity' => 15, 'minimum_threshold' => 25],
            ['name' => 'Emergency Tents (4-person)', 'category' => 'shelter', 'unit' => 'pieces', 'quantity' => 40, 'minimum_threshold' => 10],
            ['name' => 'Tarpaulin Sheets', 'category' => 'shelter', 'unit' => 'pieces', 'quantity' => 210, 'minimum_threshold' => 50],
            ['name' => 'Blankets', 'category' => 'clothing', 'unit' => 'pieces', 'quantity' => 300, 'minimum_threshold' => 60],
            ['name' => "Children's Clothing Bundles", 'category' => 'clothing', 'unit' => 'bundles', 'quantity' => 8, 'minimum_threshold' => 15],
            ['name' => 'Hygiene Kits', 'category' => 'hygiene', 'unit' => 'kits', 'quantity' => 130, 'minimum_threshold' => 30],
            ['name' => 'Soap Bars', 'category' => 'hygiene', 'unit' => 'pieces', 'quantity' => 400, 'minimum_threshold' => 100],
            ['name' => 'Flashlights', 'category' => 'tools', 'unit' => 'pieces', 'quantity' => 55, 'minimum_threshold' => 20],
            ['name' => 'Generator (portable)', 'category' => 'tools', 'unit' => 'units', 'quantity' => 4, 'minimum_threshold' => 2],
            ['name' => 'Rope (50m coils)', 'category' => 'other', 'unit' => 'coils', 'quantity' => 70, 'minimum_threshold' => 15],
            ['name' => 'Family Relief Kit (Food + Water + Hygiene)', 'category' => 'set', 'unit' => 'sets', 'quantity' => 45, 'minimum_threshold' => 10],
            ['name' => 'Emergency Household Set', 'category' => 'set', 'unit' => 'sets', 'quantity' => 20, 'minimum_threshold' => 5],
        ];

        $resources = collect($resourceDefs)->map(function ($def, $i) use ($locations) {
            return Resource::create([
                ...$def,
                'sku' => 'SKU-'.strtoupper(Str::random(8)),
                'qr_code' => 'RES-'.strtoupper(Str::random(10)),
                'location_id' => $locations[$i % $locations->count()]->id,
                'expiry_date' => in_array($def['category'], ['food', 'medical']) ? now()->addMonths(rand(3, 18)) : null,
                'notes' => null,
            ]);
        });

        // --- Distributions -----------------------------------------------------
        $recipients = ['Familia Dela Cruz', 'Familia Villanueva', 'Familia Bautista', 'Familia Aquino', 'Familia Mercado', 'Barangay San Isidro Relief Group', 'Familia Torres', 'Familia Gonzales'];
        $statuses = ['completed', 'completed', 'completed', 'in_transit', 'pending', 'cancelled'];
        $medicalResources = $resources->where('category', 'medical')->values();

        for ($i = 0; $i < 25; $i++) {
            $resource = $resources->random();
            $status = $statuses[array_rand($statuses)];

            // Roughly a third of distributions include an optional
            // additional resource (e.g. a family with a sick member
            // requesting medicine alongside their regular relief goods).
            $hasAdditional = $medicalResources->isNotEmpty() && rand(1, 3) === 1;
            $additionalResource = $hasAdditional ? $medicalResources->random() : null;

            Distribution::create([
                'resource_id' => $resource->id,
                'additional_resource_id' => $additionalResource?->id,
                'location_id' => $locations->random()->id,
                'distributed_by' => $team->random()->id,
                'quantity' => rand(1, 20),
                'additional_quantity' => $additionalResource ? rand(1, 5) : null,
                'recipient_name' => $recipients[array_rand($recipients)],
                'recipient_contact' => '+63 9'.rand(10, 99).' '.rand(100, 999).' '.rand(1000, 9999),
                'beneficiary_count' => rand(1, 8),
                'distribution_date' => now()->subDays(rand(0, 60)),
                'status' => $status,
                'notes' => $hasAdditional ? 'Family requested additional medicine for a sick member.' : null,
            ]);
        }

        // --- QR scans ------------------------------------------------------
        $scanTypes = ['check_in', 'check_out', 'audit', 'transfer'];
        $scanners = $team->push($admin);

        for ($i = 0; $i < 30; $i++) {
            $resource = $resources->random();
            $scanType = $scanTypes[array_rand($scanTypes)];

            QrScan::create([
                'resource_id' => $resource->id,
                'location_id' => $resource->location_id,
                'scanned_by' => $scanners->random()->id,
                'scan_type' => $scanType,
                // Only check-outs (goods actually handed to a family) carry
                // a recipient name — check-ins/audits/transfers don't.
                'recipient_name' => $scanType === 'check_out' ? $recipients[array_rand($recipients)] : null,
                'quantity_change' => rand(-10, 10),
                'notes' => null,
                'scanned_at' => now()->subDays(rand(0, 30))->subHours(rand(0, 23)),
            ]);
        }
    }
}
