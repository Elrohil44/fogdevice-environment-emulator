const WIDTH = 250;
const HEIGHT = 250;

const COMMANDS = [
  'PLACE_HEATER',
  'REMOVE_HEATER',
  'SET_TEMPERATURE',
  'SET_HUMIDITY',
  'SET_PRESSURE',
];

const validateCommand = ({ command, args }) => {
  switch (command) {
    case 'PLACE_HEATER': {
      const { id, temperature, x, y } = args;
      if (!id) {
        throw new Error('Missing parameter id');
      }
      if (!temperature) {
        throw new Error('Missing parameter temperature');
      }
      if (!x) {
        throw new Error('Missing parameter x');
      }
      if (!y) {
        throw new Error('Missing parameter y');
      }
      return;
    }
    case 'SET_TEMPERATURE':
    case 'SET_HUMIDITY': {
      const { value, from, to } = args;
      if (typeof value !== 'number') {
        throw new Error('Missing parameter value');
      }
      if (!from || typeof from.x !== 'number' || typeof from.y !== 'number') {
        throw new Error('Missing parameter from');
      }
      if (!to || typeof to.x !== 'number' || typeof to.y !== 'number') {
        throw new Error('Invalid parameter to');
      }
      return;
    }
    case 'SET_PRESSURE': {
      const { value } = args;
      if (!value) {
        throw new Error('Missing parameter value');
      }
      return;
    }
    case 'REMOVE_HEATER': {
      const { id } = args;
      if (!id) {
        throw new Error('Missing parameter id');
      }
      return;
    }
    default:
      throw new Error('Unsupported command');
  }
};


const createEnvironment = ({
  epochDuration = 1000,
  mqttClient,
  clientId,
  sensorEmulators = [],
} = {}) => {
  const EVENTS_TOPIC = `fogdevicesplatform/${clientId}/EVENTS`;
  const actualState = new Array(WIDTH);
  let i = actualState.length;
  while (i--) {
    actualState[i] = new Array(HEIGHT);
    let j = actualState[i].length;
    while (j--) {
      actualState[i][j] = [20, 40];
    }
  }

  const state = {
    epoch: 0,
    executing: false,
    pressure: 1000,
    environment: actualState,
    prevState: null,
    heaters: [],
  };

  const intervalQueue = [];
  const oneshotQueue = [];
  const eventOnceListeners = {};
  const eventListeners = {};

  const handleCommand = ([command, args]) => {
    switch (command) {
      case 'PLACE_HEATER': {
        const { id, temperature, x, y } = args;
        state.heaters.push({ id, temperature, x, y });
        return;
      }
      case 'REMOVE_HEATER': {
        const { id } = args;
        const index = state.heaters.findIndex(heater => heater.id === id);
        if (index !== -1) {
          state.heaters.splice(index, 1);
        }
        return;
      }
      case 'SET_PRESSURE': {
        const { value } = args;
        state.pressure = value;
        return;
      }
      case 'SET_HUMIDITY':
      case 'SET_TEMPERATURE': {
        const { value, from, to } = args;
        const fromX = Math.min(from.x, to.x);
        const fromY = Math.min(from.y, to.y);
        const toX = Math.max(from.x, to.x);
        const toY = Math.max(from.y, to.y);
        const rows = state.environment
          .slice(fromX, toX - fromX + 1)
          .map(row => row.slice(fromY, toY - fromY + 1))
          .flat();
        const register = command === 'SET_TEMPERATURE' ? 0 : 1;
        let i = rows.length;
        while (i--) {
          rows[i][register] = value;
        }
        return;
      }
      default:
    }
  };

  const iterate = () => {
    setTimeout(iterate, epochDuration);
    state.epoch += 1;
    state.prevState = [
      ...state.environment
        .map(row => [...row])
    ];
    let w = WIDTH;
    while (w--) {
      let h = HEIGHT;
      while (h--) {
        const beginW = w ? w - 1 : w;
        const endW = w + 2;
        const beginH = h ? h - 1 : h;
        const endH = h + 2;
        const tile = state.prevState.slice(beginW, endW).map(s => s.slice(beginH, endH)).flat();
        state.environment[w][h] = tile
          .reduce(([tempSum, humSum], [temp, hum]) => [tempSum + temp, humSum + hum], [0, 0])
          .map(v => v / tile.length);
      }
    }
    let i = state.heaters.length;
    while (i--) {
      const { x, y, temperature } = state.heaters[i];
      if (x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT) {
        state.environment[x][y][0] = Math.max(temperature, state.environment[x][y][0]);
      }
    }
    let interval = intervalQueue.length;
    while (interval--) {
      if (state.epoch % interval === 0 && intervalQueue[interval]) {
        const queue = intervalQueue[interval];
        let i = queue.length;
        while (i--) {
          handleCommand(queue[i]);
        }
      }
    }
    if (oneshotQueue[state.epoch]) {
      const queue = oneshotQueue[state.epoch];
      let i = queue.length;
      while (i--) {
        handleCommand(queue[i]);
      }
    }
    sensorEmulators.forEach((emulator) => {
      const { x, y } = emulator;

      const [temperature, humidity] = state.environment[x][y];
      const pressure = state.pressure;

      emulator.setTemperature(temperature);
      emulator.setHumidity(humidity);
      emulator.setPressure(pressure);
    });
  };

  return {
    every(iteration, { command, args }) {
      validateCommand({ command, args });
      const interval = Math.floor(iteration);
      if (!intervalQueue[interval]) {
        intervalQueue[interval] = [];
      }
      intervalQueue[interval].unshift([command, args]);
    },
    after(iteration, { command, args }) {
      validateCommand({ command, args });
      const interval = Math.floor(iteration);
      if (!oneshotQueue[interval]) {
        oneshotQueue[interval] = [];
      }
      oneshotQueue[interval].unshift([command, args]);
    },
    on(event, { command, args }) {
      validateCommand({ command, args });
      if (!eventListeners[event]) {
        eventListeners[event] = [];
      }
      eventListeners[event].unshift([command, args]);
    },
    once(event, { command, args }) {
      validateCommand({ command, args });
      if (!eventOnceListeners[event]) {
        eventOnceListeners[event] = [];
      }
      eventOnceListeners[event].unshift([command, args]);
    },
    execute() {
      if (!state.executing) {
        state.executing = true;
        mqttClient.onConnect = () => {
          mqttClient.subscribe(EVENTS_TOPIC);
        };
        mqttClient.onMessageArrived = ({ topic, payload }) => {
          if (topic === EVENTS_TOPIC) {
            const event = payload;
            if (eventOnceListeners[event] && eventOnceListeners[event].length) {
              eventOnceListeners[event].forEach(handleCommand);
              eventOnceListeners[event] = [];
            }
            if (eventListeners[event] && eventListeners[event].length) {
              eventListeners[event].forEach(handleCommand);
            }
          }
        };
        mqttClient.connect();
        iterate();
      }
    }
  }
};

module.exports = {
  createEnvironment,
};
