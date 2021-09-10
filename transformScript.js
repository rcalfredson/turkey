var fs = require("fs");
var browserify = require("browserify");
var path = require('path');

if (process.argv.length <= 2) {
    console.warn('No script specified. Exiting.')
    process.exit(0);
}

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

let scriptName = process.argv[2];
let isDev = process.argv.length > 3 && process.argv[3].startsWith('--dev')
let modifierString = isDev ? capitalizeFirstLetter(process.argv[3].split('--')[1]) : '';
browserify(scriptName)
    .transform("babelify", { presets: ["@babel/preset-env"] })
    .bundle()
    .pipe(fs.createWriteStream(`bundle${capitalizeFirstLetter(path.basename(
        scriptName).replace(/\.[^/.]+$/, ""))}${modifierString}.js`));