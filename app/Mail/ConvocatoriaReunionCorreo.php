<?php

namespace App\Mail;

use Illuminate\Mail\Attachment;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Support\Carbon;

/**
 * Copia por correo de una convocatoria (o de su cancelación).
 *
 * Lleva un .ics adjunto para que la reunión se pueda pasar al calendario con
 * un clic. Va con METHOD:PUBLISH y no REQUEST: con REQUEST, Gmail y Outlook
 * muestran «Sí / No» y la respuesta viajaría por correo al organizador, no a
 * WorkBoard, que es donde se lleva la asistencia.
 */
class ConvocatoriaReunionCorreo extends Mailable
{
    /**
     * Zona en la que se escriben las horas de las reuniones. La aplicación
     * guarda las horas tal como se teclean (hora local de la oficina).
     */
    public const ZONA = 'America/Bogota';

    /**
     * @param array $reunion  titulo, descripcion, fecha, hora_inicio, hora_fin,
     *                        lugar, enlace, organizador, asistentes (nombres), id
     * @param string $nombre  a quién va dirigido
     * @param string $tipo    'convocatoria' o 'cancelacion'
     */
    public function __construct(
        public array $reunion,
        public string $nombre,
        public string $tipo = 'convocatoria',
    ) {
    }

    public function envelope(): Envelope
    {
        $asunto = $this->tipo === 'cancelacion'
            ? 'Reunión cancelada: ' . $this->reunion['titulo']
            : 'Convocatoria a reunión: ' . $this->reunion['titulo'];

        return new Envelope(subject: $asunto);
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.convocatoria-reunion',
            with: [
                'r'         => $this->reunion,
                'nombre'    => $this->nombre,
                'cancelada' => $this->tipo === 'cancelacion',
                'cuando'    => self::fechaEnPalabras($this->reunion['fecha']),
            ],
        );
    }

    public function attachments(): array
    {
        if ($this->tipo === 'cancelacion') {
            return [];
        }

        return [
            Attachment::fromData(fn () => $this->ics(), 'reunion.ics')
                ->withMime('text/calendar; charset=utf-8'),
        ];
    }

    /** «martes 18 de noviembre de 2026». */
    public static function fechaEnPalabras(string $fecha): string
    {
        $dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
        $meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
                  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
        $d = Carbon::parse($fecha);

        return $dias[$d->dayOfWeek] . ' ' . $d->day . ' de ' . $meses[$d->month - 1] . ' de ' . $d->year;
    }

    /** Evento de calendario en UTC, que cualquier cliente sitúa en su zona. */
    private function ics(): string
    {
        $r = $this->reunion;
        $inicio = Carbon::parse($r['fecha'] . ' ' . $r['hora_inicio'], self::ZONA);
        // Sin hora de fin se reserva una hora: un evento de duración cero
        // aparece en algunos calendarios como un punto que no se ve.
        $fin = $r['hora_fin']
            ? Carbon::parse($r['fecha'] . ' ' . $r['hora_fin'], self::ZONA)
            : $inicio->copy()->addHour();

        $utc = fn (Carbon $c) => $c->copy()->utc()->format('Ymd\THis\Z');
        $texto = fn ($s) => str_replace(["\\", ";", ",", "\r\n", "\n"], ["\\\\", "\\;", "\\,", "\\n", "\\n"], (string) $s);

        $descripcion = trim(($r['descripcion'] ?? '') . ($r['enlace'] ? "\n\nEnlace: " . $r['enlace'] : ''));

        $lineas = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//WorkBoard//Reuniones//ES',
            'METHOD:PUBLISH',
            'BEGIN:VEVENT',
            'UID:reunion-' . $r['id'] . '@workboard',
            'DTSTAMP:' . $utc(Carbon::now()),
            'DTSTART:' . $utc($inicio),
            'DTEND:' . $utc($fin),
            'SUMMARY:' . $texto($r['titulo']),
        ];
        if ($descripcion !== '') {
            $lineas[] = 'DESCRIPTION:' . $texto($descripcion);
        }
        if (!empty($r['lugar']) || !empty($r['enlace'])) {
            $lineas[] = 'LOCATION:' . $texto($r['lugar'] ?: $r['enlace']);
        }
        if (!empty($r['enlace'])) {
            $lineas[] = 'URL:' . $r['enlace'];
        }
        $lineas[] = 'END:VEVENT';
        $lineas[] = 'END:VCALENDAR';

        return implode("\r\n", $lineas) . "\r\n";
    }
}
