<?php

namespace App\Console\Commands;

use App\Mail\ResumenTableroCorreo;
use App\Services\ResumenTablero;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Throwable;

class EnviarResumenTablero extends Command
{
    protected $signature = 'workboard:resumen
                            {--seco : Muestra el resumen en consola sin enviar el correo}';

    protected $description = 'Genera el resumen diario del tablero y lo envía por correo';

    public function handle(): int
    {
        $config = config('resumen_tablero');

        try {
            $datos = (new ResumenTablero($config))->generar();
        } catch (Throwable $e) {
            Log::error('Fallo al generar el resumen del tablero', ['error' => $e->getMessage()]);
            $this->error('No se pudo generar el resumen: '.$e->getMessage());

            return self::FAILURE;
        }

        $correo = new ResumenTableroCorreo($datos);

        if ($this->option('seco')) {
            $this->line($correo->render());

            return self::SUCCESS;
        }

        $destinatarios = $config['destinatarios'];

        if ($destinatarios === []) {
            $this->error('No hay destinatarios configurados (RESUMEN_TABLERO_DESTINATARIOS).');

            return self::FAILURE;
        }

        // El envío se aísla del cálculo: si el correo falla —SMTP caído, cuota
        // agotada— el scheduler lo registra en el log en lugar de dejar una
        // excepción sin capturar en una tarea que corre sin supervisión.
        try {
            Mail::to($destinatarios)->send($correo);
        } catch (Throwable $e) {
            Log::error('Fallo al enviar el resumen del tablero', ['error' => $e->getMessage()]);
            $this->error('No se pudo enviar el correo: '.$e->getMessage());

            return self::FAILURE;
        }

        $this->info(sprintf(
            'Resumen enviado a %s (%d vencidas, %d estancadas, %d sin responsable).',
            implode(', ', $destinatarios),
            $datos['metricas']['vencidas'],
            $datos['metricas']['estancadas'],
            $datos['metricas']['sin_responsable'],
        ));

        return self::SUCCESS;
    }
}
