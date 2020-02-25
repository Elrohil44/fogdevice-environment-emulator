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
      const { id, temperature } = args;
      if (!id) {
        throw new Error('Missing parameter id');
      }
      if (!temperature) {
        throw new Error('Missing parameter temperature');
      }
      return;
    }
    case 'SET_TEMPERATURE':
    case 'SET_PRESSURE':
    case 'SET_HUMIDITY': {
      const { value, from, to } = args;
      if (!value) {
        throw new Error('Missing parameter value');
      }
      if (!from || !from.x || from.y) {
        throw new Error('Missing parameter from');
      }
      if (to && (!to.x || !to.y)) {
        throw new Error('Invalid parameter to');
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


const createEnvironment = () => {
  const actualState = new Array(WIDTH);
  let i = actualState.length;
  while (i--) {
    actualState[i] = new Array(HEIGHT);
    let j = actualState[i].length;
    while (j--) {
      actualState[i][j] = [20, 1000, 40];
    }
  }

  const intervalQueue = [];
  const oneshotQueue = [];

  return {
    every(iteration, { command, args }) {
      validateCommand({ command, args });
      const interval = Math.floor(iteration);
      if (!intervalQueue[interval]) {
        intervalQueue[interval] = [];
      }
      intervalQueue[interval].push([command, args]);
    },
    after(iteration, { command, args }) {
      validateCommand({ command, args });
      const interval = Math.floor(iteration);
      if (!oneshotQueue[interval]) {
        oneshotQueue[interval] = [];
      }
      oneshotQueue[interval].push([command, args]);
    }
  }
};
