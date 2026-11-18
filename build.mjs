import { copyFile, cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { views } from './src/views/index.mjs';

const fonts = [
  ['@fontsource-variable/geist', 'geist-latin-wght-normal.woff2', 'geist.woff2'],
  ['@fontsource/barlow-condensed', 'barlow-condensed-latin-800-normal.woff2', 'barlow-condensed.woff2'],
];

const stylesheets = [
  'styles/base.css',
  'styles/photo-slide.css',
  ...views.map((id) => `views/${id}/styles.css`),
  'components/deck-controls.css',
  'components/sources.css',
  'styles/responsive.css',
];

const readSource = (file) => readFile(`src/${file}`, 'utf8');
const [page, layout, controls, sources, slides, styles, ...licenseTexts] = await Promise.all([
  readSource('index.html'),
  readSource('layout/presentation.html'),
  readSource('components/deck-controls.html'),
  readSource('components/sources.html'),
  Promise.all(views.map((id) => readSource(`views/${id}/index.html`))),
  Promise.all(stylesheets.map(readSource)),
  ...['three', 'zustand', ...fonts.map(([name]) => name)]
    .map((name) => readFile(`node_modules/${name}/LICENSE`, 'utf8')),
]);

const licenses = ['Three.js', 'Zustand', 'Geist', 'Barlow Condensed']
  .map((label, index) => `${label}\n\n${licenseTexts[index].trim()}`).join('\n\n');
const css = styles.map((style) => style.trimEnd()).join('\n\n') + '\n';
const deck = slides.map((slide) => slide.trimEnd()).join('\n\n');

function composePage(content, templates = '') {
  return page.replace('  <!-- layout -->', () => layout.trimEnd()
    .replace('      <!-- diapositivas -->', () => content)
    .replace('  <!-- plantillas -->', () => templates)
    .replace('  <!-- controles -->', () => controls.trimEnd())
    .replace('  <!-- fuentes -->', () => sources.trimEnd()));
}

await mkdir('dist/assets', { recursive: true });
await Promise.all([
  build({
    entryPoints: ['src/presentation.js'],
    outfile: 'dist/presentacion.js',
    bundle: true,
    minify: true,
    format: 'iife',
    target: ['es2022'],
    legalComments: 'inline',
  }),
  writeFile('dist/index.html', composePage(
    `<noscript>\n${deck}\n</noscript>`,
    `<template id="slide-templates">\n${deck}\n</template>`,
  )),
  writeFile('dist/presentacion.css', css),
  writeFile('dist/LICENCIAS.txt', licenses + '\n'),
  cp('public/assets', 'dist/assets', { recursive: true }),
  ...fonts.map(([name, source, destination]) =>
    copyFile(`node_modules/${name}/files/${source}`, `dist/assets/${destination}`)),
]);

if (process.argv.includes('--offline')) {
  const script = await readFile('dist/presentacion.js', 'utf8');
  const dataUri = async (file, contentType) => (
    `data:${contentType};base64,${(await readFile(`dist/assets/${file}`)).toString('base64')}`
  );

  let offlineCss = css;
  for (const [, , destination] of fonts) {
    offlineCss = offlineCss.replace(`assets/${destination}`, await dataUri(destination, 'font/woff2'));
  }

  // Keep the standalone deck readable with scripting disabled and embed each photo at full resolution.
  let offlinePage = composePage(deck).replace(/ (?:srcset|sizes)="[^"]*"/g, '');
  const photos = new Set([...offlinePage.matchAll(/src="assets\/([\w-]+)-\d+\.webp"/g)].map((match) => match[1]));
  for (const name of photos) {
    const embedded = await dataUri(`${name}-3840.webp`, 'image/webp');
    offlinePage = offlinePage.replace(new RegExp(`src="assets/${name}-\\d+\\.webp"`, 'g'), `src="${embedded}"`);
  }

  offlinePage = offlinePage.replace('<link rel="stylesheet" href="presentacion.css">', () => `<style>\n${offlineCss}\n</style>`)
    .replace('<script defer src="presentacion.js"></script>', () => `<!--\n${licenses.replaceAll('--', '—')}\n-->`)
    .replace('</body>', () => `<script>\n${script.replaceAll('</script', '<\\/script')}\n</script>\n</body>`);
  await writeFile('../Presentacion_Comision_Asesora_Lavalleja.html', offlinePage);
  console.log('Copia sin conexión: Presentacion_Comision_Asesora_Lavalleja.html');
}
