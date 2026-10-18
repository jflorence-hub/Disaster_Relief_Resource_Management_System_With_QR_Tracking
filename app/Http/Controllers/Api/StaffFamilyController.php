<?php
namespace App\Http\Controllers\Api;
use App\Http\Controllers\Controller;
use App\Models\Distribution;
use App\Models\Family;
use App\Models\HouseholdMember;
use App\Models\Location;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class StaffFamilyController extends Controller {

 public function index(Request $request): JsonResponse {
  $staff=$request->user();
  $families=Family::query()->with(['purok:id,name','distributions'=>function($q){$q->with(['resource:id,name,unit','resourceSet:id,name','additionalResource:id,name,unit','location:id,name'])->whereNotIn('status',['cancelled'])->orderByDesc('distribution_date')->orderByDesc('id');}])->where('status','active')->where('purok_id',$staff->purok_id)->orderBy('head_name')->get(['id','family_id','head_name','email','phone','household_member','purok_id','status']);
  $families->each(function(Family $family){$family->setAttribute('latest_distribution',$family->distributions->first());});
  return response()->json(['staff'=>['id'=>$staff->id,'name'=>$staff->name,'purok_id'=>$staff->purok_id,'purok'=>optional($staff->purok)->name],'families'=>$families]);
 }

 /**
  * Staff manually registers a family on behalf of one that has no phone/access.
  */
 public function registerFamily(Request $request): JsonResponse {
  $staff = $request->user();

  $data = $request->validate([
   'head_name'        => 'required|string|max:255',
   'email'            => 'nullable|email|max:255|unique:families,email',
   'phone'            => ['nullable', 'string', 'regex:/^09[0-9]{9}$/', 'unique:families,phone'],
   'household_member' => 'required|integer|min:1|max:100',
   'member_names'     => 'nullable|array',
   'member_names.*'   => 'nullable|string|max:255',
   'purok_id'         => 'required|exists:puroks,id',
   'location_id'      => 'required|exists:locations,id',
   'pin'              => ['required', 'string', 'regex:/^[0-9]{6}$/'],
  ]);

  // Security: force location_id to staff's assigned location regardless of submitted value.
  $data['location_id'] = $staff->location_id;

  if ((int) $data['purok_id'] !== (int) $staff->purok_id) {
      return response()->json([
          'message' => 'You can only register families in your assigned purok.',
          'errors'  => ['purok_id' => ['Select your assigned purok.']],
      ], 403);
  }

  // Security: validate that the submitted purok belongs to the staff's assigned location.
  $purokBelongsToStaffLocation = \App\Models\Purok::where('id', $data['purok_id'])
      ->where('location_id', $staff->location_id)
      ->exists();

  if (! $purokBelongsToStaffLocation) {
      return response()->json([
          'message' => 'The selected purok does not belong to your assigned location.',
          'errors'  => ['purok_id' => ['Purok must be within your assigned location.']],
      ], 403);
  }

  // Duplicate member name check
  if (!empty($data['member_names'])) {
   foreach ($data['member_names'] as $name) {
    if (!$name || trim($name) === '') continue;
    $exists = HouseholdMember::whereRaw('LOWER(TRIM(name)) = ?', [strtolower(trim($name))])->exists();
    if ($exists) {
     return response()->json([
      'message' => "A person named \"{$name}\" is already registered as a household member in another family.",
     ], 422);
    }
   }
  }

  $family = DB::transaction(function () use ($data, $staff) {
   $family = Family::create([
    'head_name'        => $data['head_name'],
    'email'            => isset($data['email']) ? strtolower(trim($data['email'])) : null,
    'phone'            => $data['phone'] ?? null,
    'household_member' => $data['household_member'],
    'purok_id'         => $data['purok_id'],
    'location_id'      => $data['location_id'],
    'pin'              => Hash::make($data['pin']),
    'status'           => 'active',
   ]);

   // Create named household member records
   $names = $data['member_names'] ?? [];
   foreach ($names as $i => $name) {
    if (!$name || trim($name) === '') continue;
    $family->household_member()->create([
     'household_member_number' => $i + 1,
     'name' => trim($name),
    ]);
   }
   // If no names provided, create numbered slots
   if (empty($names)) {
    for ($i = 1; $i <= (int) $data['household_member']; $i++) {
     $family->household_member()->create(['household_member_number' => $i]);
    }
   }

   // Create initial pending distribution
   $scheduledAt = DB::table('distribution_schedules')->orderByDesc('id')->value('scheduled_at') ?? now();
   Distribution::firstOrCreate(
    ['family_id' => $family->id, 'schedule_id' => null],
    [
     'resource_id' => null,
     'quantity' => max(1, (int) ceil(max(1, (int) $family->household_member) / 3)),
     'location_id' => $family->location_id,
     'distribution_date' => $scheduledAt,
     'recipient_name' => $family->head_name,
     'recipient_contact' => $family->phone,
     'household_member' => $family->household_member,
     'distributed_by' => $staff->id,
     'status' => 'pending',
    ]
   );

   return $family;
  });

  return response()->json([
   'message' => 'Family registered successfully.',
   'family'  => [
    'id'         => $family->id,
    'family_id'  => $family->family_id,
    'head_name'  => $family->head_name,
   ],
  ], 201);
 }

 public function members(Family $family): JsonResponse {
  $members = $family->household_member()
   ->orderBy('household_member_number')
   ->get(['id','household_member_number','name'])
   ->map(fn ($m) => [
    'id'     => $m->id,
    'number' => $m->household_member_number,
    'name'   => $m->display_name,
   ]);

  return response()->json([
   'family' => [
    'id'          => $family->id,
    'family_id'   => $family->family_id,
    'head_name'   => $family->head_name,
   ],
   'members' => $members,
  ]);
 }
}
