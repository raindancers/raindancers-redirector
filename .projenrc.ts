import { awscdk, javascript } from 'projen';
const project = new awscdk.AwsCdkConstructLibrary({
  author: 'Andrew Frazer',
  authorAddress: 'mrpackethead@users.noreply.github.com',
  cdkVersion: '2.261.0',
  jsiiVersion: '~6.0.0',
  name: 'raindancers-redirector',
  packageManager: javascript.NodePackageManager.NPM,
  projenrcTs: true,
  repositoryUrl: 'https://github.com/raindancers/raindancers-redirector',
  tsconfigDev: {
    compilerOptions: {
      isolatedModules: true,
    },
  },
});
project.synth();