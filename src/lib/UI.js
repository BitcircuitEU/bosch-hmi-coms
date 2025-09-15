const chalk = require('chalk');
const inquirer = require('inquirer');
const { table } = require('table');
const { formatDeviceInfo } = require('./deviceManager');

/**
 * Erweiterte Benutzeroberfläche für das Bosch Display Tool
 */
class UI {
  constructor(config = null) {
    this.config = config;
    this.showHexData = config?.get('ui.showHexData') || false;
    this.showTimestamps = config?.get('ui.showTimestamps') || true;
    this.colorOutput = config?.get('ui.colorOutput') !== false;
  }

  /**
   * Zeigt den Willkommensbildschirm
   */
  showWelcome() {
    console.clear();
    console.log(chalk.blue.bold('╔══════════════════════════════════════════════════════════════╗'));
    console.log(chalk.blue.bold('║                    Bosch eBike Display Tool                  ║'));
    console.log(chalk.blue.bold('║                    Kommunikations-Interface                  ║'));
    console.log(chalk.blue.bold('╚══════════════════════════════════════════════════════════════╝'));
    console.log();
    console.log(chalk.gray('Ein Tool zur Kommunikation mit Bosch eBike Displays über HID'));
    console.log(chalk.gray('Basierend auf der Analyse der offiziellen Bosch Diagnose-Software'));
    console.log();
  }

  /**
   * Zeigt Geräte-Informationen in einer Tabelle
   */
  showDevices(devices) {
    if (devices.length === 0) {
      console.log(chalk.yellow('Keine HID-Geräte gefunden.'));
      return;
    }

    const tableData = [
      [chalk.bold('Gerät'), chalk.bold('VID'), chalk.bold('PID'), chalk.bold('Status')]
    ];

    devices.forEach((device, index) => {
      const info = formatDeviceInfo(device);
      const isBosch = device.vendorId === 0x108c && device.productId === 0x155;
      const status = isBosch ? chalk.green('✓ Bosch Display') : chalk.gray('Anderes Gerät');
      
      tableData.push([
        info.name,
        info.vendorId,
        info.productId,
        status
      ]);
    });

    console.log(table(tableData, {
      border: {
        topBody: '─',
        topJoin: '┬',
        topLeft: '┌',
        topRight: '┐',
        bottomBody: '─',
        bottomJoin: '┴',
        bottomLeft: '└',
        bottomRight: '┘',
        bodyLeft: '│',
        bodyRight: '│',
        bodyJoin: '│',
        joinBody: '─',
        joinLeft: '├',
        joinRight: '┤',
        joinJoin: '┼'
      }
    }));
  }

  /**
   * Zeigt Display-Informationen in einer detaillierten Tabelle
   */
  showDisplayInfo(info) {
    // Gruppiere die Informationen in Kategorien
    const categories = {
      'Grundlegende System-Informationen': [
        'serialNumber', 'hardwareVersion', 'softwareVersion', 
        'productCode', 'articleNumber', 'manufacturingDate', 'componentType'
      ],
      'System-Zustand': [
        'chargingState'
      ],
      'Einstellungen': [
        'language', 'distanceUnit', 'clockDisplayMode'
      ],
      'Bordcomputer-Informationen': [
        'currentTime', 'currentDate', 'rideTime', 'tripDistance', 'maxSpeed'
      ]
    };

    // Zeige jede Kategorie separat
    Object.entries(categories).forEach(([categoryName, keys]) => {
      console.log(chalk.blue.bold(`\n${categoryName}:`));
      
      const tableData = [
        [chalk.bold('Parameter'), chalk.bold('Wert'), chalk.bold('Status')]
      ];

      keys.forEach(key => {
        if (info.hasOwnProperty(key)) {
          const value = info[key];
          let status = chalk.green('✓');
          let displayValue = value;
          
          if (value === null || value === undefined) {
            status = chalk.red('❌');
            displayValue = 'Nicht verfügbar';
          } else if (typeof value === 'string' && value.includes('Fehler')) {
            status = chalk.red('❌');
          }

          tableData.push([
            this.formatParameterName(key),
            this.formatValue(displayValue),
            status
          ]);
        }
      });

      if (tableData.length > 1) {
        console.log(table(tableData, {
          border: {
            topBody: '─',
            topJoin: '┬',
            topLeft: '┌',
            topRight: '┐',
            bottomBody: '─',
            bottomJoin: '┴',
            bottomLeft: '└',
            bottomRight: '┘',
            bodyLeft: '│',
            bodyRight: '│',
            bodyJoin: '│',
            joinBody: '─',
            joinLeft: '├',
            joinRight: '┤',
            joinJoin: '┼'
          },
          columnDefault: {
            paddingLeft: 1,
            paddingRight: 1
          },
          drawHorizontalLine: (index, size) => {
            return index === 0 || index === 1 || index === size;
          }
        }));
      }
    });

    // Zeige Meta-Informationen
    if (info.lastUpdate) {
      console.log(chalk.gray(`\nLetzte Aktualisierung: ${info.lastUpdate.date}`));
    }
  }

