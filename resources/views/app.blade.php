<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="csrf-token" content="{{ csrf_token() }}">
        <title>WorkBoard</title>
        <link href="{{ asset('css/app.css') }}" rel="stylesheet">
        <!-- colocar favicon -->
        <link rel="icon" href="{{ asset('favicon.ico') }}">
    </head>
    <body>
        <div id="app"></div>
        <script src="{{ asset('js/app.js') }}"></script>
    </body>
</html>
