import assert from 'assert';
import {Command} from 'commander';;
import enquirer from 'enquirer';
import {extractPack} from '@foundryvtt/foundryvtt-cli';
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
  .description('Converts an operational foundry module to YAML files.')
  .version(pkg.version)
  .option('--data-dir <data>', 'Data directory', path.join(packageRoot, 'packs'))
  .option('--source-dir <source>', 'Source Directory', path.join(packageRoot, 'src', 'packs'))
  .option('--nedb', "Extract NEDB files")
  .option('-y,--yes', "Don't ask for confirmation, just do it.", )
  .action(async (options, command) => {
    if (!options.yes) {
      const confirm = new Confirm({
        name: 'question',
        message: `This will overwrite all files in ${options.sourceDir} with data extracted from ${options.dataDir}. Continue?`
      });
      
      if (!await confirm.run()) {
        console.log(`Cancelled`)
      }
    }

    // Read in the module.json 
    let mj = {};
    const moduleJsonPath = path.resolve(options.dataDir, '..', 'module.json');
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
      let dataFiles = await fs.readdir(options.dataDir);
      if (dataFiles.length == 0) {
        console.error(`data directory ${options.dataDir} doesn't contain any files!`)
        process.exit(1)
      }
    } catch(err) {
      console.error(`data directory ${options.dataDir} doesn't exist: ${err}`)
      return process.exit(1);
    }

    try {
      await fs.access(options.sourceDir);
      console.log(`Deleting source ${options.sourceDir}`)
      await rimraf(options.sourceDir);
    } catch (error) {
      console.log(error);
      // Do nothing
      Function.prototype();
    }
    
    console.log(`(Re)creating source ${options.sourceDir}`)
    await fs.mkdir(options.sourceDir);

    for (let pack of mj.packs) {
      const dataPath = await path.resolve(await path.dirname(moduleJsonPath), pack.path);
      const packName = pack.name;
      const documentType = pack.type;
      
      pack.path=`./packs/${packName}`;

      if (options.nedb) {
        if (!dataPath.endsWith('.db')) {
          console.error(`Won't attempt to convert non-NEDB file ${packName}`);
          continue;
        }   
      }

      const sourcePath = path.join(options.sourceDir, packName)
      
      console.log(`Extracting ${dataPath} to ${sourcePath}`)
      await fs.mkdir(sourcePath);
      await extractPack(
        dataPath,
        sourcePath,
        {
          nedb: options.nedb,
          documentType,
        }
      )
    }

    console.log(`Writing updated module.json template`);
    await fs.writeFile(
      path.resolve(options.sourceDir, '../module.json'),
      JSON.stringify(mj, null, 2)
    );
  }
)

await program.parseAsync()
