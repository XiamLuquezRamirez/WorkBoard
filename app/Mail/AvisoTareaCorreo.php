<?php

namespace App\Mail;

use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Support\Carbon;

/**
 * Copia por correo de lo que pasa con una entrega: enviada a revisión,
 * aceptada, devuelta para corregir o reabierta.
 */
class AvisoTareaCorreo extends Mailable
{
    /** Asunto, titular, color y texto de cada caso. */
    private const CASOS = [
        'revision'  => ['Tarea por revisar',            'Tarea por revisar',       '#0D9488'],
        'aceptada'  => ['Entrega aceptada',             'Entrega aceptada',        '#059669'],
        'devuelta'  => ['Tarea devuelta para corregir', 'Devuelta para corregir',  '#D97706'],
        'reabierta' => ['Tarea reabierta',              'Tarea reabierta',         '#2563EB'],
    ];

    /**
     * @param string $tipo   revision | aceptada | devuelta | reabierta
     * @param string $nombre a quién va dirigido
     * @param array  $datos  id, titulo, responsable, proyecto, fecha_pactada,
     *                       fecha_entregada, actor, observacion
     */
    public function __construct(
        public string $tipo,
        public string $nombre,
        public array $datos,
    ) {
    }

    public function envelope(): Envelope
    {
        return new Envelope(subject: self::CASOS[$this->tipo][0] . ': ' . $this->datos['titulo']);
    }

    public function content(): Content
    {
        $d = $this->datos;
        $actor = $d['actor'] ?? 'Tu líder';

        $texto = match ($this->tipo) {
            'revision'  => "{$d['responsable']} entregó esta tarea y está esperando tu revisión. Entra a WorkBoard para aceptarla o devolverla con observaciones.",
            'aceptada'  => "{$actor} aceptó tu entrega. La tarea quedó cerrada.",
            'devuelta'  => "{$actor} revisó tu entrega y te la devolvió para corregir. La tarea volvió a «En Proceso»; cuando la ajustes, envíala de nuevo a revisión.",
            'reabierta' => "{$actor} reabrió esta tarea, que estaba cerrada. Volvió a «En Proceso».",
        };

        $fecha = fn ($f) => $f ? Carbon::parse($f)->format('d/m/Y') : null;

        return new Content(
            view: 'emails.aviso-tarea',
            with: [
                'titular' => self::CASOS[$this->tipo][1],
                'color'   => self::CASOS[$this->tipo][2],
                'nombre'  => $this->nombre,
                'texto'   => $texto,
                'd'       => $d,
                'pactada' => $fecha($d['fecha_pactada'] ?? null),
                'entregada' => $this->tipo === 'revision' || $this->tipo === 'aceptada' ? $fecha($d['fecha_entregada'] ?? null) : null,
                'observacion' => $d['observacion'] ?? null,
                'tituloObs' => $this->tipo === 'devuelta' ? 'Qué hay que corregir' : 'Observación',
            ],
        );
    }
}
