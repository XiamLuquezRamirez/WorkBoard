RESUMEN TABLERO WORKBOARD | {{ $datos['fecha'] }}
Generado: {{ $datos['generado'] }} ({{ $datos['zona'] }})
Alcance: {{ $datos['alcance'] }}

== INDICADORES ==
Tareas abiertas: {{ $datos['metricas']['abiertas'] }}
Vencidas: {{ $datos['metricas']['vencidas'] }}
Estancadas: {{ $datos['metricas']['estancadas'] }}
Sin responsable: {{ $datos['metricas']['sin_responsable'] }}
Vencen pronto: {{ $datos['metricas']['vencen_pronto'] }}
Sin fecha pactada: {{ $datos['metricas']['sin_fecha'] }}
En pausa: {{ $datos['metricas']['pausadas'] }}
Responsable sin ficha: {{ $datos['metricas']['ficha_faltante'] }}
Bloqueadas: {{ $datos['metricas']['bloqueadas'] }}
Esperan verificacion: {{ $datos['metricas']['por_verificar'] }}
Sin criterio pactado: {{ $datos['metricas']['sin_criterio'] }}

@foreach ($secciones as $clave => $titulo)
== {{ $titulo }} ({{ $datos['secciones'][$clave]['total'] }}) ==
@forelse ($datos['secciones'][$clave]['filas'] as $fila)
@php
    // Los tramos condicionales se arman aquí: intercalar @if/@endif dentro de
    // una línea de texto no lo compila Blade y rompe la vista.
    $pausa = $fila['pausada'] ? ' (EN PAUSA)' : '';
    // El motivo es lo que hay que leer de una bloqueada: sin él la línea sólo
    // dice que algo falla, no qué.
    $trabada = $fila['bloqueada']
        ? ' | BLOQUEADA: '.($fila['motivo_bloqueo'] ?: 'sin motivo registrado')
        : '';
    $atraso = $fila['dias_vencida'] ? ' | Vencida hace '.$fila['dias_vencida'].' d' : '';
    $quieta = $fila['dias_sin_movimiento'] !== null
        ? $fila['dias_sin_movimiento'].' d habiles'
        : 'nunca';
@endphp
#{{ $fila['id'] }} | {{ $fila['titulo'] }} | Proyecto: {{ $fila['proyecto'] ?? '-' }} | Resp: {{ $fila['responsable'] ?? 'SIN ASIGNAR' }} | Estado: {{ $fila['estado'] }}{{ $pausa }} | Prioridad: {{ $fila['prioridad'] ?? '-' }} | Vence: {{ $fila['vencimiento'] ?? '-' }}{{ $atraso }} | Sin movimiento: {{ $quieta }}{{ $trabada }}

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
