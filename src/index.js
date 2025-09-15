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
  .description('Verbinde mit dem Bosch Display und lese Informationen aus')
  .option('-v, --verbose', 'Verbose-Ausgabe aktivieren')
  .option('-m, --mode <mode>', 'Modus: display (nur Display-Info) oder full (alle Komponenten)', 'display')
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
      await readAllDisplayInfo(tool, ui, logger, options);
      
      await tool.disconnect();
      ui.showSuccess('Alle Informationen erfolgreich ausgelesen!');
      
    } catch (error) {
      console.error(chalk.red('Verbindungsfehler:'), error.message);
    }
  });

/**
 * Liest automatisch alle Display-Informationen aus und zeigt sie an
 */
async function readAllDisplayInfo(tool, ui, logger, options = {}) {
  const mode = options.mode || 'display';
  
  if (mode === 'display') {
    console.log(chalk.blue.bold('\n📊 Lese Display-Informationen aus...\n'));
  } else if (mode === 'full') {
    console.log(chalk.blue.bold('\n📊 Lese alle Komponenten-Informationen aus...\n'));
  } else {
    throw new Error(`Unbekannter Modus: ${mode}. Verwende 'display' oder 'full'`);
  }
  
  try {
    // Führe Handshake durch
    console.log(chalk.blue('🤝 Führe Handshake durch...'));
    await tool.performHandshake();
    console.log(chalk.green('✓ Handshake erfolgreich\n'));
    
    // Lese alle Informationen aus
    const allInfo = await tool.readAllInformation(mode);
    
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
    
    // Drive Unit Informationen (falls verfügbar)
    if (allInfo.driveUnit) {
      console.log(chalk.yellow.bold('🚴 Drive Unit Informationen:'));
      if (allInfo.driveUnit.error) {
        console.log(chalk.red(`  Fehler: ${allInfo.driveUnit.error}`));
      } else {
        // Status-Anzeige
        if (allInfo.driveUnit.status === 'Nicht angeschlossen') {
          console.log(chalk.red(`  Status: ${allInfo.driveUnit.status}`));
          console.log(chalk.gray(`  ${allInfo.driveUnit.message}`));
        } else if (allInfo.driveUnit.status === 'Nicht abgefragt') {
          console.log(chalk.yellow(`  Status: ${allInfo.driveUnit.status}`));
          console.log(chalk.gray(`  ${allInfo.driveUnit.message}`));
        } else {
          console.log(chalk.green(`  Status: ${allInfo.driveUnit.status}`));
        }
        
        // Daten-Anzeige (nur wenn verfügbar)
        if (allInfo.driveUnit.partNumber) {
          console.log(chalk.white(`  Part Number: ${allInfo.driveUnit.partNumber}`));
        }
        if (allInfo.driveUnit.serialNumber) {
          console.log(chalk.white(`  Serial Number: ${allInfo.driveUnit.serialNumber}`));
        }
        if (allInfo.driveUnit.hardwareVersion) {
          console.log(chalk.white(`  Hardware Version: ${allInfo.driveUnit.hardwareVersion}`));
        }
        if (allInfo.driveUnit.softwareVersion) {
          console.log(chalk.white(`  Software Version: ${allInfo.driveUnit.softwareVersion}`));
        }
      }
      console.log();
    }
    
    // Battery Management Informationen (falls verfügbar)
    if (allInfo.batteryManagement) {
      console.log(chalk.yellow.bold('🔋 Battery Management System:'));
      if (allInfo.batteryManagement.error) {
        console.log(chalk.red(`  Fehler: ${allInfo.batteryManagement.error}`));
      } else {
        // Status-Anzeige
        if (allInfo.batteryManagement.status === 'Nicht angeschlossen') {
          console.log(chalk.red(`  Status: ${allInfo.batteryManagement.status}`));
          console.log(chalk.gray(`  ${allInfo.batteryManagement.message}`));
        } else if (allInfo.batteryManagement.status === 'Nicht abgefragt') {
          console.log(chalk.yellow(`  Status: ${allInfo.batteryManagement.status}`));
          console.log(chalk.gray(`  ${allInfo.batteryManagement.message}`));
        } else {
          console.log(chalk.green(`  Status: ${allInfo.batteryManagement.status}`));
        }
        
        // Daten-Anzeige (nur wenn verfügbar)
        if (allInfo.batteryManagement.partNumber) {
          console.log(chalk.white(`  Part Number: ${allInfo.batteryManagement.partNumber}`));
        }
        if (allInfo.batteryManagement.serialNumber) {
          console.log(chalk.white(`  Serial Number: ${allInfo.batteryManagement.serialNumber}`));
        }
        if (allInfo.batteryManagement.hardwareVersion) {
          console.log(chalk.white(`  Hardware Version: ${allInfo.batteryManagement.hardwareVersion}`));
        }
        if (allInfo.batteryManagement.softwareVersion) {
          console.log(chalk.white(`  Software Version: ${allInfo.batteryManagement.softwareVersion}`));
        }
      }
      console.log();
    }
    
    // Zusammenfassung
    console.log(chalk.cyan.bold('📋 Zusammenfassung:'));
    console.log(chalk.white(`  Display: ${allInfo.componentType || 'N/A'} (${allInfo.serialNumber || 'N/A'})`));
    console.log(chalk.white(`  Software: ${allInfo.softwareVersion || 'N/A'}`));
    console.log(chalk.white(`  Hardware: ${allInfo.hardwareVersion || 'N/A'}`));
    
    if (allInfo.driveUnit) {
      const duStatus = allInfo.driveUnit.status || 'Unbekannt';
      const duColor = duStatus === 'Verfügbar' ? 'green' : 'red';
      console.log(chalk[duColor](`  Drive Unit: ${duStatus}`));
    }
    
    if (allInfo.batteryManagement) {
      const bmsStatus = allInfo.batteryManagement.status || 'Unbekannt';
      const bmsColor = bmsStatus === 'Verfügbar' ? 'green' : 'red';
      console.log(chalk[bmsColor](`  Battery Management: ${bmsStatus}`));
    }
    
    console.log();
    
    logger.log('INFO', 'Alle Display-Informationen erfolgreich ausgelesen');
    
  } catch (error) {
    logger.logError(error, 'Fehler beim Auslesen der Display-Informationen');
    throw error;
  }
}

program.parse();
