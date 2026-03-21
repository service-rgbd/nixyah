const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

config.resolver = {
	...(config.resolver || {}),
	extraNodeModules: {
		...(config.resolver?.extraNodeModules || {}),
		'expo-notifications': path.resolve(__dirname, 'node_modules', 'expo-notifications'),
		// Force any import of 'expo-linear-gradient' to resolve to our safe shim
		'expo-linear-gradient': path.resolve(__dirname, 'shims', 'expo-linear-gradient'),
	},
};

module.exports = config;
