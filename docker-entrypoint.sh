#!/bin/sh
set -e

echo "Iniciando configuracion de base de datos..."
node setupDatabase.js

echo "Iniciando servidor CREDIA..."
exec node index.js
