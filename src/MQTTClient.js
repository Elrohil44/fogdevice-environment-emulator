const PahoMQTT = require('paho-mqtt');

class MQTTClient {
  constructor({ brokerUrl, clientId }) {
    this.brokerUrl = brokerUrl;
    this.clientId = clientId;
    this.client = new PahoMQTT.Client(this.brokerUrl, this.clientId);
    this.client.onMessageArrived = this._onMessageArrived;
    this.client.onConnectionLost = this._onConnectionLost;
  }

  _onConnect = () => {
    if (typeof this.onConnect === 'function') {
      this.onConnect();
    }
  };

  _onMessageArrived = (message) => {
    if (typeof this.onMessageArrived === 'function') {
      this.onMessageArrived({
        topic: message.destinationName,
        payload: message.payloadString,
      });
    }
  };

  _onConnectionLost = () => {
    if (typeof this.onConnectionLost === 'function') {
      this.onConnectionLost();
    }
  };

  connect = () => {
    this.client.connect({ onSuccess: this._onConnect })
  };

  subscribe = (topic) => {
    this.client.subscribe(topic);
  };

  sendMessage = (topic, message) => {
    const mqttMessage = new PahoMQTT.Message(message);
    message.destinationName = topic;
    this.client.send(mqttMessage);
  }
}

module.exports = MQTTClient;