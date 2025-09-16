/**
 * WebUSB Client für Bosch eBike Display Kommunikation
 * Diese Datei wird im Browser geladen und ermöglicht die direkte WebUSB-Kommunikation
 */

class BoschDisplayWebUsbClient {
  constructor() {
    this.device = null;
    this.isConnected = false;
    this.endpointIn = null;
    this.endpointOut = null;
  }

  /**
   * Prüft, ob WebUSB unterstützt wird
   */
  static isSupported() {
    return typeof navigator !== 'undefined' && 'usb' in navigator;
  }

  /**
   * Fordert den Benutzer auf, ein WebUSB-Gerät auszuwählen
   */
  async requestDevice() {
    if (!BoschDisplayWebUsbClient.isSupported()) {
      throw new Error('WebUSB wird von diesem Browser nicht unterstützt. Bitte verwenden Sie Chrome oder Edge.');
    }

    try {
      // Bosch eBike Display Filter
      const filters = [
        {
          vendorId: 0x108c,  // Bosch
          productId: 0x155   // BUI25X Display
        }
      ];

      // Fordere Gerät an
      this.device = await navigator.usb.requestDevice({ filters });
      
      if (!this.device) {
        throw new Error('Kein WebUSB-Gerät ausgewählt');
      }

      return this.device;
    } catch (error) {
      if (error.name === 'NotFoundError') {
        throw new Error('Kein Bosch Display gefunden. Stellen Sie sicher, dass das Gerät angeschlossen ist.');
      }
      throw new Error(`WebUSB-Gerät-Auswahl fehlgeschlagen: ${error.message}`);
    }
  }

  /**
   * Öffnet die WebUSB-Verbindung
   */
  async open() {
    if (!this.device) {
      throw new Error('Kein WebUSB-Gerät ausgewählt');
    }

    try {
      // Prüfe ob das Gerät bereits geöffnet ist
      if (!this.device.opened) {
        console.log('Öffne WebUSB-Gerät...');
        await this.device.open();
        console.log('WebUSB-Gerät erfolgreich geöffnet');
      } else {
        console.log('WebUSB-Gerät bereits geöffnet');
      }
      
      // Konfiguration auswählen (falls nötig)
      if (this.device.configuration === null) {
        console.log('Wähle Konfiguration 1...');
        await this.device.selectConfiguration(1);
        console.log('Konfiguration 1 ausgewählt');
      } else {
        console.log('Konfiguration bereits ausgewählt');
      }
      
      // Warte kurz, damit die Konfiguration vollständig geladen wird
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Interface beanspruchen
      try {
        console.log('Beanspruche Interface 0...');
        await this.device.claimInterface(0);
        console.log('Interface 0 erfolgreich beansprucht');
      } catch (error) {
        if (error.message.includes('already claimed') || error.message.includes('already in use')) {
          console.log('Interface 0 bereits beansprucht');
        } else if (error.message.includes('must be opened first')) {
          console.log('Gerät muss zuerst geöffnet werden - versuche erneut...');
          // Versuche das Gerät erneut zu öffnen
          if (!this.device.opened) {
            await this.device.open();
          }
          await this.device.selectConfiguration(1);
          await new Promise(resolve => setTimeout(resolve, 200));
          await this.device.claimInterface(0);
          console.log('Interface 0 nach Wiederholung beansprucht');
        } else {
          throw error;
        }
      }
      
      // Endpoints finden
      const configuration = this.device.configurations[0];
      const interface = configuration.interfaces[0];
      const alternate = interface.alternates[0];
      
      this.endpointIn = alternate.endpoints.find(ep => ep.direction === 'in');
      this.endpointOut = alternate.endpoints.find(ep => ep.direction === 'out');
      
      if (!this.endpointIn || !this.endpointOut) {
        throw new Error('HID-Endpoints nicht gefunden');
      }
      
      this.isConnected = true;
      return true;
      
    } catch (error) {
      throw new Error(`WebUSB-Verbindungsfehler: ${error.message}`);
    }
  }

