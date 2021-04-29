var minify = require('html-minifier').minify;
var fs = require('fs');
var appHtml = fs.readFileSync('app.html');
var input = appHtml.toString();
var output = minify(input, { collapseWhitespace: false });
var parentHtml = fs.readFileSync('Mturk.html').toString();

var matches = parentHtml.match(/\/\/\simportScript(?:(.|\n)*?)\/\/\sendImportScript/);

var scriptString = '// importScript\n';
let splitOutput = output.split('\n');
let numParts = splitOutput.length;
splitOutput.forEach((part, i) => {
    const matchLength = '</script>'.length;
    let scriptMatches = part.match(/<\/script>/)
    if (scriptMatches && scriptMatches.length > 0) {
        let splitIndex = scriptMatches.index + matchLength - 5;
        let parts = [part.substring(0, splitIndex), part.substring(splitIndex)]
        parts.forEach((subPart, j) => {
            scriptString += `'${subPart}' ${i + 1 == numParts && j > 0 ? '' : '+\n'}`
        })
    } else {
        part = part.replace(/\'/g, '\\\'');
        scriptString += `'${part}' ${i + 1 == numParts ? '' : '+\n'}`
    }
})
scriptString += '// endImportScript';
parentHtml = parentHtml.replace(matches[0], matches[0].replace(/\/\/\simportScript(.|\n|\r)+\/\/\sendImportScript/g, scriptString));
let isDev = process.argv.length > 2 && process.argv[2] == '--dev'
let modifierString = isDev ? 'Dev' : '';
if (isDev) {
    parentHtml = parentHtml.replace(/bundle\.min\.js/g, 'bundleDev.min.js');
    parentHtml = parentHtml.replace(/bundleHelpers\.min\.js/g, 'bundleHelpersDev.min.js');
}
let htmlOutFilename = `MTurk${modifierString}.html`
fs.writeFile(htmlOutFilename, parentHtml, (err) => {
    if (err) {
        return console.log(err);
    }
    console.log(`Saved ${htmlOutFilename}!`);
});
