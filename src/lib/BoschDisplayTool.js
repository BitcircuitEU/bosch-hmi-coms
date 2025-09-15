const chalk = require('chalk');
const { table } = require('table');
const { isBoschDisplay } = require('./deviceManager');
const SimpleHidWrapper = require('./SimpleHidWrapper');
const { 
  UDS_SERVICES, 
  DATA_IDENTIFIERS, 
  HID_FRAME_HEADERS,
  COMPONENT_TYPES,
  ProtocolHelper 
} = require('./protocols');

/**
 * Hauptklasse für die Kommunikation mit Bosch eBike Displays
 */
class BoschDisplayTool {
  constructor() {
    this.device = null;
    this.hidWrapper = null;
    this.isConnected = false;
    this.sequenceNumber = 0;
  }

  /**
   * Verbindet mit dem angegebenen HID-Gerät
   */
  async connect(device) {
    if (!isBoschDisplay(device)) {
      throw new Error('Das angegebene Gerät ist kein Bosch eBike Display!');
    }

    try {
      this.device = device;
      this.hidWrapper = new SimpleHidWrapper(device);
      await this.hidWrapper.open();
      this.isConnected = true;
      
      console.log(chalk.green(`✓ Verbunden mit ${device.product || 'Bosch Display'}`));
      
      // Führe Handshake durch
      await this.performHandshake();
      
    } catch (error) {
      this.isConnected = false;
      throw new Error(`Verbindungsfehler: ${error.message}`);
    }
  }

  /**
   * Führt den initialen Handshake mit dem Display durch
   */
  async performHandshake() {
    if (!this.isConnected) {
      throw new Error('Nicht mit dem Display verbunden!');
    }

    try {
      console.log(chalk.blue('🤝 Führe Handshake durch...'));
      
      // Handshake Request mit Protokoll-Helper
      const handshakeRequest = ProtocolHelper.createHandshakeFrame();
      await this.sendData(handshakeRequest);
      
      // Warte auf Handshake Response
      const response = await this.receiveData(1000);
      
      // Prüfe Response-Header
      if (response && 
          response[0] === HID_FRAME_HEADERS.HANDSHAKE_RESPONSE[0] && 
          response[1] === HID_FRAME_HEADERS.HANDSHAKE_RESPONSE[1] && 
          response[2] === HID_FRAME_HEADERS.HANDSHAKE_RESPONSE[2] && 
          response[3] === HID_FRAME_HEADERS.HANDSHAKE_RESPONSE[3]) {
        console.log(chalk.green('✓ Handshake erfolgreich'));
        return true;
      } else {
        throw new Error('Handshake fehlgeschlagen - ungültige Response');
      }
      
    } catch (error) {
      throw new Error(`Handshake-Fehler: ${error.message}`);
    }
  }

  /**
   * Sendet Daten an das Display
   */
  async sendData(data) {
    if (!this.isConnected || !this.hidWrapper) {
      throw new Error('Nicht mit dem Display verbunden!');
    }

    try {
      await this.hidWrapper.write(data);
    } catch (error) {
      throw new Error(`Sendefehler: ${error.message}`);
    }
  }

  /**
   * Empfängt Daten vom Display
   */
  async receiveData(timeout = 5000) {
    if (!this.isConnected || !this.hidWrapper) {
      throw new Error('Nicht mit dem Display verbunden!');
    }

    try {
      const data = await this.hidWrapper.read(timeout);
      return data;
    } catch (error) {
      if (error.message.includes('timeout') || error.message.includes('Timeout')) {
        throw new Error('TIMEOUT');
      }
      throw new Error(`Empfangsfehler: ${error.message}`);
    }
  }

