'use strict';

const path = require('path');
const fs = require('fs');

const OS = require('./os');

const argv = process.argv.slice(2);

if (argv.length < 1) {
    console.log("lc3 [image-file] ...");
    process.exit(2);
}

function readImage(img) {
    const data = fs.readFileSync(img);
    const dataUInt16 = new Uint16Array(data.length / 2);
    for (var i = 0; i < data.length; i += 2) {
        dataUInt16[i / 2] = data[i] << 8 | data[i + 1];
    }
    return dataUInt16;
}

const os = new OS();
os.boot(readImage(path.resolve(argv[0])));
