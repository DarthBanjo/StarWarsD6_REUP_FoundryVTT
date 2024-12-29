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
  .name('convert')
  .description('Converts the legacy files in `packs/` to YAML')
  .version(pkg.version)
  .option('--source-dir <source>', 'Source directory', path.join(packageRoot, 'packs'))
  .option('--target-dir <target>', 'Target Directory', path.join(packageRoot, 'src', 'packs'))
  .option('--nedb', "Extract NEDB files")
  .action(async (options, command) => {
    let mod = {};
    if (options.nedb) {
      const moduleJson = await fs.readFile(path.resolve(options.sourceDir, '..', 'module.json'));
      mod = JSON.parse(moduleJson);
    }

    const confirm = new Confirm({
      name: 'question',
      message: `This will overwrite all files in ${options.targetDir} with data extracted from ${options.sourceDir}. Continue?`
    });
    
    if (!await confirm.run()) {
      console.log(`Cancelled`)
    }

    if (options.nedb) {

    }
    try {
      // Make sure the source directory exists and isn't empty
      await fs.access(options.sourceDir);
      let sourceFiles = await fs.readdir(options.sourceDir);
      if (length(sourceFiles) == 0) {
        console.error(`Source directory ${options.sourceDir} doesn't contain any files!`)
        process.exit(1)
      }
    } catch {
      console.error(`Source directory ${options.sourceDir} doesn't exist!`)
    }

    try {
      await fs.access(options.targetDir);
      console.log(`Deleting target ${options.targetDir}`)
      await rimraf(options.targetDir);
      await unlink(options.targetDir);
    } catch (error) {
      console.log(error);
      // Do nothing
      Function.prototype();
    }
    
    console.log(`(Re)creating target ${options.targetDir}`)
    await fs.mkdir(options.targetDir);

    for (let packName of await fs.readdir(options.sourceDir)) {
      const sourcePath = path.join(options.sourceDir, packName);
      let documentType = null;

      if (options.nedb) {
        if (!packName.endsWith('.db')) {
          console.error(`Won't attempt to convert non-NEDB file ${packName}`);
          continue;
        }
        
        for (let p of mod.packs) {
          if (p.path.endsWith(packName)) {
            documentType = p.type
          }
        }
        if (!documentType) {
          console.warn(`Couldn't identify document type for ${packName}.  Skipped.`)
          continue;
        }
        packName = path.basename(packName, '.db')        
      }

      const targetPath = path.join(options.targetDir, packName)
      
      console.log(`Extracting ${sourcePath} to ${targetPath}`)
      await fs.mkdir(targetPath);
      await extractPack(
        sourcePath,
        targetPath,
        {
          nedb: options.nedb,
          documentType,
        }
      )
    }

  })

await program.parseAsync()
