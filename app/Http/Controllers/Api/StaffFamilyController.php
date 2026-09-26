<?php
namespace App\Http\Controllers\Api;
use App\Http\Controllers\Controller;
use App\Models\Family;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
class StaffFamilyController extends Controller {
 public function index(Request $request): JsonResponse {
  $staff=$request->user();
  $families=Family::query()->with(['purok:id,name','distributions'=>function($q){$q->with(['resource:id,name,unit','additionalResource:id,name,unit','location:id,name'])->orderByDesc('distribution_date');}])->where('status','active')->where('purok_id',$staff->purok_id)->orderBy('family_name')->get(['id','family_id','family_name','head_name','phone','beneficiary_count','address','purok_id','status']);
  $families->each(function(Family $family){$family->setAttribute('latest_distribution',$family->distributions->first());});
  return response()->json(['staff'=>['id'=>$staff->id,'name'=>$staff->name,'purok_id'=>$staff->purok_id,'purok'=>optional($staff->purok)->name],'families'=>$families]);
 }
}
