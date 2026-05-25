const fs = require("fs");
const fsp = require("fs/promises");

const EventEmitter = require('events');

const path = require('path');
const readline = require('readline');

const directory = process.argv[2];

const emitter = new EventEmitter();

const flag = process.argv[3];

if(flag){
    if(flag === '--watch'){
        console.log('true');
    }else{
        console.log('Invalid Command.\n');
        process.exit(1);
    }
}

const analyzeFile = async function(directory,file){

    const currPath = path.join(directory,file);
    const stream = fs.createReadStream(currPath);
    
    const meta = await fsp.stat(currPath);

    if(meta.isFile()){

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
                    emitter.emit('failed', file);
                    rl.close();
                    return;
                }
            }
            lines++;    
        }
        console.log(`'${file} | ${lines} | ${error} | ${warn} | ${info} | ${meta.size}'\n`);
        emitter.emit('finished',file);
    }
    else if(meta.isDirectory()){
        await analyzeDirectory(currPath);
    }

};

const analyzeDirectory = async function(directory){
    try{
        const files = await fsp.readdir(directory);
        const result = await Promise.all(
            files.map((file) => analyzeFile(directory,file))
        )
        emitter.emit('complete');
    }catch(err){
        console.log(err);
        process.exit(1);
    }
}

emitter.on('finished',(file) => {
    console.log(`${file} has finished processing.`);
});
emitter.on('failed',(file) => {
    console.log(`${file} failed to be processed.\nFile: ${file} has too any errors...\n`);
});
emitter.on('complete',() => {
    console.log('All the files have been processed.\n');
});
analyzeDirectory(directory); 