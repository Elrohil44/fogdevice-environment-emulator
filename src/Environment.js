const fs = require('fs');

const {
  DATA_DIR = '/app/emulation-data'
} = process.env;

const WIDTH = 250;
const HEIGHT = 250;

const COMMANDS = {
  'PLACE_HEATER': 'PLACE_HEATER',
  'REMOVE_HEATER': 'REMOVE_HEATER',
  'SET_TEMPERATURE': 'SET_TEMPERATURE',
  'SET_HUMIDITY': 'SET_HUMIDITY',
  'SET_PRESSURE': 'SET_PRESSURE',
};
const TRIGGERS = {
  'ONCE': 'ONCE',
  'ON': 'ON',
  'EVERY': 'EVERY',
  'AFTER': 'AFTER',
};

const saveFile = async ({
  path,
  content,
  flags,
}) => {
  const stream = fs.createWriteStream(path, { flags });
  const promise = new Promise((resolve, reject) => {
    stream.on('close', resolve);
    stream.on('error', reject);
  });
  stream.end(content);
  await promise;
};

const dumpEnvironment = async ({
  _id, epoch, state, pressure, time, width, height,
}) => {
  await saveFile({
    path: `${DATA_DIR}/${_id}_pressure.csv`,
    content: `${epoch},${time},${pressure}\n`,
    flags: 'a'
  });

  const dataContent = new Array(width * height);
  let ndx = dataContent.length - 1;
  let i = width;
  while (i--) {
    let j = height;
    while (j--) {
      const [temp, humidity] = state[i][j];
      dataContent[ndx] = `${epoch},${time},${i},${j},${temp},${humidity}`;
      ndx--;
    }
  }

  await saveFile({
    path: `${DATA_DIR}/${_id}_${epoch}_data.csv`,
    content: dataContent.join('\n'),
  });
}

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
  width = WIDTH,
  height = HEIGHT,
} = {}) => {
  const EVENTS_TOPIC = `fogdevicesplatform/${clientId}/EVENTS`;
  const actualState = new Array(width);
  let i = actualState.length;
  while (i--) {
    actualState[i] = new Array(height);
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
    state.prevState = [
      ...state.environment
        .map(row => [...row])
    ];
    state.epoch += 1;
    let w = width;
    while (w--) {
      let h = height;
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
      if (x >= 0 && x < width && y >= 0 && y < height) {
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
    sensorEmulators.forEach((sensorEmulator) => {
      const { x, y, emulator } = sensorEmulator;

      if (state.environment[x] && state.environment[x][y]) {
        const [temperature, humidity] = state.environment[x][y];
        const pressure = state.pressure;

        emulator.setTemperature(temperature);
        emulator.setHumidity(humidity);
        emulator.setPressure(pressure);
      }
    });
    dumpEnvironment({
      epoch: state.epoch,
      state: [
        ...state.environment
          .map(row => [...row])
      ],
      pressure: state.pressure,
      _id: clientId,
      time: Date.now(),
      width,
      height,
    }).catch(() => {});
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
  COMMANDS,
  TRIGGERS,
};
