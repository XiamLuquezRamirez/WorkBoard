<?php

namespace App\Http\Middleware;

use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken as Middleware;
use Symfony\Component\HttpFoundation\Cookie;

/**
 * Verificación CSRF con la cookie renombrada por aplicación.
 *
 * Laravel emite la cookie del token con el nombre «XSRF-TOKEN» escrito en el
 * framework, sin opción de configurarlo. El navegador identifica una cookie por
 * nombre + dominio + ruta —el puerto no cuenta—, así que varias aplicaciones
 * Laravel servidas desde localhost escriben todas esa misma casilla y se pisan
 * el token entre ellas.
 *
 * El síntoma no es sutil: la cookie viaja cifrada con APP_KEY, de modo que al
 * recibir el token de otra aplicación el descifrado falla, el token llega vacío
 * y el login responde «Error de token CSRF». Basta con abrir el otro proyecto
 * para romper la sesión de éste.
 *
 * Darle a la cookie el nombre de la aplicación devuelve a cada una su propia
 * casilla. Se deriva de la cookie de sesión, que ya está separada por APP_NAME,
 * para que ambas queden nombradas por el mismo criterio.
 *
 * Extiende ValidateCsrfToken, que es la clase que Laravel 12 pone de verdad
 * en el grupo «web»; VerifyCsrfToken es su clase padre y reemplazarla no
 * surte efecto sobre el pipeline.
 */
class VerifyCsrfToken extends Middleware
{
    /**
     * Las rutas excluidas de la verificación CSRF.
     *
     * @var array<int, string>
     */
    protected $except = [
        //
    ];

    /**
     * Nombre de la cookie del token para esta aplicación.
     *
     * Ejemplo: con APP_NAME=WorkBoard la cookie de sesión es
     * «workboard_session» y ésta queda como «workboard_xsrf».
     */
    public static function nombreCookie(): string
    {
        $sesion = (string) config('session.cookie');
        $base = preg_replace('/_session$/', '', $sesion);

        return ($base !== '' && $base !== null ? $base : 'laravel').'_xsrf';
    }

    /**
     * Emite el token bajo el nombre propio de la aplicación.
     *
     * Se reconstruye la cookie que arma el framework en lugar de componerla a
     * mano: así conserva tal cual el cifrado, la expiración y los atributos de
     * sesión (secure, same_site, partitioned), y sólo cambia el nombre.
     */
    protected function newCookie($request, $config)
    {
        $original = parent::newCookie($request, $config);

        return new Cookie(
            static::nombreCookie(),
            $original->getValue(),
            $original->getExpiresTime(),
            $original->getPath(),
            $original->getDomain(),
            $original->isSecure(),
            $original->isHttpOnly(),
            $original->isRaw(),
            $original->getSameSite(),
            $original->isPartitioned()
        );
    }
}
