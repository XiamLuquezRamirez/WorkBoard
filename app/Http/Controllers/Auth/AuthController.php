<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class AuthController extends Controller
{
    public function checkAuth(Request $request)
    {
        try {
            if (!$request->user()) {
                return response()->json([
                    'valid' => false,
                    'message' => 'No autenticado'
                ], 401);
            }

            return response()->json([
                'valid' => true,
                'user' => $request->user()
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'valid' => false,
                'message' => 'Error al verificar autenticación'
            ], 500);
        }
    }
} 