var Service, Characteristic
let Api = require('./api.js').Api

module.exports = function (homebridge) {
  Service = homebridge.hap.Service
  Characteristic = homebridge.hap.Characteristic
  homebridge.registerAccessory('homebridge-canary', 'Canary', Canary, true)
}

let Canary = function (log, config, api) {
  this.log = log
  this.api = api
  this.name = config['name']
  this.serial = config['serial']
  this.model = config['model']
  this.backend = new Api(log, config['username'], config['password'])

  this.log(`Adding Canary ${this.model} (${this.serial})`)
}

Canary.prototype.getStateTemperature = function (callback) {
  this.readSensorWithCallback('temperature', callback)
}

Canary.prototype.getStateHumidity = function (callback) {
  this.readSensorWithCallback('humidity', callback)
}

Canary.prototype.getStateBatteryLevel = function (callback) {
  this.readSensorWithCallback('battery', callback)
}

Canary.prototype.getStateAirQuality = function (callback) {
  this.readSensorWithCallback('air_quality', (err, val) => {
    if (err) {
      callback(err)
      return
    }
    let quality
    quality = Math.round((1 - val) * 4) + 1
    callback(null, quality)
  })
}

Canary.prototype.readSensorWithCallback = function (sensor, callback) {
  this.readSensor(sensor)
    .then(val => callback(null, val))
    .catch(err => {
      this.log(err)
      callback(err)
    })
}

Canary.prototype.readSensor = async function (sensor) {
  let id = await this.deviceId()
  let sensors = await this.backend.readings(id, this.model)

  for (var i in sensors) {
    if (sensors[i].sensor_type === sensor) {
      return Promise.resolve(sensors[i].value)
    }
  }

  return Promise.reject(new Error(`Invalid sensor ${sensor} not found`))
}

Canary.prototype.deviceId = async function () {
  let devices = await this.backend.devices()
  for (var i in devices) {
    if ((devices[i].serial_number === this.serial) && (devices[i].activation_status === "activated")) {
      return Promise.resolve(devices[i].id)
    }
  }

  return Promise.reject(new Error(`Device with serial ${this.serialNumber} not found`))
}

Canary.prototype.getServices = function () {
  let info = new Service.AccessoryInformation()

  info
    .setCharacteristic(Characteristic.Manufacturer, 'Canary')
    .setCharacteristic(Characteristic.Model, this.model)
    .setCharacteristic(Characteristic.SerialNumber, this.serialNumber)

  let services = [info]

  if (this.model === 'AllInOne') {
    let temp = new Service.TemperatureSensor(this.name + ' Temperature')
    let humidity = new Service.HumiditySensor(this.name + ' Humidity')
    let airq = new Service.AirQualitySensor(this.name + ' Air Quality')

    temp
      .getCharacteristic(Characteristic.CurrentTemperature)
      .on('get', this.getStateTemperature.bind(this))

    humidity
      .getCharacteristic(Characteristic.CurrentRelativeHumidity)
      .on('get', this.getStateHumidity.bind(this))

    airq
      .getCharacteristic(Characteristic.AirQuality)
      .on('get', this.getStateAirQuality.bind(this))

    services.push(...[temp, humidity, airq])
  }

  if (this.model === 'Flex') {
    let battery = new Service.BatteryService(this.name + ' Battery')

    battery
      .getCharacteristic(Characteristic.BatteryLevel)
      .on('get', this.getStateBatteryLevel.bind(this))

    services.push(battery)
  }

  return services
}
