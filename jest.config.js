module.exports = {
  testEnvironment: 'jsdom',
  collectCoverageFrom: ['src/utils/**/*.js', '!src/**/*.test.js'],

  testMatch: ['**/tests/**/*.test.js'],
  transform: {
    '^.+\\.js$': ['babel-jest', { configFile: './babel.config.js' }],
  },
};
