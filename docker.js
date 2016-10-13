'use strict'
var _ = require('lodash')
module.exports = function (options) {
  var seneca = this
  var plugin = 'docker'
  seneca.depends('docker', 'unix-command')
  seneca.add({
    role: plugin,
    required$: ['command'],
    atleastone$: ['machine', 'ip'],
    options: {
      object$: true
    },
    command: {
      string$: true
    },
    machine: {
      type: {
        string$: true
      }
    }
  }, docker_command)

  function docker_command (msg, done) {
    var format = msg.format || 'string'
    var port = msg.port ? msg.port : 2376
    var machine = msg.machine
    var command = 'docker ' + msg.command
    var act = {
      role: 'unix-command',
      command: command,
      args: msg.args,
      extra: msg.extra,
      format: format
    }
    var opts = {}
    if (msg.ip) {
      if (!options.certs_dir) return done('options.certs_dir required for ip access')
      opts.env = {
        DOCKER_HOST: `tcp://${msg.ip}:${port}`,
        DOCKER_TLS_VERIFY: '1',
        DOCKER_CERT_PATH: options.certs_dir
      }
    }
    else {
      opts.$env = {
        $DOCKER_HOST: '$.machine_url',
        DOCKER_TLS_VERIFY: '1',
        $DOCKER_CERT_PATH: '$.machine_info.HostOptions.AuthOptions.StorePath'
      }
      act.$$machine_info = {
        role: 'docker-machine',
        cmd: 'machine-command',
        command: 'inspect',
        format: 'json',
        machine: machine
      }
      act.$$machine_url = {
        role: 'docker-machine',
        cmd: 'info',
        machine: machine,
        out$: [{
          _: 'get',
          args: 'url'
        }]
      }
    }
    act.$options = seneca.util.deepextend(msg.options, opts)
    seneca.flow_act(act, done)
  }
  seneca.add({
    role: plugin,
    command: 'run',
    required$: ['image'],
    args: {
      object$: true
    },
    image: {
      string$: true
    }
  }, docker_run)

  function docker_run (msg, done) {
    if (_.isArray(msg.image_options)) {
      msg.image_options = msg.image_options.join(' ')
    }
    msg.extra = msg.image_options ? msg.image : msg.image + ' ' + msg.image_options
    msg.args = seneca.util.deepextend({
      detach: true
    }, msg.args)
    this.prior(msg, done)
  }
  seneca.add({
    role: plugin,
    command: 'login',
    required$: ['username', 'password', 'provider', 'machine'],
    username: {
      string$: true
    },
    password: {
      string$: true
    },
    provider: {
      string$: true
    }
  }, docker_login)

  function docker_login (msg, done) {
    this.prior({
      role: plugin,
      command: 'login',
      args: {
        username: msg.username,
        password: msg.password
      },
      extra: msg.provider,
      machine: msg.machine
    }, done)
  }

  return {
    name: plugin,
    export: {
      certs_dir: options.certs_dir
    }
  }
}
