const HID = require('node-hid');
const chalk = require('chalk');

/**
 * Einfacher HID-Wrapper mit synchroner API
 */
class SimpleHidWrapper {
  constructor(device) {
    this.device = device;
    this.hidDevice = null;
    this.isConnected = false;
  }

  /**
   * Öffnet die HID-Verbindung
   */
  async open() {
    try {
      this.hidDevice = new HID.HID(this.device.path);
      this.isConnected = true;
      return true;
    } catch (error) {
      throw new Error(`HID-Verbindungsfehler: ${error.message}`);
    }
  }

  /**
   * Schließt die HID-Verbindung
   */
  async close() {
    if (this.hidDevice) {
      try {
        this.hidDevice.close();
      } catch (error) {
        console.warn(chalk.yellow('Warnung beim Schließen:'), error.message);
      }
    }
    this.hidDevice = null;
    this.isConnected = false;
  }

  /**
   * Sendet Daten an das HID-Gerät
   */
  async write(data) {
    if (!this.isConnected || !this.hidDevice) {
      throw new Error('HID-Gerät nicht verbunden');
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
      console.log(chalk.gray(`TX: ${hexString}...`));
      
      // Verwende die synchrone write() Methode
      const bytesWritten = this.hidDevice.write(reportArray);
      
      if (bytesWritten !== reportArray.length) {
        throw new Error(`Nur ${bytesWritten} von ${reportArray.length} Bytes geschrieben`);
      }
      
      return bytesWritten;
    } catch (error) {
      throw new Error(`Schreibfehler: ${error.message}`);
    }
  }

  /**
   * Liest Daten vom HID-Gerät
   */
  async read(timeout = 5000) {
    if (!this.isConnected || !this.hidDevice) {
      throw new Error('HID-Gerät nicht verbunden');
    }

    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const tryRead = () => {
        try {
          // Verwende die synchrone read() Methode ohne Callback
          const data = this.hidDevice.readSync();
          if (data && data.length > 0) {
            const buffer = Buffer.from(data);
            const hexString = buffer.slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join(' ');
            console.log(chalk.gray(`RX: ${hexString}...`));
            resolve(buffer);
            return;
          }
        } catch (error) {
          // Ignoriere "no data" Fehler und versuche es erneut
          if (!error.message.includes('no data') && !error.message.includes('need one callback')) {
            reject(new Error(`Lesefehler: ${error.message}`));
            return;
          }
        }
        
        // Prüfe Timeout
        if (Date.now() - startTime > timeout) {
          reject(new Error('Timeout beim Lesen von Daten'));
          return;
        }
        
        // Versuche es erneut nach kurzer Pause
        setTimeout(tryRead, 10);
      };
      
      tryRead();
    });
  }

  /**
   * Prüft, ob das Gerät verbunden ist
   */
  get connected() {
    return this.isConnected;
  }

  /**
   * Gibt Geräteinformationen zurück
   */
  get info() {
    return {
      vendorId: this.device.vendorId,
      productId: this.device.productId,
      product: this.device.product,
      manufacturer: this.device.manufacturer,
      path: this.device.path
    };
  }
}

module.exports = SimpleHidWrapper;
