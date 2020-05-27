const fs = require('fs');

const MQTTClient = require('./MQTTClient');
const BME280Emulator = require('./BME280Emulator');
const { createEnvironment, TRIGGERS } = require('./Environment');

const { MQTT_BROKER_URL, CLIENT_ID, CONFIG_PATH } = process.env;

const config = JSON.parse(fs.readFileSync(CONFIG_PATH).toString());

const mqttClient = new MQTTClient({
  brokerUrl: MQTT_BROKER_URL,
  clientId: CLIENT_ID,
});

const { _id, emulators, commands } = config;

const sensorEmulators = (emulators || []).map(({ emulator, x, y }) => ({
  x, y, emulator: new BME280Emulator({ mqttClient, emulatorId: `${_id}_${emulator}` })
}))

const environment = createEnvironment({
  epochDuration: 100,
  mqttClient,
  clientId: CLIENT_ID,
  sensorEmulators,
});

(commands || []).forEach(({ trigger, iteration, event, command, params: args }) => {
  switch (trigger) {
    case TRIGGERS.EVERY:
      return environment.every(iteration, { command, args });
    case TRIGGERS.AFTER:
      return environment.after(iteration, { command, args });
    case TRIGGERS.ON:
      return environment.on(event, { command, args });
    case TRIGGERS.ONCE:
      return environment.once(event, { command, args });
    default:
  }
});

environment.execute();
