const fs = require('fs');
const path = require('path');

const Assembler = require('../as/assembler');

const argv = process.argv.slice(2);

if (argv.length < 1) {
    console.log("lc3as [source] ...");
    process.exit(2);
}

const filename = path.resolve(argv[0]);
const assembler = new Assembler(fs.readFileSync(filename, 'utf8'), filename);
const machineCodes = assembler.codegen();
const outputFile = path.join(path.dirname(filename), path.basename(filename, '.asm') + '.obj');
fs.writeFileSync(outputFile, machineCodes);
