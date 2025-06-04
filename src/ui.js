// filepath: cli-ui/src/ui.js
// ui.js - CommonJS Console UI: database selection, directory selection, and progress bar utilities
const inquirer = require('inquirer');
const cliProgress = require('cli-progress');
const path = require('path');
const fs = require('fs/promises');
const chalk = require('chalk');

/**
 * Prompt user to select or enter a MongoDB connection string
 * @returns {Promise<string>} MongoDB connection URI
 */
async function selectMongoConnection() {
  const presetChoices = [
    { name: 'Localhost (mongodb://localhost:27017)', value: 'mongodb://localhost:27017' },
    { name: 'Remote 10.10.200.150 (mongodb://10.10.200.150:27017)', value: 'mongodb://10.10.200.150:27017' },
    new inquirer.Separator(),
    { name: 'Other (enter custom URI)', value: 'OTHER' }
  ];
  const { uriChoice } = await inquirer.prompt([ 
    {
      type: 'list',
      name: 'uriChoice',
      message: chalk.green('🔗 Select MongoDB connection:'),
      choices: presetChoices
    }
  ]);
  if (uriChoice === 'OTHER') {
    const { customUri } = await inquirer.prompt([ 
      {
        type: 'input',
        name: 'customUri',
        message: chalk.green('🌐 Enter MongoDB connection URI:')
      }
    ]);
    return customUri.trim();
  }
  return uriChoice;
}

/**
 * Prompt user to select a directory containing HL7 files
 * @returns {Promise<string>} Absolute path to selected directory
 */
async function selectDirectory() {
  const cwd = process.cwd();
  let dirs = [];
  try {
    const entries = await fs.readdir(cwd, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const subPath = path.join(cwd, e.name);
      const subFiles = await fs.readdir(subPath);
      const hasHL7 = subFiles.some(f => f.toLowerCase().endsWith('.hl7') || f.toLowerCase().endsWith('.txt'));
      if (hasHL7) dirs.push(e.name);
      else {
        const nested = await fs.readdir(subPath, { withFileTypes: true });
        for (const n of nested) {
          if (!n.isDirectory()) continue;
          const nestPath = path.join(subPath, n.name);
          const nestFiles = await fs.readdir(nestPath);
          if (nestFiles.some(f => f.toLowerCase().endsWith('.hl7') || f.toLowerCase().endsWith('.txt'))) {
            dirs.push(`${e.name}/${n.name}`);
          }
        }
      }
    }
  } catch {}
  const rootFiles = await fs.readdir(cwd);
  if (rootFiles.some(f => f.toLowerCase().endsWith('.hl7') || f.toLowerCase().endsWith('.txt'))) {
    dirs.unshift('.');
  }
  const choices = dirs.map(d => ({ name: `${chalk.cyan('📂')} ${d}`, value: d }));
  choices.push(new inquirer.Separator(), { name: chalk.yellow('🌐 Other...'), value: 'OTHER' });
  const { dirChoice } = await inquirer.prompt([ 
    {
      type: 'list',
      name: 'dirChoice',
      message: chalk.green('📁 Select a folder containing HL7 or .txt files:'),
      choices,
      pageSize: 10
    }
  ]);
  if (dirChoice === 'OTHER') {
    const { customDir } = await inquirer.prompt([ 
      {
        type: 'input',
        name: 'customDir',
        message: chalk.green('🔍 Enter the path to the folder containing HL7 or .txt files:')
      }
    ]);
    return path.resolve(customDir);
  }
  return path.resolve(cwd, dirChoice);
}

/**
 * Create and start a progress bar for total items
 * @param {number} total - Total number of items to process
 * @returns {cliProgress.SingleBar} Progress bar instance
 */
function createProgressBar(total) {
  const bar = new cliProgress.SingleBar(
    {
      format: `${chalk.blue('Progress')} |{bar}| {percentage}% || {value}/{total} Files || ETA: {eta_formatted}`,
      hideCursor: true,
      barsize: 30
    },
    cliProgress.Presets.shades_classic
  );
  bar.start(total, 0);
  return bar;
}

module.exports = {
  selectMongoConnection,
  selectDirectory,
  createProgressBar
};