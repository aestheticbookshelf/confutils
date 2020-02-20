const path = require('path')
const cu = require('./lib/confutils')

cu.setEnvDir(path.join(__dirname, "env"))

cu.writeFileToConfig("common", "default", "SACCKEY", path.join(__dirname, "env/sacckeyorig.json"))

cu.writeMakeEnvScript([["common", "default"]], "makeenv.bat")

cu.fromChunksToFile("SACCKEY", path.join(__dirname, "env/sacckey.json"))

cu.writeHerokuConfig("abminapp")
