# Presentación de la Comisión Pro Creación del Área de Discapacidad, Inclusión y Accesibilidad

## Editar las diapositivas

- Cada carpeta en `src/views/` contiene el HTML y los estilos de una diapositiva. Las imágenes están en `public/assets/`. El mapa interactivo también tiene su código en `src/views/mapa/`.
- `src/views/index.mjs` define el orden. El atributo `data-transition` de cada diapositiva define su paso a la siguiente. Los valores son `diagonal`, `vertical` y `horizontal`.
- `src/layout/` contiene el layout y `src/components/` el contenedor de diapositivas, los controles y las fuentes. Los estilos compartidos y los ajustes de pantalla están en `src/styles/`.
- Zustand guarda en el navegador la última diapositiva y la preferencia de movimiento. Un enlace con un identificador, como `/#mapa`, abre esa diapositiva directamente.

## Previsualizar

```sh
npm ci
npm run build
npm run preview
```

La presentación se sirve en [127.0.0.1:4173](http://127.0.0.1:4173/). El build genera `dist/` a partir de los archivos fuente. Para generar el HTML autónomo en la carpeta superior, usá `npm run build -- --offline`.

## Docker y Coolify

```sh
docker compose up --build
```

La prueba local con Docker queda disponible en [127.0.0.1:8080](http://127.0.0.1:8080/). La variable `PRESENTATION_PORT` permite elegir otro puerto local. Para Coolify, seleccioná **Dockerfile** como Build Pack, usá la raíz del proyecto como directorio base y configurá **Ports Exposes** en `80`. Nginx sirve la presentación en ese puerto y responde en `/health`.
