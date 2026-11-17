<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <title>WorkBoard</title>
</head>
<body style="margin:0;padding:24px 12px;background:#F3F5F9;font-family:Arial,Helvetica,sans-serif;color:#1F2937;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#FFFFFF;border:1px solid #E5E7EB;border-radius:10px;overflow:hidden;">
        <tr>
            <td style="background:{{ $cancelada ? '#B91C1C' : '#0F6CBD' }};color:#FFFFFF;padding:16px 22px;">
                <div style="font-size:12px;letter-spacing:.06em;text-transform:uppercase;opacity:.85;">
                    WorkBoard · {{ $cancelada ? 'Reunión cancelada' : 'Convocatoria a reunión' }}
                </div>
                <div style="font-size:20px;font-weight:bold;margin-top:4px;{{ $cancelada ? 'text-decoration:line-through;' : '' }}">
                    {{ $r['titulo'] }}
                </div>
            </td>
        </tr>
        <tr>
            <td style="padding:20px 22px;font-size:15px;line-height:1.55;">
                <p style="margin:0 0 14px;">Hola, {{ $nombre }}:</p>

                @if ($cancelada)
                    <p style="margin:0 0 16px;">
                        {{ $r['organizador'] }} canceló esta reunión. Ya no es necesario que asistas.
                    </p>
                @else
                    <p style="margin:0 0 16px;">
                        {{ $r['organizador'] }} te convocó a una reunión. Confirma si asistirás desde
                        WorkBoard: la verás como pendiente en <b>Mis Tareas</b>.
                    </p>
                @endif

                <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:14px;">
                    <tr>
                        <td style="padding:7px 0;color:#6B7280;width:110px;vertical-align:top;">Fecha</td>
                        <td style="padding:7px 0;font-weight:bold;">{{ ucfirst($cuando) }}</td>
                    </tr>
                    <tr>
                        <td style="padding:7px 0;color:#6B7280;vertical-align:top;">Hora</td>
                        <td style="padding:7px 0;font-weight:bold;">
                            {{ $r['hora_inicio'] }}@if ($r['hora_fin']) a {{ $r['hora_fin'] }}@endif
                        </td>
                    </tr>
                    @if (!empty($r['lugar']))
                        <tr>
                            <td style="padding:7px 0;color:#6B7280;vertical-align:top;">Lugar</td>
                            <td style="padding:7px 0;">{{ $r['lugar'] }}</td>
                        </tr>
                    @endif
                    @if (!empty($r['enlace']) && !$cancelada)
                        <tr>
                            <td style="padding:7px 0;color:#6B7280;vertical-align:top;">Enlace</td>
                            <td style="padding:7px 0;"><a href="{{ $r['enlace'] }}" style="color:#0F6CBD;word-break:break-all;">{{ $r['enlace'] }}</a></td>
                        </tr>
                    @endif
                    <tr>
                        <td style="padding:7px 0;color:#6B7280;vertical-align:top;">Organiza</td>
                        <td style="padding:7px 0;">{{ $r['organizador'] }}</td>
                    </tr>
                    @if (!empty($r['asistentes']))
                        <tr>
                            <td style="padding:7px 0;color:#6B7280;vertical-align:top;">Participantes</td>
                            <td style="padding:7px 0;">{{ implode(', ', $r['asistentes']) }}</td>
                        </tr>
                    @endif
                </table>

                @if (!empty($r['descripcion']))
                    <div style="margin-top:16px;padding:12px 14px;background:#F9FAFB;border-left:4px solid #0F6CBD;border-radius:4px;">
                        <div style="font-size:12px;color:#6B7280;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Asunto</div>
                        {!! nl2br(e($r['descripcion'])) !!}
                    </div>
                @endif

                @if (!$cancelada)
                    <p style="margin:18px 0 0;font-size:13px;color:#6B7280;">
                        Adjunto va el archivo <b>reunion.ics</b> para agregarla a tu calendario.
                    </p>
                @endif
            </td>
        </tr>
        <tr>
            <td style="padding:12px 22px;background:#F9FAFB;border-top:1px solid #E5E7EB;font-size:12px;color:#9CA3AF;text-align:center;">
                Correo automático de WorkBoard. Por favor, no respondas a este mensaje.
            </td>
        </tr>
    </table>
</body>
</html>