  /**
   * Formatiert Parameternamen für die Anzeige
   */
  formatParameterName(name) {
    const names = {
      // Grundlegende System-Informationen
      serialNumber: 'Seriennummer',
      hardwareVersion: 'Hardware-Version',
      softwareVersion: 'Software-Version',
      hardwareVariant: 'Hardware-Variante',
      softwareVariant: 'Software-Variante',
      componentType: 'Komponente',
      articleNumber: 'Artikelnummer',
      manufacturingDate: 'Herstellungsdatum',
      productCode: 'Produktcode',
      
      // System-Zustand
      chargingState: 'Ladezustand',
      onboardCondition: 'Onboard-Zustand',
      
      // Einstellungen
      language: 'Spracheinstellungen',
      distanceUnit: 'Entfernungseinheiten',
      clockDisplayMode: 'Anzeigeformat für Uhr',
      
      // Bordcomputer-Informationen
      currentTime: 'Aktuelle Uhrzeit',
      currentDate: 'Aktuelles Datum',
      
      // Meta-Informationen
      lastUpdate: 'Letzte Aktualisierung'
    };
    return names[name] || name;
  }

  /**
   * Formatiert Werte für die Anzeige
   */
  formatValue(value) {
    if (value === null || value === undefined) {
      return chalk.gray('Nicht verfügbar');
    }
    
    if (typeof value === 'string' && value.includes('Fehler')) {
      return chalk.red(value);
    }
    
    if (typeof value === 'object' && value.date) {
      return new Date(value.date).toLocaleString('de-DE');
    }
    
    // Entferne Steuerzeichen für Tabellen-Anzeige
    if (typeof value === 'string') {
      return value.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
    }
    
    return value;
  }

  /**
   * Zeigt Hex-Daten in einem formatierten Format
   */
  showHexData(data, description = '') {
    if (!this.showHexData) return;

    console.log(chalk.gray(`\n${description}:`));
    
    const hexString = data.map(b => b.toString(16).padStart(2, '0')).join(' ');
    const lines = [];
    
    for (let i = 0; i < hexString.length; i += 48) {
      lines.push(hexString.substring(i, i + 48));
    }
    
    lines.forEach((line, index) => {
      const offset = (index * 16).toString(16).padStart(4, '0');
      console.log(chalk.gray(`${offset}: ${line}`));
    });
  }

  /**
   * Zeigt eine Fortschrittsanzeige
   */
  showProgress(current, total, description = '') {
    const percentage = Math.round((current / total) * 100);
    const barLength = 30;
    const filledLength = Math.round((barLength * current) / total);
    const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);
    
    process.stdout.write(`\r${description} [${bar}] ${percentage}% (${current}/${total})`);
    
