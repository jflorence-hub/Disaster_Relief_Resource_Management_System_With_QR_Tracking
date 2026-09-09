<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class AuthenticateApiToken
{
    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->bearerToken();

        if (! $token) {
            return response()->json(['message' => 'Unauthenticated. No token provided.'], 401);
        }

        $user = User::where('api_token', hash('sha256', $token))->first();

        if (! $user) {
            return response()->json(['message' => 'Invalid or expired token.'], 401);
        }

        if ($user->status !== 'active') {
            return response()->json(['message' => 'This account is not active. Contact an administrator.'], 403);
        }

        Auth::setUser($user);

        return $next($request);
    }
}
