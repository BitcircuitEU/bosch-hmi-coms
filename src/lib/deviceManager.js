const HID = require('node-hid');
const chalk = require('chalk');

/**
 * Listet alle verfügbaren HID-Geräte auf
 */
function listHidDevices() {
  try {
    return HID.devices();
  } catch (error) {
    console.error(chalk.red('Fehler beim Auflisten der HID-Geräte:'), error.message);
    return [];
  }
}

/**
 * Findet das erste verfügbare Bosch eBike Display
 */
function findBoschDisplay() {
  const devices = listHidDevices();
  return devices.find(device => 
    device.vendorId === 0x108c && device.productId === 0x155
  );
}

/**
 * Überprüft, ob ein Gerät ein Bosch Display ist
 */
function isBoschDisplay(device) {
  return device && device.vendorId === 0x108c && device.productId === 0x155;
}

/**
 * Formatiert Geräteinformationen für die Anzeige
 */
function formatDeviceInfo(device) {
  if (!device) return 'Unbekannt';
  
  return {
    name: device.product || 'Unbekannt',
    vendorId: `0x${device.vendorId.toString(16).toUpperCase().padStart(4, '0')}`,
    productId: `0x${device.productId.toString(16).toUpperCase().padStart(4, '0')}`,
    manufacturer: device.manufacturer || 'Unbekannt',
    path: device.path || 'Unbekannt'
  };
}

module.exports = {
  listHidDevices,
  findBoschDisplay,
  isBoschDisplay,
  formatDeviceInfo
};
