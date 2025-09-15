#!/usr/bin/env node

const { program } = require('commander');
const chalk = require('chalk');
const inquirer = require('inquirer');
const BoschDisplayTool = require('./lib/BoschDisplayTool');
const { listHidDevices, findBoschDisplay } = require('./lib/deviceManager');
const UI = require('./lib/UI');
const Config = require('./lib/Config');
const Logger = require('./lib/Logger');

program
  .name('bosch-display-tool')
  .description('Tool zur Kommunikation mit Bosch eBike Displays')
  .version('1.0.0');

program
  .command('list')
  .description('Liste alle verfügbaren HID-Geräte auf')
  .option('-v, --verbose', 'Zeige detaillierte Informationen')
  .action(async (options) => {
    try {
      const config = new Config();
      const ui = new UI(config);
      const logger = new Logger(config.get('logging'));
      
      logger.log('INFO', 'Suche nach HID-Geräten...');
      const devices = listHidDevices();
      
      if (devices.length === 0) {
        ui.showWarning('Keine HID-Geräte gefunden.');
        return;
      }

      ui.showSuccess(`Gefunden: ${devices.length} HID-Gerät(e)`);
      ui.showDevices(devices);
      
      if (options.verbose) {
        devices.forEach((device, index) => {
          console.log(chalk.gray(`\nGerät ${index + 1} Details:`));
          console.log(chalk.gray(`  Pfad: ${device.path || 'Unbekannt'}`));
          console.log(chalk.gray(`  Hersteller: ${device.manufacturer || 'Unbekannt'}`));
          console.log(chalk.gray(`  Interface: ${device.interface || 'Unbekannt'}`));
        });
      }
      
    } catch (error) {
      console.error(chalk.red('Fehler beim Auflisten der Geräte:'), error.message);
    }
  });

program
  .command('connect')
  .description('Verbinde mit dem Bosch Display und lese alle Informationen aus')
  .option('-v, --verbose', 'Verbose-Ausgabe aktivieren')
  .action(async (options) => {
    try {
      const config = new Config();
      const ui = new UI(config);
      const logger = new Logger(config.get('logging'));
      
      if (options.verbose) {
        config.set('logging.verbose', true);
        logger.setVerbose(true);
      }
      
      ui.showWelcome();
      
      // Suche nach Bosch Display
      logger.log('INFO', 'Suche nach Bosch Display...');
      const device = findBoschDisplay();
      
      if (!device) {
        ui.showError('Kein Bosch Display gefunden!');
        ui.showWarning('Stelle sicher, dass das Display angeschlossen ist.');
        return;
      }
      
      ui.showSuccess(`Bosch Display gefunden: ${device.product || 'Unbekannt'}`);
      logger.logConnection('Verbinde', device);
      
      const tool = new BoschDisplayTool();
      await tool.connect(device);
      
      ui.showConnectionSummary(tool.device, tool.isConnected);
      
      // Lese alle Informationen aus
      await readAllDisplayInfo(tool, ui, logger);
      
      await tool.disconnect();
      ui.showSuccess('Alle Informationen erfolgreich ausgelesen!');
      
    } catch (error) {
      console.error(chalk.red('Verbindungsfehler:'), error.message);
    }
  });

/**
 * Liest automatisch alle Display-Informationen aus und zeigt sie an
 */
async function readAllDisplayInfo(tool, ui, logger) {
  console.log(chalk.blue.bold('\n📊 Lese alle Display-Informationen aus...\n'));
  
  try {
    // Führe Handshake durch
    console.log(chalk.blue('🤝 Führe Handshake durch...'));
    await tool.performHandshake();
    console.log(chalk.green('✓ Handshake erfolgreich\n'));
    
    // Lese alle Informationen aus
    const allInfo = await tool.readAllInformation();
    
    // Zeige die Informationen in einer schönen Übersicht an
    console.log(chalk.blue.bold('📋 Display-Informationen:\n'));
    
    // System-Informationen
    console.log(chalk.yellow.bold('🔧 System-Informationen:'));
    console.log(chalk.white(`  Seriennummer: ${allInfo.serialNumber || 'N/A'}`));
    console.log(chalk.white(`  Hardware-Version: ${allInfo.hardwareVersion || 'N/A'}`));
    console.log(chalk.white(`  Software-Version: ${allInfo.softwareVersion || 'N/A'}`));
    console.log(chalk.white(`  Produktcode: ${allInfo.productCode || 'N/A'}`));
    console.log(chalk.white(`  Artikelnummer: ${allInfo.articleNumber || 'N/A'}`));
    console.log(chalk.white(`  Komponente: ${allInfo.componentType || 'N/A'}\n`));
    
    // Bordcomputer-Informationen
    console.log(chalk.yellow.bold('🖥️ Bordcomputer-Informationen:'));
    console.log(chalk.white(`  Aktuelle Uhrzeit: ${allInfo.currentTime || 'N/A'}`));
    console.log(chalk.white(`  Aktuelles Datum: ${allInfo.currentDate || 'N/A'}\n`));
    
    // Vorbereitung für zukünftige Erweiterungen
    console.log(chalk.gray('📝 Hinweis: Drive Unit und Power Unit Informationen werden verfügbar sein, sobald das Display am Fahrrad angeschlossen ist.\n'));
    
    logger.log('INFO', 'Alle Display-Informationen erfolgreich ausgelesen');
    
  } catch (error) {
    logger.logError(error, 'Fehler beim Auslesen der Display-Informationen');
    throw error;
  }
}

program.parse();
