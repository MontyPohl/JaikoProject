// mobile/babel.config.js
const path = require('path')

module.exports = function (api) {
  api.cache(true)
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            // path.resolve convierte '../shared' en una ruta absoluta
            // como C:\Users\monty\...\JAIKO\shared
            // Así Metro no tiene dudas de dónde buscar el archivo.
            '@shared': path.resolve(__dirname, '../shared'),
          },
        },
      ],
    ],
  }
}