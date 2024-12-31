import assert from 'assert';
import {Command} from 'commander';;
import enquirer from 'enquirer';
import {compilePack} from '@foundryvtt/foundryvtt-cli';
import fs from 'fs/promises';
import path from 'path';
import {rimraf} from 'rimraf';

const {Confirm} = enquirer

const packageRoot = path.resolve(import.meta.dirname, '..')

// Read the package.json
const packageJson = await fs.readFile(path.join(packageRoot, 'package.json'));
const pkg = JSON.parse(packageJson);

const program = new Command();

program
  .name('extract')
  .description('Converts yaml files to operational foundry module.')
  .version(pkg.version)
  .option('--data-dir <data>', 'Data directory to load files into', path.join(packageRoot, 'packs'))
  .option('--source-dir <source>', 'Source Directory to load yaml files from', path.join(packageRoot, 'src', 'packs'))
  .option('-y,--yes', "Don't ask for confirmation, just do it.", )
  .action(async (options, command) => {
    if (!options.yes) {
      const confirm = new Confirm({
        name: 'question',
        message: `This will overwrite compiled foundry data in ${options.dataDir}. Continue?`
      });
      
      if (!await confirm.run()) {
        console.log(`Cancelled`)
      }
    }

    // Read in the module.json 
    let mj = {};
    const moduleJsonPath = path.resolve(options.sourceDir, '../module.json');
    try {
      const moduleJson = await fs.readFile(moduleJsonPath);
      mj = JSON.parse(moduleJson);  
    } catch(err) {
      console.error(`Caught error trying to open module.json at ${moduleJsonPath}: ${err}`)
      return process.exit(1);
    }

    try {
      // Make sure the data directory exists and isn't empty
      await fs.access(options.dataDir);
      await rimraf(options.dataDir);
    } catch {
      console.error(`data directory ${options.dataDir} doesn't exist!`)
    }

    try {
      await fs.access(options.sourceDir);
    } catch (error) {
      console.log(error);
      // Do nothing
      Function.prototype();
    }
    
    console.log(`(Re)creating data in ${options.dataDir}`)
    await fs.mkdir(options.dataDir);

    for (let pack of mj.packs) {
      const dataPath = path.join(options.dataDir, pack.name);
      const packName = pack.name;
      const documentType = pack.type;
      const sourcePath = path.join(options.sourceDir, packName)

      pack.path = `./packs/${packName}`;
      console.log(`Compiling ${sourcePath} to ${dataPath} `)
      await fs.mkdir(dataPath);
      await compilePack(
        sourcePath,
        dataPath,
        {
          documentType,
          recursive: true,
          yaml: true,
          log: true,
        }
      )
    }

    const mjPath = path.resolve(options.dataDir, '..', 'module.json');

    console.log(`Writing module.json to ${mjPath}`);

    await fs.writeFile(mjPath, JSON.stringify(mj, null, 2))
  });


await program.parseAsync()
