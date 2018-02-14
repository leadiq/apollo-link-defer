const globals = {
  'apollo-link': 'apolloLink.core'
}

export default {
  input: 'lib/index.js',
  output: {
    file: 'lib/bundle.umd.js',
    format: 'umd',
    sourcemap: true,
    name: 'apolloLink.defer',
    exports: 'named'
  },
  external: Object.keys(globals),
  onwarn,
};

function onwarn(message) {
  const suppressed = ['UNRESOLVED_IMPORT', 'THIS_IS_UNDEFINED'];

  if (!suppressed.find(code => message.code === code)) {
    return console.warn(message.message);
  }
}