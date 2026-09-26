<?php
namespace App\Http\Middleware;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
class EnsureStaffApiToken {
 public function handle(Request $request, Closure $next): Response {
  $user=$request->user();
  if (!$user || $user->role !== 'staff') return response()->json(['message'=>'Only staff accounts can access this application.'],403);
  if ($user->purok_id === null) return response()->json(['message'=>'This staff account has no assigned Purok.'],403);
  return $next($request);
 }
}
