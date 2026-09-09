<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

/*
| Resumen diario del tablero.
|
| Sale a las 7:45 para que la tarea programada que lo analiza, a las 8:00,
| encuentre el correo ya en la bandeja. En Laravel 12 el scheduler se declara
| aquí: no existe app/Console/Kernel.php.
*/
Schedule::command('workboard:resumen')
    ->weekdays()
    ->timezone(config('resumen_tablero.zona_horaria'))
    ->at('07:45')
    ->onOneServer()
    ->withoutOverlapping();