  /**
   * Sendet einen UDS-Service-Request
   */
  async sendUdsRequest(serviceId, dataIdentifier, additionalData = [], timeout = 3000) {
    if (!this.isConnected) {
      throw new Error('Nicht mit dem Display verbunden!');
    }

    try {
      // UDS Request Frame mit Protokoll-Helper
      const request = ProtocolHelper.createUdsFrame(serviceId, dataIdentifier, additionalData);
      await this.sendData(request);
      
      // Empfange Response mit Timeout
      const response = await this.receiveData(timeout);
      
      // Parse Response mit Protokoll-Helper
      const parsedResponse = ProtocolHelper.parseUdsResponse(response);
      
      if (ProtocolHelper.isResponseSuccessful(response)) {
        // Gib die rohen Response-Daten zurück für korrekte Parsing
        return response;
      } else {
        throw new Error(`UDS-Response-Fehler: Service ${parsedResponse.serviceId.toString(16)}`);
      }
      
    } catch (error) {
      if (error.message.includes('Timeout') || error.message.includes('TIMEOUT')) {
        throw new Error('TIMEOUT');
      }
      throw new Error(`UDS-Request-Fehler: ${error.message}`);
    }
  }

  /**
   * Liest die Seriennummer des Displays
   */
  async readSerialNumber() {
    try {
      console.log(chalk.blue('📊 Lese Seriennummer...'));
      
      const response = await this.sendUdsRequest(
        UDS_SERVICES.READ_DATA_BY_IDENTIFIER, 
        DATA_IDENTIFIERS.SERIAL_NUMBER
      );
      
      if (response && response.length > 0) {
        // Extrahiere die Seriennummer aus der tatsächlichen Response
        // Die Seriennummer beginnt nach dem UDS-Header (normalerweise ab Byte 8)
        const dataStart = response.length > 8 ? 8 : 5; // Fallback falls Response kürzer ist
        const serialData = response.slice(dataStart, dataStart + 12);
        const serial = ProtocolHelper.hexToSerialNumber(serialData);
        return serial || 'Seriennummer nicht lesbar';
      } else {
        throw new Error('Keine Seriennummer empfangen');
      }
      
    } catch (error) {
      throw new Error(`Seriennummer-Lesefehler: ${error.message}`);
    }
  }

  /**
   * Liest die Hardware-Version
   */
  async readHardwareVersion() {
    try {
      console.log(chalk.blue('📊 Lese Hardware-Version...'));
      
      const response = await this.sendUdsRequest(
        UDS_SERVICES.READ_DATA_BY_IDENTIFIER, 
        DATA_IDENTIFIERS.HARDWARE_VERSION
      );
      
      if (response && response.length >= 4) {
        // Extrahiere die Version-Daten aus der Response
        // Die Hardware-Version ist in den Bytes 8-11 (0 0 2 2)
        const data = response.slice(8, 12);
        return ProtocolHelper.hexToVersion(data);
      } else {
        throw new Error('Keine Hardware-Version empfangen');
      }
      
    } catch (error) {
      throw new Error(`Hardware-Version-Lesefehler: ${error.message}`);
    }
  }

  /**
   * Liest die Software-Version
   */
  async readSoftwareVersion() {
    try {
      console.log(chalk.blue('📊 Lese Software-Version...'));
      
      const response = await this.sendUdsRequest(
        UDS_SERVICES.READ_DATA_BY_IDENTIFIER, 
        DATA_IDENTIFIERS.SOFTWARE_VERSION
      );
      
      if (response && response.length >= 4) {
        // Extrahiere die Version-Daten aus der Response
        // Die Software-Version ist in den Bytes 8-11 (5 9 2 0)
        const data = response.slice(8, 12);
        return ProtocolHelper.hexToVersion(data);
      } else {
        throw new Error('Keine Software-Version empfangen');
      }
      
    } catch (error) {
      throw new Error(`Software-Version-Lesefehler: ${error.message}`);
    }
  }


