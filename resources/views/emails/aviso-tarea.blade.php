<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <title>WorkBoard</title>
</head>
<body style="margin:0;padding:24px 12px;background:#F3F5F9;font-family:Arial,Helvetica,sans-serif;color:#1F2937;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#FFFFFF;border:1px solid #E5E7EB;border-radius:10px;overflow:hidden;">
        <tr>
            <td style="background:{{ $color }};color:#FFFFFF;padding:16px 22px;">
                <div style="font-size:12px;letter-spacing:.06em;text-transform:uppercase;opacity:.85;">WorkBoard · {{ $titular }}</div>
                <div style="font-size:20px;font-weight:bold;margin-top:4px;">{{ $d['titulo'] }}</div>
            </td>
        </tr>
        <tr>
            <td style="padding:20px 22px;font-size:15px;line-height:1.55;">
                <p style="margin:0 0 14px;">Hola{{ $nombre !== '' ? ', ' . $nombre : '' }}:</p>
                <p style="margin:0 0 16px;">{{ $texto }}</p>

                <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:14px;">
                    <tr>
                        <td style="padding:6px 0;color:#6B7280;width:130px;">Tarea</td>
                        <td style="padding:6px 0;">#{{ $d['id'] }} · {{ $d['titulo'] }}</td>
                    </tr>
                    @if (!empty($d['responsable']))
                        <tr>
                            <td style="padding:6px 0;color:#6B7280;">Responsable</td>
                            <td style="padding:6px 0;">{{ $d['responsable'] }}</td>
                        </tr>
                    @endif
                    @if (!empty($d['proyecto']))
                        <tr>
                            <td style="padding:6px 0;color:#6B7280;">Proyecto</td>
                            <td style="padding:6px 0;">{{ $d['proyecto'] }}</td>
                        </tr>
                    @endif
                    @if ($pactada)
                        <tr>
                            <td style="padding:6px 0;color:#6B7280;">Fecha pactada</td>
                            <td style="padding:6px 0;">{{ $pactada }}</td>
                        </tr>
                    @endif
                    @if ($entregada)
                        <tr>
                            <td style="padding:6px 0;color:#6B7280;">Entregada</td>
                            <td style="padding:6px 0;">{{ $entregada }}</td>
                        </tr>
                    @endif
                </table>

                @if (!empty($observacion))
                    <div style="margin-top:16px;padding:12px 14px;background:#FFFBEB;border-left:4px solid {{ $color }};border-radius:4px;">
                        <div style="font-size:12px;color:#92400E;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">{{ $tituloObs }}</div>
                        {!! nl2br(e($observacion)) !!}
                    </div>
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
