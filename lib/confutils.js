const fu = require('@aestheticbookshelf/fileutils')
const path = require('path')

const DEFAULT_CONF = {
    common: {},
    dev: {},
    prod: {}
}

let envDir
let conf

function confPath(){
    return path.join(envDir, "conf.json")
}

function setEnvDir(ed){
    envDir = ed
    readConf()
    writeConf()
}

function readConf(){
    conf = fu.readJson(confPath(), DEFAULT_CONF)
}

function writeConf(){
    fu.writeJson(confPath(), conf)
}

function getConf(kind, name){    
    if(!conf[kind]) conf.kind = {}
    if(!conf[kind][name]) conf[kind][name] = {
        meta: {},
        conf: {}
    }
    return conf[kind][name]
}

const CHUNK_SIZE = 1000

function toChunks(str, accOpt){
    let str_b64 = accOpt ? str : new Buffer.from(str, "utf-8").toString("base64")    
    let acc = accOpt || []
    if(!str_b64.length) return acc
    if(str_b64.length <= CHUNK_SIZE){
        acc.push(str)
        return acc
    }
    acc.push(str_b64.substring(0, CHUNK_SIZE))
    return toChunks(str_b64.substring(CHUNK_SIZE), acc)
}

function fromChunks(key){
    let i = 0
    let acc = ""
    let ok = true
    do{
        if(process.env[`${key}${i}`]){
            acc += process.env[`${key}${i++}`]
        }else{
            ok = false
        }
    }while(ok)
    let buff = Buffer.from(acc, "base64").toString()
    return buff
}

function purge(kind, name, key){
    let c = getConf(kind, name)
    for(let k in c){
        if(k.match(new RegExp(`^${key}`))) delete c[k]
    }
}

function writeBlobToConfig(kind, name, key, blob){        
    purge(kind, name, key)
    let chunks = toChunks(blob)
    let i = 0
    let c = getConf(kind, name)
    for(let chunk of chunks){
        c.conf[`${key}${i++}`] = chunk
    }
}

function writeFileToConfig(kind, name, key, path){
    writeBlobToConfig(kind, name, key, fu.readFile(path))
    writeConf()
}

function joinConfs(confs){
    let cc = {}
    for(let entry of confs){
        let c = getConf(entry[0], entry[1])
        cc = {...cc, ...c.conf}
    }
    return cc
}

function writeMakeEnvScript(confs, name){
    let cc = joinConfs(confs)
    let buff = "echo off\n"
    for(let k in cc){
        buff += `set ${k}=${cc[k]}\n`
    }
    fu.writeFile(path.join(envDir, name), buff)
}

function fromChunksToFile(key, path){
    let buff = fromChunks(key)
    fu.writeFile(path, buff)
}

module.exports = {
    setEnvDir: setEnvDir,
    writeBlobToConfig: writeBlobToConfig,
    writeFileToConfig: writeFileToConfig,
    writeMakeEnvScript: writeMakeEnvScript,
    fromChunks: fromChunks,
    fromChunksToFile: fromChunksToFile
}
