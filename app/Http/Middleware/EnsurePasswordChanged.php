<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsurePasswordChanged
{
    /**
     * Redirect staff who have not yet changed their temporary password.
     * Allows access to the profile page and logout route so users can act on it.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (
            $user &&
            $user->must_change_password &&
            ! $request->routeIs('profile.*') &&
            ! $request->routeIs('password.*') &&
            ! $request->routeIs('logout')
        ) {
            return redirect()->route('profile.show')
                ->with('warning', 'You must change your temporary password before continuing.');
        }

        return $next($request);
    }
}
