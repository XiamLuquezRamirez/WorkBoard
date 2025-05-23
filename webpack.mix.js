const mix = require('laravel-mix');

mix.setPublicPath('public');

mix.js('resources/js/app.js', 'public/js')
    .react()
    .css('resources/css/app.css', 'public/css')
    .webpackConfig({
        resolve: {
            extensions: ['.js', '.jsx']
        }
    })
    .options({
        hmrOptions: {
            host: 'localhost',
            port: 8080
        }
    })
    // Copiar imágenes a la carpeta public
    .copy('resources/images', 'public/images')
    .version();

// Habilitar hot reloading
if (!mix.inProduction()) {
    mix.webpackConfig({
        devtool: 'source-map'
    });
} 