  /**
   * Liest den Produktcode
   */
  async readProductCode() {
    try {
      console.log(chalk.blue('📊 Lese Produktcode...'));
      
      const response = await this.sendUdsRequest(
        UDS_SERVICES.READ_DATA_BY_IDENTIFIER, 
        DATA_IDENTIFIERS.BOSCH_PRODUCT_CODE
      );
      
      if (response && response.length > 0) {
        // Extrahiere den Produktcode aus der Response
        // Der Produktcode ist in den Bytes 8-13 (42 55 49 32 35 35 = BUI255)
        const data = response.slice(8, 14);
        const productCode = ProtocolHelper.hexToAscii(data);
        return productCode || 'Produktcode nicht lesbar';
      } else {
        throw new Error('Kein Produktcode empfangen');
      }
      
    } catch (error) {
      throw new Error(`Produktcode-Lesefehler: ${error.message}`);
    }
  }











  /**
   * Liest die Artikelnummer (HMI Part Number)
   */
  async readArticleNumber() {
    try {
      console.log(chalk.blue('📊 Lese Artikelnummer...'));
      
      const response = await this.sendUdsRequest(
        UDS_SERVICES.READ_DATA_BY_IDENTIFIER, 
        DATA_IDENTIFIERS.HMI_PART_NUMBER
      );
      
      if (response && response.length > 0) {
        // Extrahiere die Artikelnummer-Daten aus der Response
        // Die Artikelnummer ist in den Bytes 8-17 (31 32 37 30 30 32 30 39 30 39)
        const data = response.slice(8, 18);
        const articleNumber = ProtocolHelper.hexToArticleNumber(data);
        return articleNumber || 'Artikelnummer nicht lesbar';
      } else {
        throw new Error('Keine Artikelnummer empfangen');
      }
      
    } catch (error) {
      throw new Error(`Artikelnummer-Lesefehler: ${error.message}`);
    }
  }

  /**
   * Liest den Komponententyp
   */
  async readComponentType() {
    try {
      console.log(chalk.blue('📊 Lese Komponententyp...'));
      
      const response = await this.sendUdsRequest(
        UDS_SERVICES.READ_DATA_BY_IDENTIFIER, 
        DATA_IDENTIFIERS.COMPONENT_TYPE
      );
      
      if (response && response.length > 0) {
        // Extrahiere die Komponente-Daten aus der Response
        // Die Komponente ist in Byte 8 (0)
        const componentCode = response[8];
        return COMPONENT_TYPES[componentCode] || `Unbekannt (0x${componentCode.toString(16)})`;
      } else {
        throw new Error('Kein Komponententyp empfangen');
      }
      
    } catch (error) {
      throw new Error(`Komponententyp-Lesefehler: ${error.message}`);
    }
  }

  /**
   * Liest die aktuelle Uhrzeit
   */
  async readCurrentTime() {
    try {
      console.log(chalk.blue('📊 Lese aktuelle Uhrzeit...'));
      
      const response = await this.sendUdsRequest(
        UDS_SERVICES.READ_DATA_BY_IDENTIFIER, 
        DATA_IDENTIFIERS.CURRENT_TIME
      );
      
      if (response && response.length >= 2) {
        // Extrahiere die Uhrzeit-Daten aus der Response
        // Die Uhrzeit ist in den Bytes 8-9
        const data = response.slice(8, 10);
        return ProtocolHelper.hexToTime(data);
      } else {
        throw new Error('Keine Uhrzeit empfangen');
      }
      
    } catch (error) {
      throw new Error(`Uhrzeit-Lesefehler: ${error.message}`);
    }
  }

  /**
   * Liest das aktuelle Datum
   */
  async readCurrentDate() {
    try {
      console.log(chalk.blue('📊 Lese aktuelles Datum...'));
      
      const response = await this.sendUdsRequest(
        UDS_SERVICES.READ_DATA_BY_IDENTIFIER, 
        DATA_IDENTIFIERS.CURRENT_DATE
      );
      
      if (response && response.length >= 3) {
        // Extrahiere das Datum aus der tatsächlichen Response
        // Das Datum beginnt nach dem UDS-Header (normalerweise ab Byte 8)
        const dataStart = response.length > 8 ? 8 : 5; // Fallback falls Response kürzer ist
        const dateData = response.slice(dataStart, dataStart + 3);
        return ProtocolHelper.hexToDate(dateData);
      } else {
        throw new Error('Kein Datum empfangen');
      }
      
    } catch (error) {
      throw new Error(`Datum-Lesefehler: ${error.message}`);
    }
  }

