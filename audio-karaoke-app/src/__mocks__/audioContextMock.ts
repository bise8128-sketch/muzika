export class MockAudioContext {
  state = 'suspended';
  sampleRate = 44100;
  currentTime = 0;
  destination = {};
  
  createGain() {
      return {
          connect: jest.fn(),
          disconnect: jest.fn(),
          gain: {
              value: 1,
              setValueAtTime: jest.fn(),
              linearRampToValueAtTime: jest.fn(),
              exponentialRampToValueAtTime: jest.fn()
          }
      };
  }

  createOscillator() {
      return {
          connect: jest.fn(),
          disconnect: jest.fn(),
          start: jest.fn(),
          stop: jest.fn(),
          frequency: { value: 440, setValueAtTime: jest.fn() },
          type: 'sine'
      };
  }

  createAnalyser() {
      return {
          connect: jest.fn(),
          disconnect: jest.fn(),
          frequencyBinCount: 1024,
          getByteFrequencyData: jest.fn((array) => array.fill(0)),
          getFloatFrequencyData: jest.fn((array) => array.fill(0)),
          getByteTimeDomainData: jest.fn((array) => array.fill(0)),
          getFloatTimeDomainData: jest.fn((array) => array.fill(0)),
          fftSize: 2048,
          smoothingTimeConstant: 0.8
      };
  }
  
  createBufferSource() {
      return {
          connect: jest.fn(),
          disconnect: jest.fn(),
          start: jest.fn(),
          stop: jest.fn(),
          buffer: null,
          loop: false,
          playbackRate: { value: 1, setValueAtTime: jest.fn() }
      };
  }

  createMediaElementSource() {
      return {
          connect: jest.fn(),
          disconnect: jest.fn()
      };
  }

  createBuffer(currentChannels: number, length: number, sampleRate: number) {
      const channels = Array.from({ length: currentChannels }, () => new Float32Array(length));
      return {
          length,
          duration: length / sampleRate,
          sampleRate,
          numberOfChannels: currentChannels,
          getChannelData: jest.fn((channel) => {
              if (channel >= currentChannels) {
                  throw new Error('Channel index out of bounds');
              }
              return channels[channel];
          }),
          copyToChannel: jest.fn((source, channelNumber, startInChannel = 0) => {
              if (channelNumber >= currentChannels) {
                  throw new Error('Channel index out of bounds');
              }
              channels[channelNumber].set(source, startInChannel);
          })
      };
  }

  decodeAudioData() {
      return Promise.resolve({
          duration: 10,
          length: 441000,
          sampleRate: 44100,
          numberOfChannels: 2,
          getChannelData: () => new Float32Array(441000)
      });
  }

  resume = jest.fn().mockResolvedValue(undefined);
  suspend = jest.fn().mockResolvedValue(undefined);
  close = jest.fn().mockResolvedValue(undefined);
}
