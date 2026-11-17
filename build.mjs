import { copyFile, readFile, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';

const fonts = [
  ['@fontsource-variable/geist', 'geist-latin-wght-normal.woff2', 'geist.woff2'],
  ['@fontsource/barlow-condensed', 'barlow-condensed-latin-800-normal.woff2', 'barlow-condensed.woff2'],
];

const [threeLicense, ...fontLicenses] = await Promise.all([
  readFile('node_modules/three/LICENSE', 'utf8'),
  ...fonts.map(([name]) => readFile(`node_modules/${name}/LICENSE`, 'utf8')),
]);

const licenses = [
  'Three.js', threeLicense,
  'Geist', fontLicenses[0],
  'Barlow Condensed', fontLicenses[1],
].join('\n\n');

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
  ...fonts.map(([name, source, destination]) =>
    copyFile(`node_modules/${name}/files/${source}`, `dist/assets/${destination}`)),
  writeFile('dist/LICENCIAS.txt', licenses),
]);

if (process.argv.includes('--offline')) {
  const [page, css, script] = await Promise.all([
    readFile('dist/index.html', 'utf8'),
    readFile('dist/presentacion.css', 'utf8'),
    readFile('dist/presentacion.js', 'utf8'),
  ]);
  const dataUri = async (file, contentType) => (
    `data:${contentType};base64,${(await readFile(`dist/assets/${file}`)).toString('base64')}`
  );

  let offlineCss = css;
  for (const [, , destination] of fonts) {
    offlineCss = offlineCss.replace(`assets/${destination}`, await dataUri(destination, 'font/woff2'));
  }

  let offlinePage = page.replace(/ (?:srcset|sizes)="[^"]*"/g, '');
  const largestPhotos = {
    serrana: 2560,
    arequita: 3840,
    charla: 2880,
    piso: 2880,
    senas: 2880,
    penitente: 1920,
  };
  for (const [name, width] of Object.entries(largestPhotos)) {
    const embedded = await dataUri(`${name}-${width}.webp`, 'image/webp');
    offlinePage = offlinePage.replace(new RegExp(`src="assets/${name}-\\d+\\.webp"`, 'g'), `src="${embedded}"`);
  }

  offlinePage = offlinePage.replace('<link rel="stylesheet" href="presentacion.css">', () => `<style>\n${offlineCss}\n</style>`)
    .replace('<script defer src="presentacion.js"></script>', `<!--\n${licenses.replaceAll('--', '—')}\n-->`)
    .replace('</body>', () => `<script>\n${script.replaceAll('</script', '<\\/script')}\n</script>\n</body>`);
  await writeFile('../Presentacion_Comision_Asesora_Lavalleja.html', offlinePage);
  console.log('Copia sin conexión: Presentacion_Comision_Asesora_Lavalleja.html');
}
