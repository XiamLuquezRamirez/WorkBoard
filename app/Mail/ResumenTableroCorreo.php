<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Mail\Mailables\Headers;
use Illuminate\Queue\SerializesModels;

class ResumenTableroCorreo extends Mailable
{
    use Queueable;
    use SerializesModels;

    public function __construct(public array $datos)
    {
    }

    public function envelope(): Envelope
    {
        // El asunto es el ancla de búsqueda del agente: no lo cambies
        // sin actualizar también el prompt de la tarea programada.
        return new Envelope(
            subject: '[WorkBoard] Resumen diario '.$this->datos['fecha'],
        );
    }

    public function headers(): Headers
    {
        return new Headers(
            text: ['X-WorkBoard-Resumen' => $this->datos['fecha']],
        );
    }

    public function content(): Content
    {
        return new Content(
            text: 'emails.resumen-tablero',
            with: [
                'datos' => $this->datos,
                'secciones' => [
                    // Encabeza: un bloqueo no se resuelve con tiempo, alguien
                    // tiene que destrabarlo, y suele ser quien lee esto.
                    'bloqueadas'      => 'BLOQUEADAS · REQUIEREN DESTRABARSE',
                    'por_verificar'   => 'ENTREGADAS · ESPERAN TU VERIFICACIÓN',
                    'vencidas'        => 'VENCIDAS',
                    'estancadas'      => 'ESTANCADAS',
                    'sin_responsable' => 'SIN RESPONSABLE',
                    'vencen_pronto'   => 'VENCEN PRONTO',
                    'sin_fecha'       => 'SIN FECHA PACTADA',
                    'ficha_faltante'  => 'RESPONSABLE SIN FICHA DE EMPLEADO',
                    // Al final: deuda del método, no riesgo de plazo.
                    'sin_criterio'    => 'SIN CRITERIO DE CUMPLIMIENTO PACTADO',
                ],
            ],
        );
    }
}
