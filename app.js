const LogFile = require("./LogFile");

const fs = require("fs");
const fsp = require("fs/promises");
const EventEmitter = require('events');
const path = require('path');
const readline = require('readline');

const directory = process.argv[2];

const emitter = new EventEmitter();

const flag = process.argv[3];

const fileStats = new Map();

const debounceMap = new Map();

const summary = [];

const watchDirectory = function (directory) {

    console.log(`Observing for changes in the directory: ${directory}...\n`);

    const watcher = fs.watch(directory, { recursive: true }, async (eventType, fileName) => {

        if (!fileName) return;

        const fullPath = path.join(directory, fileName);

        let stat;

        try {
            stat = await fsp.stat(fullPath);
        } catch {
            return;
        }
        if (!stat.isFile()) return;
        if (path.extname(fileName) !== '.log') return;

        clearTimeout(debounceMap.get(fullPath));

        debounceMap.set(
            fullPath,

            setTimeout(async () => {

                console.log(`Change detected: ${fileName}. Reanalyzing file...\n`);

                try {

                    const old = fileStats.get(fullPath);

                    const newStats = await analyzeFile(fullPath, stat);

                    if (!newStats) return;

                    if (old) {

                        const errorDiff = newStats.error - old.error;
                        const warnDiff = newStats.warn - old.warn;
                        const infoDiff = newStats.info - old.info;

                        console.log(`Diff: ${fileName}`);

                        console.log(
                            `Errors: ${old.error} → ${newStats.error} (${formatDiff(errorDiff)})`
                        );

                        console.log(
                            `Warns : ${old.warn} → ${newStats.warn} (${formatDiff(warnDiff)})`
                        );

                        console.log(
                            `Info  : ${old.info} → ${newStats.info} (${formatDiff(infoDiff)})`
                        );

                        console.log('---------------------------------\n');

                    } else {

                        console.log(`First analysis: ${fileName}\n`);

                    }

                } catch (err) {

                    console.log(`Error processing ${fileName}: ${err.message}`);

                }

            }, 200)
        );
    });

    setTimeout(() => {

        emitter.emit("stop");

    }, 60000);

    emitter.once("stop", () => {

        watcher.close();

        console.log("Watcher stopped.");

    });
};

const displaySummary = function(){
    let largestFile = '';
    let LargetFileSize = -1;

    let errorFile = '';
    let maxErrors = -1;

    console.log('-----------SUMMARY------------\n');
    summary.forEach((file) => {
        file.generateFileSummary();
        if(file.size > LargetFileSize){
            largestFile = file.getName();
            LargetFileSize = file.size;
        }

        if(file.error > maxErrors){
            errorFile = file.getName();
            maxErrors = file.error;
        }
    });
    console.log('\n------------------------------\n');
    console.log(`Larget File : ${largestFile} , Size: ${LargetFileSize}`);
    console.log(`${errorFile} has the maximum no of errors.\n`);
}

const analyzeFile = async function(filePath, meta){
    const stream = fs.createReadStream(filePath);

    const rl = readline.createInterface({
        input: stream,
        crlfDelay: Infinity
    });
    
    let info = 0;
    let warn = 0;
    let error = 0;
    let lines = 0;

    for await (const line of rl) {
        const log = line.split(' ');
        const status = log[1];
        
        if(status === 'INFO:'){
            info++;
        }else if(status === 'WARN:'){
            warn++;
        }else if(status === 'ERROR:'){
            error++;
            if (error > 100) {
                emitter.emit('failed', path.basename(filePath));
                rl.close();
                return;
            }
        }
        lines++;    
    }
    const logSummary = new LogFile(filePath,info,warn,error,lines,meta.size);
    
    fileStats.set(filePath, logSummary);
    summary.push(logSummary);

    emitter.emit('finished',path.basename(filePath));
    
    return logSummary;
}

const analyzePath = async function(directory,file){

    const currPath = path.join(directory,file);
    
    const meta = await fsp.stat(currPath);
    
    if(meta.isFile()){
        await analyzeFile(currPath,meta);
    }
    else if(meta.isDirectory()){
        await analyzeDirectory(currPath);
    }

};

const analyzeDirectory = async function(directory){
    try{
        const files = await fsp.readdir(directory);
        const result = await Promise.all(
            files.map((file) => analyzePath(directory,file))
        )
        displaySummary();
        if(flag){
            if(flag === '--watch'){
                watchDirectory(directory);
            }else{
                console.log('Invalid Command.\n');
                process.exit(1);
            }
        }
    }catch(err){
        console.log(err);
        process.exit(1);
    }
}

emitter.on('finished',(file) => {
    console.log(`${file} has finished processing.\n`);
});
emitter.on('failed',(file) => {
    console.log(`${file} failed to be processed.\nFile: ${file} has too many errors...\n`);
});
emitter.on('complete',() => {
    console.log('All the files have been processed.\n');
});

const formatDiff = (diff) => {
    return diff >= 0 ? `+${diff}` : `${diff}`;
};

analyzeDirectory(directory); 