  /**
   * Setzt Datum und Zeit
   */
  async setDateTime(date) {
    try {
      console.log(chalk.blue('📅 Setze Datum und Zeit...'));
      
      const year = date.getFullYear() - 2000; // Bosch verwendet 2-stellige Jahre
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const hour = date.getHours();
      const minute = date.getMinutes();
      
      const response = await this.sendUdsRequest(
        UDS_SERVICES.WRITE_DATA_BY_IDENTIFIER, 
        DATA_IDENTIFIERS.PRESENT_DATE_TIME,
        [year, month, day, hour, minute]
      );
      
      if (response && response[0] === 0x6E) {
        return true;
      } else {
        throw new Error('Datum/Zeit konnte nicht gesetzt werden');
      }
      
    } catch (error) {
      throw new Error(`Datum/Zeit-Setze-Fehler: ${error.message}`);
    }
  }

  /**
   * Liest Drive Unit Informationen
   */
  async readDriveUnitInfo() {
    if (!this.isConnected) {
      throw new Error('Nicht mit dem Display verbunden!');
    }

    try {
      console.log(chalk.blue('🚴 Lese Drive Unit Informationen...'));
      
      const duInfo = {};
      let hasTimeout = false;
      
      // DU Part Number
      try {
        const response = await this.sendUdsRequest(
          UDS_SERVICES.READ_DATA_BY_IDENTIFIER,
          DATA_IDENTIFIERS.DU_PART_NUMBER,
          [],
          2000 // 2 Sekunden Timeout
        );
        if (response && response.length > 0) {
          const data = response.slice(8, 18);
          duInfo.partNumber = ProtocolHelper.hexToArticleNumber(data);
        }
      } catch (error) {
        if (error.message === 'TIMEOUT') {
          hasTimeout = true;
          duInfo.partNumber = 'Nicht angeschlossen (Timeout)';
        } else {
          duInfo.partNumber = `Fehler: ${error.message}`;
        }
      }

      // DU Serial Number
      try {
        const response = await this.sendUdsRequest(
          UDS_SERVICES.READ_DATA_BY_IDENTIFIER,
          DATA_IDENTIFIERS.DU_SERIAL_NUMBER,
          [],
          2000
        );
        if (response && response.length > 0) {
          const data = response.slice(8, 20);
          duInfo.serialNumber = ProtocolHelper.hexToSerialNumber(data);
        }
      } catch (error) {
        if (error.message === 'TIMEOUT') {
          hasTimeout = true;
          duInfo.serialNumber = 'Nicht angeschlossen (Timeout)';
        } else {
          duInfo.serialNumber = `Fehler: ${error.message}`;
        }
      }

      // DU Hardware Version
      try {
        const response = await this.sendUdsRequest(
          UDS_SERVICES.READ_DATA_BY_IDENTIFIER,
          DATA_IDENTIFIERS.DU_HW_VERSION,
          [],
          2000
        );
        if (response && response.length >= 4) {
          const data = response.slice(8, 12);
          duInfo.hardwareVersion = ProtocolHelper.hexToVersion(data);
        }
      } catch (error) {
        if (error.message === 'TIMEOUT') {
          hasTimeout = true;
          duInfo.hardwareVersion = 'Nicht angeschlossen (Timeout)';
        } else {
          duInfo.hardwareVersion = `Fehler: ${error.message}`;
        }
      }

      // DU Software Version
      try {
        const response = await this.sendUdsRequest(
          UDS_SERVICES.READ_DATA_BY_IDENTIFIER,
          DATA_IDENTIFIERS.DU_SW_VERSION,
          [],
          2000
        );
        if (response && response.length >= 4) {
          const data = response.slice(8, 12);
          duInfo.softwareVersion = ProtocolHelper.hexToVersion(data);
        }
      } catch (error) {
        if (error.message === 'TIMEOUT') {
          hasTimeout = true;
          duInfo.softwareVersion = 'Nicht angeschlossen (Timeout)';
        } else {
          duInfo.softwareVersion = `Fehler: ${error.message}`;
        }
      }

      // Setze Status basierend auf Timeouts
      if (hasTimeout) {
        duInfo.status = 'Nicht angeschlossen';
        duInfo.message = 'Drive Unit ist nicht am Display angeschlossen oder nicht verfügbar';
      } else {
        duInfo.status = 'Verfügbar';
      }

      return duInfo;
      
    } catch (error) {
      throw new Error(`Drive Unit Info-Lesefehler: ${error.message}`);
    }
  }

