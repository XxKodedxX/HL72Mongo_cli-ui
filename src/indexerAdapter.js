// indexerAdapter.js - CLI for parsing and uploading HL7 files
const fs = require('fs').promises;
const path = require('path');
const Parser = require('./parserAdapter.js');
const Extractor = require('./extractorAdapter.js');
const { connect, ensureIndexes, insertDocument } = require('./dbClientAdapter.js');
const { selectMongoConnection, selectDirectory } = require('./ui.js');
const cliProgress = require('cli-progress');

const bar = new cliProgress.SingleBar({
  format: '{bar} {percentage}% | {value}/{total} files processed',
  barCompleteChar: '█',
  barIncompleteChar: '░'
});

async function processFolder(folderPath) {
  try {
    const files = await fs.readdir(folderPath);
    const hl7Files = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ext === '.hl7' || ext === '.txt';
    });

    if (hl7Files.length === 0) {
      console.log('No HL7 or .txt files found in the selected folder.');
      return;
    }

    console.log(`Found ${hl7Files.length} HL7 files to process`);
    const parser = new Parser();
    const extractor = new Extractor();

    await ensureIndexes();
    bar.start(hl7Files.length, 0);

    for (let i = 0; i < hl7Files.length; i++) {
      const file = hl7Files[i];
      try {
        const filePath = path.join(folderPath, file);
        const fileContent = await fs.readFile(filePath, 'utf8');
        const parsed = parser.parse(fileContent);
        const doc = extractor.extract(parsed, fileContent);
        await insertDocument('messages', doc);
        bar.update(i + 1);
      } catch (error) {
        console.error(`Error processing file ${file}: ${error.message}`);
      }
    }

    bar.stop();
    console.log('Processing complete!');
  } catch (error) {
    console.error('Error processing folder:', error);
  }
}

async function main() {
  try {
    const uri = await selectMongoConnection();
    process.env.MONGO_URL = uri;
    const folderPath = await selectDirectory();
    await processFolder(folderPath);
    process.exit(0);
  } catch (error) {
    console.error('An error occurred:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { processFolder };
