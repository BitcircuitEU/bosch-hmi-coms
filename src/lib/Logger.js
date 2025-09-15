const chalk = require('chalk');
const fs = require('fs');
const path = require('path');

/**
 * Logger-Klasse für detaillierte Protokollierung der Kommunikation
 */
class Logger {
  constructor(options = {}) {
    this.enabled = options.enabled !== false;
    this.logToFile = options.logToFile || false;
    this.logFile = options.logFile || 'bosch-display-communication.log';
    this.verbose = options.verbose || false;
    
    if (this.logToFile) {
      this.ensureLogDirectory();
    }
  }

  /**
   * Stellt sicher, dass das Log-Verzeichnis existiert
   */
  ensureLogDirectory() {
    const logDir = path.dirname(this.logFile);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  /**
   * Loggt eine Nachricht
   */
  log(level, message, data = null) {
    if (!this.enabled) return;

    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level}] ${message}`;
    
    // Konsole-Ausgabe
    switch (level) {
      case 'ERROR':
        console.error(chalk.red(logMessage));
        break;
      case 'WARN':
        console.warn(chalk.yellow(logMessage));
        break;
      case 'INFO':
        console.log(chalk.blue(logMessage));
        break;
      case 'DEBUG':
        if (this.verbose) {
          console.log(chalk.gray(logMessage));
        }
        break;
      case 'TRACE':
        if (this.verbose) {
          console.log(chalk.gray(logMessage));
        }
        break;
      default:
        console.log(logMessage);
    }

    // Datei-Logging
    if (this.logToFile) {
      const fileMessage = data ? `${logMessage}\nData: ${JSON.stringify(data, null, 2)}\n` : `${logMessage}\n`;
      fs.appendFileSync(this.logFile, fileMessage);
    }
  }

  /**
   * Loggt HID-Datenübertragung
   */
  logHidData(direction, data, description = '') {
    if (!this.enabled) return;

    const hexString = data.slice(0, 16).map(b => b.toString(16).padStart(2, '0')).join(' ');
    const truncated = data.length > 16 ? '...' : '';
    
    const message = `${direction} ${description}: ${hexString}${truncated}`;
    this.log('TRACE', message, { 
      direction, 
      dataLength: data.length, 
      fullData: Array.from(data) 
    });
  }

  /**
   * Loggt UDS-Service-Aufrufe
   */
  logUdsService(serviceId, dataIdentifier, response = null) {
    if (!this.enabled) return;

    const serviceName = this.getServiceName(serviceId);
    const dataIdName = this.getDataIdentifierName(dataIdentifier);
    
    this.log('DEBUG', `UDS Service: ${serviceName} (${serviceId.toString(16)}) - ${dataIdName}`, {
      serviceId: serviceId.toString(16),
      dataIdentifier: dataIdentifier.map(b => b.toString(16).padStart(2, '0')).join(' '),
      response: response ? Array.from(response) : null
    });
  }

  /**
   * Loggt Verbindungsereignisse
   */
  logConnection(event, device = null) {
    if (!this.enabled) return;

    this.log('INFO', `Verbindung: ${event}`, device ? {
      vendorId: device.vendorId?.toString(16),
      productId: device.productId?.toString(16),
      product: device.product
    } : null);
  }

  /**
   * Loggt Fehler
   */
  logError(error, context = '') {
    if (!this.enabled) return;

    const message = context ? `${context}: ${error.message}` : error.message;
    this.log('ERROR', message, {
      error: error.message,
      stack: error.stack,
      context
    });
  }

  /**
   * Gibt den Service-Namen zurück
   */
  getServiceName(serviceId) {
    const services = {
      0x22: 'Read Data By Identifier',
      0x2E: 'Write Data By Identifier',
      0x34: 'Request Download',
      0x36: 'Transfer Data',
      0x37: 'Request Transfer Exit'
    };
    return services[serviceId] || `Unknown Service (0x${serviceId.toString(16)})`;
  }

  /**
   * Gibt den Data Identifier Namen zurück
   */
  getDataIdentifierName(dataIdentifier) {
    const identifiers = {
      '02,42': 'Serial Number',
      '02,21': 'Hardware Version',
      '02,20': 'Software Version',
      '02,30': 'Hardware Variant',
      '02,31': 'Software Variant',
      '02,60': 'Component Type',
      '02,32': 'HMI Part Number',
      '02,72': 'System Charge State',
      '02,71': 'HMI Onboard Condition',
      '02,4A': 'Language Setting',
      '02,3A': 'Present Date Time',
      '5B,7C': 'Bosch Product Code'
    };
    
    const key = dataIdentifier.map(b => b.toString(16).padStart(2, '0')).join(',');
    return identifiers[key] || `Unknown Identifier (${key})`;
  }

  /**
   * Aktiviert/Deaktiviert das Logging
   */
  setEnabled(enabled) {
    this.enabled = enabled;
  }

  /**
   * Setzt den Verbose-Modus
   */
  setVerbose(verbose) {
    this.verbose = verbose;
  }

  /**
   * Setzt die Log-Datei
   */
  setLogFile(logFile) {
    this.logFile = logFile;
    this.logToFile = true;
    this.ensureLogDirectory();
  }
}

module.exports = Logger;
