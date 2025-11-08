module.exports = {
  extends: ['../../packages/config/eslint.config.js'],
  env: {
    'react-native/react-native': true,
  },
  plugins: ['react', 'react-native'],
  rules: {
    'react/react-in-jsx-scope': 'off',
  },
};
