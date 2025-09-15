const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Konfigurationsklasse für das Bosch Display Tool
 */
class Config {
  constructor() {
    this.configFile = path.join(os.homedir(), '.bosch-display-tool', 'config.json');
    this.defaultConfig = {
      // Geräte-Einstellungen
      device: {
        vendorId: 0x108c,
        productId: 0x155,
        timeout: 5000,
        retryAttempts: 3
      },
      
      // Logging-Einstellungen
      logging: {
        enabled: true,
        verbose: false,
        logToFile: false,
        logFile: 'bosch-display-communication.log'
      },
      
      // Kommunikations-Einstellungen
      communication: {
        handshakeTimeout: 1000,
        responseTimeout: 5000,
        retryDelay: 1000
      },
      
      // UI-Einstellungen
      ui: {
        showHexData: false,
        showTimestamps: true,
        colorOutput: true
      },
      
      // Erweiterte Einstellungen
      advanced: {
        debugMode: false,
        saveRawData: false,
        rawDataFile: 'raw-communication-data.json'
      }
    };
    
    this.config = { ...this.defaultConfig };
    this.load();
  }

  /**
   * Lädt die Konfiguration aus der Datei
   */
  load() {
    try {
      if (fs.existsSync(this.configFile)) {
        const fileContent = fs.readFileSync(this.configFile, 'utf8');
        const savedConfig = JSON.parse(fileContent);
        this.config = { ...this.defaultConfig, ...savedConfig };
      }
    } catch (error) {
      console.warn(`Warnung: Konfigurationsdatei konnte nicht geladen werden: ${error.message}`);
      console.warn('Verwende Standard-Konfiguration.');
    }
  }

  /**
   * Speichert die Konfiguration in die Datei
   */
  save() {
    try {
      const configDir = path.dirname(this.configFile);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      
      fs.writeFileSync(this.configFile, JSON.stringify(this.config, null, 2));
      return true;
    } catch (error) {
      console.error(`Fehler beim Speichern der Konfiguration: ${error.message}`);
      return false;
    }
  }

  /**
   * Gibt einen Konfigurationswert zurück
   */
  get(key) {
    const keys = key.split('.');
    let value = this.config;
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return undefined;
      }
    }
    
    return value;
  }

  /**
   * Setzt einen Konfigurationswert
   */
  set(key, value) {
    const keys = key.split('.');
    let current = this.config;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!(k in current) || typeof current[k] !== 'object') {
        current[k] = {};
      }
      current = current[k];
    }
    
    current[keys[keys.length - 1]] = value;
  }

  /**
   * Gibt die gesamte Konfiguration zurück
   */
  getAll() {
    return { ...this.config };
  }

  /**
   * Setzt die Konfiguration zurück auf Standardwerte
   */
  reset() {
    this.config = { ...this.defaultConfig };
  }

  /**
   * Validiert die Konfiguration
   */
  validate() {
    const errors = [];
    
    // Validiere Geräte-Einstellungen
    if (typeof this.config.device.vendorId !== 'number' || this.config.device.vendorId < 0 || this.config.device.vendorId > 0xFFFF) {
      errors.push('device.vendorId muss eine gültige 16-Bit-Zahl sein');
    }
    
    if (typeof this.config.device.productId !== 'number' || this.config.device.productId < 0 || this.config.device.productId > 0xFFFF) {
      errors.push('device.productId muss eine gültige 16-Bit-Zahl sein');
    }
    
    if (typeof this.config.device.timeout !== 'number' || this.config.device.timeout < 1000) {
      errors.push('device.timeout muss mindestens 1000ms sein');
    }
    
    if (typeof this.config.device.retryAttempts !== 'number' || this.config.device.retryAttempts < 0 || this.config.device.retryAttempts > 10) {
      errors.push('device.retryAttempts muss zwischen 0 und 10 liegen');
    }
    
    // Validiere Logging-Einstellungen
    if (typeof this.config.logging.enabled !== 'boolean') {
      errors.push('logging.enabled muss ein Boolean sein');
    }
    
    if (typeof this.config.logging.verbose !== 'boolean') {
      errors.push('logging.verbose muss ein Boolean sein');
    }
    
    if (typeof this.config.logging.logToFile !== 'boolean') {
      errors.push('logging.logToFile muss ein Boolean sein');
    }
    
    // Validiere Kommunikations-Einstellungen
    if (typeof this.config.communication.handshakeTimeout !== 'number' || this.config.communication.handshakeTimeout < 100) {
      errors.push('communication.handshakeTimeout muss mindestens 100ms sein');
    }
    
    if (typeof this.config.communication.responseTimeout !== 'number' || this.config.communication.responseTimeout < 1000) {
      errors.push('communication.responseTimeout muss mindestens 1000ms sein');
    }
    
    return errors;
  }

  /**
   * Gibt die Konfigurationsdatei-Pfad zurück
   */
  getConfigFilePath() {
    return this.configFile;
  }

  /**
   * Erstellt eine Beispiel-Konfigurationsdatei
   */
  createExampleConfig() {
    const exampleConfig = {
      ...this.defaultConfig,
      logging: {
        enabled: true,
        verbose: true,
        logToFile: true,
        logFile: 'bosch-display-communication.log'
      },
      ui: {
        showHexData: true,
        showTimestamps: true,
        colorOutput: true
      },
      advanced: {
        debugMode: true,
        saveRawData: true,
        rawDataFile: 'raw-communication-data.json'
      }
    };
    
    const exampleFile = path.join(path.dirname(this.configFile), 'config.example.json');
    fs.writeFileSync(exampleFile, JSON.stringify(exampleConfig, null, 2));
    return exampleFile;
  }
}

module.exports = Config;
