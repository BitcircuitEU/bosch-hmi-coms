const chalk = require('chalk');
const { 
  UDS_SERVICES, 
  DATA_IDENTIFIERS, 
  HID_FRAME_HEADERS,
  COMPONENT_TYPES,
  ProtocolHelper,
  PcapAnalyzer
} = require('./protocols');

/**
 * Hauptklasse für die Kommunikation mit Bosch eBike Displays
 * Angepasst für WebUSB-Kommunikation
 */
class BoschDisplayTool {
  constructor(usbWrapper = null) {
    this.device = null;
    this.usbWrapper = usbWrapper;
    this.isConnected = false;
    this.sequenceNumber = 0;
  }

  /**
   * Verbindet mit dem angegebenen WebUSB-Gerät
   */
  async connect(device) {
    if (!this.usbWrapper) {
      throw new Error('WebUSB Wrapper nicht initialisiert!');
    }

    try {
      this.device = device;
      await this.usbWrapper.open();
      this.isConnected = true;
      
      console.log(chalk.green(`✓ Verbunden mit ${device.productName || 'Bosch Display'}`));
      
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
    if (!this.isConnected || !this.usbWrapper) {
      throw new Error('Nicht mit dem Display verbunden!');
    }

    try {
      await this.usbWrapper.write(data);
    } catch (error) {
      throw new Error(`Sendefehler: ${error.message}`);
    }
  }

  /**
   * Empfängt Daten vom Display
   */
  async receiveData(timeout = 5000) {
    if (!this.isConnected || !this.usbWrapper) {
      throw new Error('Nicht mit dem Display verbunden!');
    }

    try {
      const data = await this.usbWrapper.read(timeout);
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
        // Parse die Response mit der korrigierten Funktion
        const parsed = ProtocolHelper.parseUdsResponse(response);
        
        if (parsed.isPositiveResponse && parsed.data.length > 0) {
          // Die Seriennummer ist in den Response-Daten
          const serialData = parsed.data.slice(0, Math.min(20, parsed.data.length));
          const serial = ProtocolHelper.hexToSerialNumber(serialData);
          return serial || 'Seriennummer nicht lesbar';
        } else {
          throw new Error('Ungültige Response für Seriennummer');
        }
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
      
      if (response && response.length > 0) {
        // Parse die Response mit der korrigierten Funktion
        const parsed = ProtocolHelper.parseUdsResponse(response);
        
        if (parsed.isPositiveResponse && parsed.data.length >= 2) {
          // Die Hardware-Version ist in den Response-Daten
          const data = parsed.data.slice(0, 2);
          return ProtocolHelper.hexToVersion(data);
        } else {
          throw new Error('Ungültige Response für Hardware-Version');
        }
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
      
      if (response && response.length > 0) {
        // Parse die Response mit der korrigierten Funktion
        const parsed = ProtocolHelper.parseUdsResponse(response);
        
        if (parsed.isPositiveResponse && parsed.data.length >= 2) {
          // Die Software-Version ist in den Response-Daten
          const data = parsed.data.slice(0, 2);
          return ProtocolHelper.hexToVersion(data);
        } else {
          throw new Error('Ungültige Response für Software-Version');
        }
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
        // Parse die Response mit der korrigierten Funktion
        const parsed = ProtocolHelper.parseUdsResponse(response);
        
        if (parsed.isPositiveResponse && parsed.data.length > 0) {
          // Der Produktcode ist in den Response-Daten
          const data = parsed.data.slice(0, Math.min(10, parsed.data.length));
          const productCode = ProtocolHelper.hexToAscii(data);
          return productCode || 'Produktcode nicht lesbar';
        } else {
          throw new Error('Ungültige Response für Produktcode');
        }
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
        // Parse die Response mit der korrigierten Funktion
        const parsed = ProtocolHelper.parseUdsResponse(response);
        
        if (parsed.isPositiveResponse && parsed.data.length > 0) {
          // Die Artikelnummer ist in den Response-Daten
          const data = parsed.data.slice(0, Math.min(15, parsed.data.length));
          const articleNumber = ProtocolHelper.hexToArticleNumber(data);
          return articleNumber || 'Artikelnummer nicht lesbar';
        } else {
          throw new Error('Ungültige Response für Artikelnummer');
        }
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
        // Parse die Response mit der korrigierten Funktion
        const parsed = ProtocolHelper.parseUdsResponse(response);
        
        if (parsed.isPositiveResponse && parsed.data.length > 0) {
          // Die Komponente ist in den Response-Daten
          const componentCode = parsed.data[0];
          return COMPONENT_TYPES[componentCode] || `Unbekannt (0x${componentCode.toString(16)})`;
        } else {
          throw new Error('Ungültige Response für Komponententyp');
        }
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
        const dataStart = response.length > 8 ? 8 : 5; // Fallback falls Response kürzer ist
        const data = response.slice(dataStart, dataStart + 2);
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
    if (this.usbWrapper) {
      try {
        await this.usbWrapper.close();
        console.log(chalk.green('✓ Verbindung getrennt'));
      } catch (error) {
        console.error(chalk.yellow(`Warnung beim Trennen: ${error.message}`));
      }
    }
    
    this.usbWrapper = null;
    this.device = null;
    this.isConnected = false;
  }
}

module.exports = BoschDisplayTool;
