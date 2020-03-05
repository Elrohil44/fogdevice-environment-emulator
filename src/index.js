const { createEnvironment } = require('./Environment');

const { MQTT_BROKER_URL } = process.env;

const environment = createEnvironment({ epochDuration: 1000 });
environment.after(10, { command: 'SET_TEMPERATURE', args: { value: 80, from: { x: 0, y: 0 }, to: { x: 2, y: 2 } } });
environment.after(5, { command: 'SET_HUMIDITY', args: { value: 20, from: { x: 0, y: 2 }, to: { x: 2, y: 4 } } });
environment.after(15, { command: 'PLACE_HEATER', args: { temperature: 100, x: 9, y: 9, id: 'heater' } });
environment.after(100, { command: 'REMOVE_HEATER', args: { id: 'heater' } });
environment.every(300, { command: 'SET_TEMPERATURE', args: { value: 0, from: { x: 0, y: 0 }, to: { x: 5, y: 5 } } });

environment.execute();