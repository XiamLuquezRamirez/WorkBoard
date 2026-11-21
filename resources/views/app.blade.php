<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="csrf-token" content="{{ csrf_token() }}">
        {{-- Base pública real: el JavaScript resuelve contra ella las imágenes
             y la API, en vez de llevar un host escrito a mano. --}}
        <meta name="asset-base" content="{{ rtrim(asset(''), '/') }}">
        <title>WorkBoard</title>
        <link href="{{ asset(ltrim(mix('css/app.css'), '/')) }}" rel="stylesheet">
        <!-- colocar favicon -->
        <link rel="icon" href="{{ asset('favicon.ico') }}">
    </head>
    <body>
        <div id="app"></div>
        <script src="{{ asset(ltrim(mix('js/app.js'), '/')) }}"></script>
    </body>
</html>
