const SensorEmulator = require('./SensorEmulator');

const PAYLOAD_TAG = 'BME280|';
const TEMPERATURE = 'T';
const PRESSURE = 'P';
const HUMIDITY = 'H';

class BME280Emulator extends SensorEmulator {
  constructor({ mqttClient, emulatorId, maxUpdateInterval }) {
    super();
    this.mqttClient = mqttClient;
    this.emulatorId = emulatorId;
    this.maxUpdateInterval = maxUpdateInterval > 0 ? maxUpdateInterval : 1000;
    this.topic = `fogdevicesplatform/${this.emulatorId}/slave/I2C/0`;
    this.temperature = 0;
    this.lastTemperatureUpdate = 0;
    this.pressure = 0;
    this.lastPressureUpdate = 0;
    this.humidity = 0;
    this.lastHumidityUpdate = 0;
  }

  setTemperature = (temperature) => {
    if (
      temperature === this.temperature
      && Date.now() < this.lastTemperatureUpdate + this.maxUpdateInterval
    ) return;
    this.temperature = temperature;
    this.mqttClient.sendMessage(
      this.topic,
      `${PAYLOAD_TAG}${TEMPERATURE}${this.temperature}`,
    );
  };

  setPressure = (pressure) => {
    if (
      pressure === this.pressure
      && Date.now() < this.lastPressureUpdate + this.maxUpdateInterval
    ) return;
    this.pressure = pressure;
    this.mqttClient.sendMessage(
      this.topic,
      `${PAYLOAD_TAG}${PRESSURE}${this.pressure}`,
    );
  };

  setHumidity = (humidity) => {
    if (
      humidity === this.humidity
      && Date.now() < this.lastHumidityUpdate + this.maxUpdateInterval
    ) return;
    this.humidity = humidity;
    this.mqttClient.sendMessage(
      this.topic,
      `${PAYLOAD_TAG}${HUMIDITY}${this.humidity}`,
    );
  };
}

module.exports = BME280Emulator;