  /**
   * Liest Battery Management System Informationen
   */
  async readBatteryManagementInfo() {
    if (!this.isConnected) {
      throw new Error('Nicht mit dem Display verbunden!');
    }

    try {
      console.log(chalk.blue('🔋 Lese Battery Management System Informationen...'));
      
      const bmsInfo = {};
      let hasTimeout = false;
      
      // BMS Part Number
      try {
        const response = await this.sendUdsRequest(
          UDS_SERVICES.READ_DATA_BY_IDENTIFIER,
          DATA_IDENTIFIERS.BMS_PART_NUMBER,
          [],
          2000 // 2 Sekunden Timeout
        );
        if (response && response.length > 0) {
          const data = response.slice(8, 18);
          bmsInfo.partNumber = ProtocolHelper.hexToArticleNumber(data);
        }
      } catch (error) {
        if (error.message === 'TIMEOUT') {
          hasTimeout = true;
          bmsInfo.partNumber = 'Nicht angeschlossen (Timeout)';
        } else {
          bmsInfo.partNumber = `Fehler: ${error.message}`;
        }
      }

      // BMS Serial Number
      try {
        const response = await this.sendUdsRequest(
          UDS_SERVICES.READ_DATA_BY_IDENTIFIER,
          DATA_IDENTIFIERS.BMS_SERIAL_NUMBER,
          [],
          2000
        );
        if (response && response.length > 0) {
          const data = response.slice(8, 20);
          bmsInfo.serialNumber = ProtocolHelper.hexToSerialNumber(data);
        }
      } catch (error) {
        if (error.message === 'TIMEOUT') {
          hasTimeout = true;
          bmsInfo.serialNumber = 'Nicht angeschlossen (Timeout)';
        } else {
          bmsInfo.serialNumber = `Fehler: ${error.message}`;
        }
      }

      // BMS Hardware Version
      try {
        const response = await this.sendUdsRequest(
          UDS_SERVICES.READ_DATA_BY_IDENTIFIER,
          DATA_IDENTIFIERS.BMS_HW_VERSION,
          [],
          2000
        );
        if (response && response.length >= 4) {
          const data = response.slice(8, 12);
          bmsInfo.hardwareVersion = ProtocolHelper.hexToVersion(data);
        }
      } catch (error) {
        if (error.message === 'TIMEOUT') {
          hasTimeout = true;
          bmsInfo.hardwareVersion = 'Nicht angeschlossen (Timeout)';
        } else {
          bmsInfo.hardwareVersion = `Fehler: ${error.message}`;
        }
      }

      // BMS Software Version
      try {
        const response = await this.sendUdsRequest(
          UDS_SERVICES.READ_DATA_BY_IDENTIFIER,
          DATA_IDENTIFIERS.BMS_SW_VERSION,
          [],
          2000
        );
        if (response && response.length >= 4) {
          const data = response.slice(8, 12);
          bmsInfo.softwareVersion = ProtocolHelper.hexToVersion(data);
        }
      } catch (error) {
        if (error.message === 'TIMEOUT') {
          hasTimeout = true;
          bmsInfo.softwareVersion = 'Nicht angeschlossen (Timeout)';
        } else {
          bmsInfo.softwareVersion = `Fehler: ${error.message}`;
        }
      }

      // Setze Status basierend auf Timeouts
      if (hasTimeout) {
        bmsInfo.status = 'Nicht angeschlossen';
        bmsInfo.message = 'Battery Management System ist nicht am Display angeschlossen oder nicht verfügbar';
      } else {
        bmsInfo.status = 'Verfügbar';
      }

      return bmsInfo;
      
    } catch (error) {
      throw new Error(`Battery Management Info-Lesefehler: ${error.message}`);
    }
  }

