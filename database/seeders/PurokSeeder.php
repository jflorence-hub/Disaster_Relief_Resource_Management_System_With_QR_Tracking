<?php

namespace Database\Seeders;

use App\Models\Purok;
use Illuminate\Database\Seeder;

class PurokSeeder extends Seeder
{
    public function run(): void
    {
        for ($i = 1; $i <= 7; $i++) {
            Purok::updateOrCreate(
                ['code' => 'PUROK-' . $i],
                [
                    'name' => 'Purok ' . $i,
                    'status' => 'active',
                ]
            );
        }
    }
}