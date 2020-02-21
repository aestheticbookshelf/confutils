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

function writeFileToConfig(kind, name, key, fileName){
    writeBlobToConfig(kind, name, key, fu.readFile(path.join(envDir, fileName)))
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

function fromChunksToFile(key, name){
    let buff = fromChunks(key)
    fu.writeFile(path.join(envDir, name), buff)
}

function writeHerokuConfig(name){
    let c = getConf("prod", name)    
    const Heroku = require('heroku-client')
    const heroku = new Heroku({ token: c.meta.token })
    let cc = joinConfs([["common", "default"], ["prod", name]])    
    let body = {}
    for(let k in cc){
        body[k] = cc[k]
    }           
    let url = `/apps/${c.meta.app}/config-vars`    
    heroku.patch(url, {body: body}).then(cv => {            
        console.log("heroku response", cv)
    }, err => console.log(err))
}

class FirebaseAdmin_{
    constructor(props){
        this.storageBucket = props.storageBucket
        this.databaseURL = props.databaseURL
        this.envDir = props.envDir

        this.skipTest = props.skipTest

        this.bucket = null
        this.db = null
        this.firestore = null

        if(!process.env.SKIP_FIREBASE) this.init()
    }

    init(){
        setEnvDir(this.envDir)

        if(process.env.SACCKEY0){
            console.log("writing sacckey")
            fromChunksToFile("SACCKEY", "sacckey.json")
        }

        this.admin = require("firebase-admin")

        this.firebase = this.admin.initializeApp({
            credential: this.admin.credential.cert(path.join(envDir, "sacckey.json")),
            storageBucket: this.storageBucket,
            databaseURL: this.databaseURL
        })
        
        this.bucket = this.admin.storage().bucket()        
        this.db = this.admin.database()        
        this.firestore = this.firebase.firestore()

        if(!this.skipTest) this.test()
    }

    test(){
        let testFilePath = path.join(this.envDir, "test.txt")
        fu.writeFile(testFilePath, "test")
        this.bucket.upload(testFilePath, {destination: "test.txt"}, (err, _, apiResponse)=>{
            console.log(err ? "bucket test failed" : `bucket test ok, uploaded test.txt, size ${apiResponse.size}`)
        })
    }
}
function FirebaseAdmin(props){return new FirebaseAdmin_(props)}

module.exports = {
    setEnvDir: setEnvDir,
    writeBlobToConfig: writeBlobToConfig,
    writeFileToConfig: writeFileToConfig,
    writeMakeEnvScript: writeMakeEnvScript,
    fromChunks: fromChunks,
    fromChunksToFile: fromChunksToFile,
    writeHerokuConfig: writeHerokuConfig,
    FirebaseAdmin: FirebaseAdmin
}
