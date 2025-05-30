<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class NotificacionMailable extends Mailable
{
    use Queueable, SerializesModels;

    public $data;
    public $tipo;

    /**
     * Create a new message instance.
     */
    public function __construct($data, $tipo = 'nueva-tarea')
    {
        $this->data = $data;
        $this->tipo = $tipo;
    }

    /**
     * Get the message envelope.
     */

    public function build()
    {
        if ($this->tipo === 'nueva-tarea') {
            $subject = 'Nueva tarea en WorkBoard';
            $view = 'emails.notificaciones';
        }

        return $this->from(config('mail.from.address'), config('mail.from.name'))
            ->subject($subject)
            ->view($view);
    }


    /**
     * Get the attachments for the message.
     *
     * @return array<int, \Illuminate\Mail\Mailables\Attachment>
     */
    public function attachments(): array
    {
        return [];
    }
}