  /**
   * Liest alle verfügbaren Informationen
   */
  async readAllInformation(mode = 'display') {
    try {
      console.log(chalk.blue('📋 Lese alle Display-Informationen...\n'));
      
      const results = {};
      
      // Sammle alle Informationen
      const tasks = [
        // Grundlegende System-Informationen
        { key: 'serialNumber', name: 'Seriennummer', fn: () => this.readSerialNumber() },
        { key: 'hardwareVersion', name: 'Hardware-Version', fn: () => this.readHardwareVersion() },
        { key: 'softwareVersion', name: 'Software-Version', fn: () => this.readSoftwareVersion() },
        { key: 'productCode', name: 'Produktcode', fn: () => this.readProductCode() },
        { key: 'articleNumber', name: 'Artikelnummer', fn: () => this.readArticleNumber() },
        { key: 'componentType', name: 'Komponente', fn: () => this.readComponentType() },
        
        // Bordcomputer-Informationen
        { key: 'currentTime', name: 'Aktuelle Uhrzeit', fn: () => this.readCurrentTime() },
        { key: 'currentDate', name: 'Aktuelles Datum', fn: () => this.readCurrentDate() },
      ];
      
      for (const task of tasks) {
        try {
          const value = await task.fn();
          results[task.key] = value;
        } catch (error) {
          results[task.key] = `Fehler: ${error.message}`;
        }
      }
      
      // Versuche Drive Unit und Battery Management Info zu lesen (nur im full-Modus)
      if (mode === 'full') {
        try {
          console.log(chalk.blue('🚴 Versuche Drive Unit Informationen zu lesen...'));
          results.driveUnit = await this.readDriveUnitInfo();
        } catch (error) {
          results.driveUnit = { 
            error: error.message,
            status: 'Fehler',
            message: 'Drive Unit konnte nicht gelesen werden'
          };
        }
        
        try {
          console.log(chalk.blue('🔋 Versuche Battery Management Informationen zu lesen...'));
          results.batteryManagement = await this.readBatteryManagementInfo();
        } catch (error) {
          results.batteryManagement = { 
            error: error.message,
            status: 'Fehler',
            message: 'Battery Management System konnte nicht gelesen werden'
          };
        }
      } else {
        // Im display-Modus: Zeige Hinweis
        results.driveUnit = {
          status: 'Nicht abgefragt',
          message: 'Drive Unit wird nur im full-Modus abgefragt (Display muss am Fahrrad angeschlossen sein)'
        };
        results.batteryManagement = {
          status: 'Nicht abgefragt',
          message: 'Battery Management wird nur im full-Modus abgefragt (Display muss am Fahrrad angeschlossen sein)'
        };
      }
      
      // Füge Zeitstempel hinzu
      results.lastUpdate = { date: new Date().toISOString() };
      
      return results;
      
    } catch (error) {
      throw new Error(`Allgemeine Informationslese-Fehler: ${error.message}`);
    }
  }

  /**
   * Trennt die Verbindung zum Display
   */
  async disconnect() {
    if (this.hidWrapper) {
      try {
        await this.hidWrapper.close();
        console.log(chalk.green('✓ Verbindung getrennt'));
      } catch (error) {
        console.error(chalk.yellow(`Warnung beim Trennen: ${error.message}`));
      }
    }
    
    this.hidWrapper = null;
    this.device = null;
    this.isConnected = false;
  }
}

module.exports = BoschDisplayTool;
