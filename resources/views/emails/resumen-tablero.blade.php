RESUMEN TABLERO WORKBOARD | {{ $datos['fecha'] }}
Generado: {{ $datos['generado'] }} ({{ $datos['zona'] }})

== INDICADORES ==
Tareas abiertas: {{ $datos['metricas']['abiertas'] }}
Vencidas: {{ $datos['metricas']['vencidas'] }}
Estancadas: {{ $datos['metricas']['estancadas'] }}
Sin responsable: {{ $datos['metricas']['sin_responsable'] }}
Vencen pronto: {{ $datos['metricas']['vencen_pronto'] }}
Sin fecha pactada: {{ $datos['metricas']['sin_fecha'] }}
En pausa: {{ $datos['metricas']['pausadas'] }}
Responsable sin ficha: {{ $datos['metricas']['ficha_faltante'] }}

@foreach ($secciones as $clave => $titulo)
== {{ $titulo }} ({{ $datos['secciones'][$clave]['total'] }}) ==
@forelse ($datos['secciones'][$clave]['filas'] as $fila)
@php
    // Los tramos condicionales se arman aquí: intercalar @if/@endif dentro de
    // una línea de texto no lo compila Blade y rompe la vista.
    $pausa = $fila['pausada'] ? ' (EN PAUSA)' : '';
    $atraso = $fila['dias_vencida'] ? ' | Vencida hace '.$fila['dias_vencida'].' d' : '';
    $quieta = $fila['dias_sin_movimiento'] !== null
        ? $fila['dias_sin_movimiento'].' d habiles'
        : 'nunca';
@endphp
#{{ $fila['id'] }} | {{ $fila['titulo'] }} | Proyecto: {{ $fila['proyecto'] ?? '-' }} | Resp: {{ $fila['responsable'] ?? 'SIN ASIGNAR' }} | Estado: {{ $fila['estado'] }}{{ $pausa }} | Prioridad: {{ $fila['prioridad'] ?? '-' }} | Vence: {{ $fila['vencimiento'] ?? '-' }}{{ $atraso }} | Sin movimiento: {{ $quieta }}

@empty
(ninguna)
@endforelse
@if ($datos['secciones'][$clave]['total'] > $datos['secciones'][$clave]['mostrado'])
... {{ $datos['secciones'][$clave]['total'] - $datos['secciones'][$clave]['mostrado'] }} mas no listadas
@endif

@endforeach
== CARGA POR RESPONSABLE ==
@forelse ($datos['por_responsable'] as $nombre => $c)
{{ $nombre }}: {{ $c['vencidas'] }} vencidas, {{ $c['estancadas'] }} estancadas, {{ $c['vencen_pronto'] }} por vencer
@empty
(sin datos)
@endforelse

== FIN DEL RESUMEN ==
