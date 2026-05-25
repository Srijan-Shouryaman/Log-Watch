const path = require('path');

class LogFile{
    filePath;
    info;
    warn;
    error;
    lines;
    size;

    constructor(filePath,info,warn,error,lines,size){
        this.filePath = filePath;
        this.info = info;
        this.warn = warn;
        this.error = error;
        this.lines = lines;
        this.size = size;
    }
    getName(){
        return path.basename(this.filePath);
    }
    generateFileSummary(){
        console.log(`${this.getName()} | ${this.lines} | ${this.error} | ${this.warn} | ${this.info} | ${this.size}`);
    }
}
module.exports = LogFile;