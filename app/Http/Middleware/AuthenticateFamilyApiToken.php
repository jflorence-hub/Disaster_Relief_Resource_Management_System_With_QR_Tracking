<?php

namespace App\Http\Middleware;

use App\Models\Family;
use App\Models\HouseholdMember;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class AuthenticateFamilyApiToken
{
    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->bearerToken();

        if (!$token) {
            return response()->json(['message' => 'Unauthenticated. No token provided.'], 401);
        }

        $family = Family::where('api_token', hash('sha256', $token))->first();
        $member = null;

        if (!$family) {
            $member = HouseholdMember::with('family')
                ->where('api_token', hash('sha256', $token))
                ->first();

            if (! $member || ! $member->family) {
                return response()->json(['message' => 'Invalid or expired token.'], 401);
            }

            $family = $member->family;
        }

        if ($family->status !== 'active') {
            return response()->json(['message' => 'This family account is not active.'], 403);
        }

        Auth::setUser($family);
        $request->attributes->set('authenticated_household_member', $member);

        return $next($request);
    }
}