  /**
   * Schließt die WebUSB-Verbindung
   */
  async close() {
    if (this.device && this.isConnected) {
      try {
        // Interface freigeben
        await this.device.releaseInterface(0);
        
        // Gerät schließen
        await this.device.close();
        
      } catch (error) {
        console.warn('Warnung beim Schließen der WebUSB-Verbindung:', error.message);
      }
    }
    
    this.device = null;
    this.endpointIn = null;
    this.endpointOut = null;
    this.isConnected = false;
  }

  /**
   * Sendet Daten an das WebUSB-Gerät
   */
  async write(data) {
    if (!this.isConnected || !this.device || !this.endpointOut) {
      throw new Error('WebUSB-Gerät nicht verbunden');
    }

    try {
      // Konvertiere Buffer zu Array
      const dataArray = Array.from(data);
      
      // HID-Report-ID hinzufügen (0x00 für Input Reports)
      const reportArray = [0x00, ...dataArray];
      
      // Stelle sicher, dass die Daten genau 65 Bytes lang sind (1 Report-ID + 64 Daten)
      if (reportArray.length > 65) {
        reportArray.length = 65; // Kürze auf 65 Bytes
      } else {
        while (reportArray.length < 65) {
          reportArray.push(0x00);
        }
      }
      
      // Debug-Ausgabe
      const hexString = dataArray.slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join(' ');
      console.log(`TX: ${hexString}...`);
      
      // Daten senden
      const result = await this.device.transferOut(this.endpointOut.endpointNumber, new Uint8Array(reportArray));
      
      if (result.status !== 'ok') {
        throw new Error(`Transfer fehlgeschlagen: ${result.status}`);
      }
      
      return result.bytesWritten;
      
    } catch (error) {
      throw new Error(`WebUSB-Schreibfehler: ${error.message}`);
    }
  }

  /**
   * Liest Daten vom WebUSB-Gerät
   */
  async read(timeout = 5000) {
    if (!this.isConnected || !this.device || !this.endpointIn) {
      throw new Error('WebUSB-Gerät nicht verbunden');
    }

    try {
      // Timeout für Transfer setzen
      const startTime = Date.now();
      
      while (Date.now() - startTime < timeout) {
        try {
          // Versuche Daten zu lesen
          const result = await this.device.transferIn(this.endpointIn.endpointNumber, 65);
          
          if (result.status === 'ok' && result.data && result.data.byteLength > 0) {
            // Konvertiere Uint8Array zu Buffer
            const buffer = new Uint8Array(result.data);
            
            // Entferne Report-ID (erstes Byte)
            const data = buffer.slice(1);
            
            // Debug-Ausgabe
            const hexString = data.slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join(' ');
            console.log(`RX: ${hexString}...`);
            
            return data;
          }
          
        } catch (error) {
          // Ignoriere "no data" Fehler und versuche es erneut
          if (!error.message.includes('no data') && !error.message.includes('timeout')) {
            throw error;
          }
        }
        
        // Kurze Pause vor dem nächsten Versuch
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      throw new Error('TIMEOUT');
      
    } catch (error) {
      if (error.message.includes('timeout') || error.message.includes('TIMEOUT')) {
        throw new Error('TIMEOUT');
      }
      throw new Error(`WebUSB-Lesefehler: ${error.message}`);
    }
  }

  /**
   * Prüft, ob das Gerät verbunden ist
   */
  get connected() {
    return this.isConnected && this.device && this.device.opened;
  }

  /**
   * Gibt Geräteinformationen zurück
   */
  get info() {
    if (!this.device) {
      return null;
    }
    
    return {
      vendorId: this.device.vendorId,
      productId: this.device.productId,
      productName: this.device.productName,
      manufacturerName: this.device.manufacturerName,
      serialNumber: this.device.serialNumber
    };
  }
}

// Globale Instanz für die Verwendung in der Webseite
window.BoschDisplayWebUsbClient = BoschDisplayWebUsbClient;
