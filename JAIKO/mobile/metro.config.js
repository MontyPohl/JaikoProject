// mobile/metro.config.js
//
// ¿Por qué este archivo?
// Metro (el bundler de Expo) por defecto solo puede leer archivos
// dentro de la carpeta mobile/. Como shared/ está un nivel arriba,
// necesitamos decirle explícitamente que también la vigile.

const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const projectRoot = __dirname
const sharedRoot = path.resolve(projectRoot, '../shared')

const config = getDefaultConfig(projectRoot)

// Le decimos a Metro que también puede leer archivos de shared/
config.watchFolders = [sharedRoot]

// Le decimos desde dónde resolver módulos (primero mobile/, luego shared/)
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
]

module.exports = config