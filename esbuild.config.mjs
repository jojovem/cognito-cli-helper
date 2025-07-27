import esbuild from 'esbuild';

async function build() {
  await esbuild.build({
    entryPoints: ['src/cli.ts'],
    bundle: true,
    minify: true,
    format: 'cjs',
    platform: 'node',
    target: ['node18'],
    outfile: 'dist/cli.min.js',
    sourcemap: true,
    external: [
      '@aws-sdk/client-cognito-identity-provider',
      'inquirer', 
      'commander'
    ]
  });
}

build().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});