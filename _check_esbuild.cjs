const esbuild = require('esbuild');
esbuild.build({
  entryPoints: ['src/ui/DataPanel.tsx'],
  bundle: false,
  write: false,
  jsx: 'automatic',
  loader: { '.tsx': 'tsx' },
}).then(r => {
  console.log('OK: ' + r.outputFiles[0].text.length + ' bytes');
  if (r.outputFiles[0].text.includes('BeamDataContent')) {
    console.log('BeamDataContent FOUND in output');
  } else {
    console.log('BeamDataContent NOT FOUND in output');
  }
}).catch(e => {
  console.log('ERROR: ' + e.message);
});
