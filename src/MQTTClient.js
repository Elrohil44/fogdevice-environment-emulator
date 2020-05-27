const MQTT = require('mqtt');

class MQTTClient {
  constructor({ brokerUrl, clientId }) {
    this.brokerUrl = brokerUrl;
    this.clientId = clientId;
  }

  _onConnect = () => {
    if (typeof this.onConnect === 'function') {
      this.onConnect();
    }
  };

  _onMessageArrived = (topic, message) => {
    if (typeof this.onMessageArrived === 'function') {
      this.onMessageArrived({
        topic,
        payload: message,
      });
    }
  };

  connect = () => {
    this.client = MQTT.connect(this.brokerUrl, { clientId: this.clientId });
    this.client.on('connect', this._onConnect);
    this.client.on('message', this._onMessageArrived);
  };

  subscribe = (topic) => {
    this.client.subscribe(topic);
  };

  sendMessage = (topic, message) => {
    this.client.publish(topic, message);
  }
}

module.exports = MQTTClient;
