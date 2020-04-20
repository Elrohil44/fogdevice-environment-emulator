const SensorEmulator = require('./SensorEmulator');

const PAYLOAD_TAG = 'BME280|';
const TEMPERATURE = 'T';
const PRESSURE = 'P';
const HUMIDITY = 'H';

class BME280Emulator extends SensorEmulator {
  constructor({ mqttClient, emulatorId }) {
    super();
    this.mqttClient = mqttClient;
    this.emulatorId = emulatorId;
    this.topic = `fogdevicesplatform/${this.emulatorId}/slave/I2C/0`;
    this.temperature = 0;
    this.pressure = 0;
    this.humidity = 0;
  }

  setTemperature = (temperature) => {
    if (temperature === this.temperature) return;
    this.temperature = temperature;
    this.mqttClient.sendMessage(
      this.topic,
      `${PAYLOAD_TAG}${TEMPERATURE}${this.temperature}`,
    );
  };

  setPressure = (pressure) => {
    if (pressure === this.pressure) return;
    this.pressure = pressure;
    this.mqttClient.sendMessage(
      this.topic,
      `${PAYLOAD_TAG}${PRESSURE}${this.pressure}`,
    );
  };

  setHumidity = (humidity) => {
    if (humidity === this.humidity) return;
    this.humidity = humidity;
    this.mqttClient.sendMessage(
      this.topic,
      `${PAYLOAD_TAG}${HUMIDITY}${this.humidity}`,
    );
  };
}

module.exports = BME280Emulator;