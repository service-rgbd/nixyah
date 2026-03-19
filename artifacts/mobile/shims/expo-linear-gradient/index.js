const React = require('react');
const { View } = require('react-native');

function LinearGradient({ colors, style, children, ...rest }) {
  const backgroundColor = (colors && colors[0]) || 'transparent';
  return React.createElement(View, Object.assign({}, rest, { style: [style, { backgroundColor }] }), children);
}

function getLinearGradientBackgroundImage() {
  return '';
}

module.exports = Object.assign(LinearGradient, { getLinearGradientBackgroundImage });
