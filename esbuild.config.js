import esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['dist/cli.js'],
  bundle: true,
  minify: true,
  platform: 'node',
  target: ['node18'],
  outfile: 'dist/cli.min.js',
  external: [
    'aws-sdk', 'crypto', 'fs', 'path', 'os', 'child_process',
    '@aws-sdk/client-cognito-identity-provider',
    'inquirer', 'commander', 'chalk', 'figlet', 'gradient-string'
  ]
}).catch(() => process.exit(1));