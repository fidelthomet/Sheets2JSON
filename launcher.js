var exec = require('child_process').exec
var cron = require('node-cron')

cron.schedule('*/5 * * * *', function () {
  console.log('started')
  var ls = exec('node index.js', function (error, stdout, stderr) {
    if (error) {
      console.log(error.stack)
      console.log('Error code: ' + error.code)
      console.log('Signal received: ' + error.signal)
    }
    console.log('STDOUT: ' + stdout)
    console.log('STDERR: ' + stderr)
  })

  ls.on('exit', function (code) {
    console.log('Exit at ' + new Date().toISOString())
  })
})
