import esbuild from 'esbuild';

async function build() {
  await esbuild.build({
    entryPoints: ['src/cli.ts'],
    bundle: true,
    minify: true,
    format: 'esm',
    platform: 'node',
    target: ['node18'],
    outfile: 'dist/cli.min.js',
    sourcemap: false,
    external: [
      '@aws-sdk/client-cognito-identity-provider',
      '@aws-sdk/credential-providers',
      'commander',
      'cognito-srp-helper',
      'inquirer',
    ],
    define: {
      'process.env.NODE_ENV': '"production"',
    },
  });
}

build().catch((err) => {
  console.error('❌ Build failed:', err);
  process.exit(1);
});