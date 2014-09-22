/*!
 * Module dependencies.
 */
 
var archiver = require('archiver'),
    fs = require('fs'),
    path = require('path'),
    findit = require('findit'),
    mkpath = require('mkpath'),
    ncp = require('ncp').ncp;

/**
 * Generates the zips of each of the Cordova versions and platforms
 *
 *
 * Arguments:
 * 
 *
 * Return:
 *
 *
 * Example:
 *
 *
 */

module.exports = function(options, callback){
    var resPath = path.join(__dirname, '../../../res/middleware'),
        cordovaPath = path.join(resPath, 'cordova', '3.5.0', 'ios'),
        zipPath = path.join(__dirname, '../../../tmp', options.req.sessionID),
        wwwPath = path.join(zipPath, 'www');

    var autoreloadScript = path.join(resPath, 'autoreload.js'),
        consoleScript = path.join(resPath, 'consoler.js'),
        homepageScript = path.join(resPath, 'homepage.js'),
        refreshScript = path.join(resPath, 'refresh.js');

    var injectScript = function() {
        var scripts = fs.readFileSync(autoreloadScript) +
                      fs.readFileSync(consoleScript)    +
                      fs.readFileSync(homepageScript)   +
                      fs.readFileSync(refreshScript);

        // replace default server address with this server address
        return scripts.replace(/127\.0\.0\.1:3000/g, options.req.headers.host);
    };

    // make our www
    if(!fs.existsSync(wwwPath)){
        mkpath.sync(wwwPath, '0700');
    }

    // copy over our files first
    ncp(path.join(process.cwd(), 'www'), wwwPath, { filter: '**/*' }, function (err) {
        if (err) {
            //error out
            console.log('generate-zip error:', err);
            return callback(err);
        }

        // find the html files to inject our scripts into
        var finder = findit(wwwPath);
        finder.on('file', function (file, stat) {
            var destPath = path.join(wwwPath, file.split('www')[1]);
            if (file.indexOf('.html') > -1) {
                var writer = fs.createWriteStream(destPath, {'flags': 'a'});
                writer.end(injectScript());
            }
        });

        finder.on('end', function(){
            // zip it
            var outputPath = path.join(zipPath, 'app.zip');
            var output = fs.createWriteStream(outputPath);
            var archive = archiver('zip');

            output.on('close', function () {
                options.emitter.emit('log', 'archived app: ' + archive.pointer(), 'total bytes');
                callback(null, { zipPath: outputPath });
            });

            archive.on('error', function(err){
                options.emitter.emit('log', 'error', err);
                callback(err);
            });

            archive.pipe(output);

            archive.bulk([
                { expand: true, cwd: wwwPath, src: ['**/*'] },
                { expand: true, cwd: cordovaPath, src: ['plugins/**/*'] }
            ]);

            archive.finalize();
        });
    });
};