    if (current === total) {
      console.log();
    }
  }

  /**
   * Zeigt eine Fehlermeldung
   */
  showError(message, details = null) {
    console.log(chalk.red.bold('\n❌ Fehler:'));
    console.log(chalk.red(message));
    
    if (details) {
      console.log(chalk.gray('\nDetails:'));
      console.log(chalk.gray(details));
    }
  }

  /**
   * Zeigt eine Erfolgsmeldung
   */
  showSuccess(message) {
    console.log(chalk.green.bold(`\n✓ ${message}`));
  }

  /**
   * Zeigt eine Warnung
   */
  showWarning(message) {
    console.log(chalk.yellow.bold(`\n⚠️  ${message}`));
  }

  /**
   * Zeigt eine Info-Meldung
   */
  showInfo(message) {
    console.log(chalk.blue(`\nℹ️  ${message}`));
  }

  /**
   * Zeigt den Hauptmenü-Prompt
   */
  async showMainMenu() {
    const choices = [
      { name: '📊 Seriennummer auslesen', value: 'serial' },
      { name: '🔧 Hardware-Version auslesen', value: 'hwversion' },
      { name: '💾 Software-Version auslesen', value: 'swversion' },
      { name: '🔋 Ladezustand prüfen', value: 'charging' },
      { name: '🏷️ Produktcode auslesen', value: 'productcode' },
      { name: '📦 Artikelnummer auslesen', value: 'article' },
      { name: '📅 Herstellungsdatum auslesen', value: 'manufacturing' },
      { name: '🖥️ Komponententyp auslesen', value: 'component' },
      { name: '🌐 Spracheinstellungen lesen', value: 'language' },
      { name: '📏 Entfernungseinheiten lesen', value: 'distanceunit' },
      { name: '🕐 Aktuelle Uhrzeit lesen', value: 'currenttime' },
      { name: '📅 Aktuelles Datum lesen', value: 'currentdate' },
      { name: '⏱️ Uhr-Anzeigeformat lesen', value: 'clockmode' },
      { name: '📅 Datum/Zeit setzen', value: 'datetime' },
      { name: '📋 Alle Informationen auslesen', value: 'all' },
      { name: '⚙️  Einstellungen', value: 'settings' },
      { name: '📊 Geräte auflisten', value: 'devices' },
      { name: '❌ Beenden', value: 'exit' }
    ];

    const { action } = await inquirer.prompt([{
      type: 'list',
      name: 'action',
      message: 'Was möchtest du tun?',
      choices
    }]);

    return action;
  }

  /**
   * Zeigt den Einstellungsmenü
   */
  async showSettingsMenu() {
    const choices = [
      { name: '🔍 Hex-Daten anzeigen', value: 'hex' },
      { name: '⏰ Zeitstempel anzeigen', value: 'timestamps' },
      { name: '🎨 Farbige Ausgabe', value: 'colors' },
      { name: '📝 Logging-Einstellungen', value: 'logging' },
      { name: '🔧 Erweiterte Einstellungen', value: 'advanced' },
      { name: '↩️  Zurück zum Hauptmenü', value: 'back' }
    ];

    const { action } = await inquirer.prompt([{
      type: 'list',
      name: 'action',
      message: 'Einstellungen:',
      choices
    }]);

    return action;
  }

  /**
   * Zeigt eine Bestätigungsabfrage
   */
  async showConfirmation(message, defaultValue = false) {
    const { confirmed } = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirmed',
      message,
      default: defaultValue
    }]);

    return confirmed;
  }

  /**
   * Zeigt eine Eingabeaufforderung
   */
  async showInput(message, defaultValue = '') {
    const { value } = await inquirer.prompt([{
      type: 'input',
      name: 'value',
      message,
      default: defaultValue
    }]);

    return value;
  }

  /**
   * Zeigt eine Auswahl aus mehreren Optionen
   */
  async showSelection(message, choices) {
    const { selected } = await inquirer.prompt([{
      type: 'list',
      name: 'selected',
      message,
      choices
    }]);

    return selected;
  }

  /**
   * Zeigt eine Ladeanimation
   */
  showLoading(message = 'Lade...') {
    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let i = 0;

    const interval = setInterval(() => {
      process.stdout.write(`\r${frames[i]} ${message}`);
      i = (i + 1) % frames.length;
    }, 100);

    return () => {
      clearInterval(interval);
      process.stdout.write('\r' + ' '.repeat(message.length + 3) + '\r');
    };
  }

  /**
   * Zeigt eine Zusammenfassung der Verbindung
   */
  showConnectionSummary(device, status) {
    console.log(chalk.blue('\n📡 Verbindungsübersicht:'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(`Gerät: ${device.product || 'Unbekannt'}`);
    console.log(`VID: 0x${device.vendorId.toString(16).toUpperCase()}`);
    console.log(`PID: 0x${device.productId.toString(16).toUpperCase()}`);
    console.log(`Status: ${status ? chalk.green('Verbunden') : chalk.red('Getrennt')}`);
    console.log(chalk.gray('─'.repeat(50)));
  }

  /**
   * Zeigt eine Zusammenfassung der Diagnose-Ergebnisse
   */
  showDiagnosticSummary(results) {
    const total = Object.keys(results).length;
    const successful = Object.values(results).filter(r => r && !r.includes('Fehler')).length;
    const failed = total - successful;

    console.log(chalk.blue('\n📊 Diagnose-Zusammenfassung:'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(`Gesamt: ${total}`);
    console.log(`Erfolgreich: ${chalk.green(successful)}`);
    console.log(`Fehlgeschlagen: ${chalk.red(failed)}`);
    console.log(`Erfolgsrate: ${Math.round((successful / total) * 100)}%`);
    console.log(chalk.gray('─'.repeat(50)));
  }
}

module.exports = UI;
