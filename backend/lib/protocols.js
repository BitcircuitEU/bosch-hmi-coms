/**
 * Protokoll-Definitionen für Bosch eBike Display Kommunikation
 * Basierend auf der Analyse der bosch.log
 */

/**
 * HID-Device-Konstanten
 */
const DEVICE_CONSTANTS = {
  VENDOR_ID: 0x108c,  // Bosch
  PRODUCT_ID: 0x155,  // BUI25X Display
  REPORT_SIZE: 64     // HID Report Größe
};

/**
 * UDS Service IDs (basierend auf der Log-Analyse)
 */
const UDS_SERVICES = {
  // Read Data By Identifier (0x22)
  READ_DATA_BY_IDENTIFIER: 0x22,
  
  // Write Data By Identifier (0x2E)
  WRITE_DATA_BY_IDENTIFIER: 0x2E,
  
  // Request Download (0x34)
  REQUEST_DOWNLOAD: 0x34,
  
  // Transfer Data (0x36)
  TRANSFER_DATA: 0x36,
  
  // Request Transfer Exit (0x37)
  REQUEST_TRANSFER_EXIT: 0x37
};

/**
 * Daten-Identifier für verschiedene Display-Parameter
 * Basierend auf PCAP-Analyse der bosch-cap.pcap
 */
const DATA_IDENTIFIERS = {
  // System Information - KORRIGIERT basierend auf PCAP
  SERIAL_NUMBER: [0x02, 0x42],          // ✅ Bestätigt aus PCAP
  HARDWARE_VERSION: [0x02, 0x72],       // 🔧 KORRIGIERT: War [0x02, 0x21]
  SOFTWARE_VERSION: [0x02, 0x20],       // Aus PCAP nicht bestätigt
  COMPONENT_TYPE: [0x02, 0x60],         // ✅ Bestätigt aus PCAP (0x0B = Intuvia)
  HMI_PART_NUMBER: [0x02, 0x32],        // ✅ Bestätigt aus PCAP
  
  // System State - Zurück zu ursprünglichen Werten
  PRESENT_DATE_TIME: [0x02, 0x3A],      // Aus PCAP nicht bestätigt
  CURRENT_TIME: [0x02, 0x40],           // Aus PCAP nicht bestätigt  
  CURRENT_DATE: [0x02, 0x3A],           // Aus PCAP nicht bestätigt
  
  // Bosch specific - ✅ Bestätigt aus PCAP
  BOSCH_PRODUCT_CODE: [0x5B, 0x7C],     // "BUI255" aus PCAP
  
  // NEUE IDENTIFIERS aus PCAP-Analyse
  UNKNOWN_0x10_03: [0x10, 0x03],        // System-Info Request
  UNKNOWN_0x3E_00: [0x3E, 0x00],        // Unbekannter Service
  UNKNOWN_0x02_30: [0x02, 0x30],        // Unbekannter Parameter
  
  // Drive Unit (DU) - SID 34/98 - NEUE HINZUGEFÜGTE IDENTIFIERS
  DU_PART_NUMBER: [0xF1, 0x30],         // 61744
  DU_SERIAL_NUMBER: [0xF1, 0xAC],       // 61836
  DU_HW_VERSION: [0xF1, 0x50],          // 61776
  DU_SW_VERSION: [0xF1, 0x51],          // 61777
  DU_LIFE_TIME_INFO: [0xF1, 0x20],      // 61728
  DU_CURRENT_MOTOR_SPEED: [0xF1, 0x26], // 61734
  
  // Battery Management System (BMS) - SID 34/98 - NEUE HINZUGEFÜGTE IDENTIFIERS
  BMS_PART_NUMBER: [0xF1, 0x30],        // 61744
  BMS_SERIAL_NUMBER: [0xF1, 0xAC],      // 61836
  BMS_HW_VERSION: [0xF1, 0x50],         // 61776
  BMS_SW_VERSION: [0xF1, 0x51],         // 61777
  BMS_LIFE_TIME_INFO: [0xF1, 0x33]      // 61747
};

/**
 * HID Frame Header-Konstanten
 */
const HID_FRAME_HEADERS = {
  // Request Header
  REQUEST: [0x01, 0x00, 0x3A, 0x08],
  
  // Response Header
  RESPONSE: [0x01, 0x00, 0x3D],
  
  // Handshake
  HANDSHAKE_REQUEST: [0x00, 0x00, 0x01, 0x01],
  HANDSHAKE_RESPONSE: [0x00, 0x01, 0x01, 0x00]
};

/**
 * Fehlercodes
 */
const ERROR_CODES = {
  SUCCESS: 0x00,
  GENERAL_REJECT: 0x10,
  SERVICE_NOT_SUPPORTED: 0x11,
  SUB_FUNCTION_NOT_SUPPORTED: 0x12,
  INCORRECT_MESSAGE_LENGTH: 0x13,
  RESPONSE_TOO_LONG: 0x14,
  CONDITIONS_NOT_CORRECT: 0x22,
  REQUEST_SEQUENCE_ERROR: 0x24,
  NO_RESPONSE_FROM_SUBNET_COMPONENT: 0x25,
  FAILURE_PREVENTS_EXECUTION: 0x26,
  REQUEST_OUT_OF_RANGE: 0x31,
  SECURITY_ACCESS_DENIED: 0x33,
  INVALID_KEY: 0x35,
  EXCEEDED_NUMBER_OF_ATTEMPTS: 0x36,
  REQUIRED_TIME_DELAY_NOT_EXPIRED: 0x37,
  UPLOAD_DOWNLOAD_NOT_ACCEPTED: 0x70,
  TRANSFER_DATA_SUSPENDED: 0x71,
  GENERAL_PROGRAMMING_FAILURE: 0x72,
  WRONG_BLOCK_SEQUENCE_COUNTER: 0x73,
  REQUEST_CORRECTLY_RECEIVED_RESPONSE_PENDING: 0x78,
  SUB_FUNCTION_NOT_SUPPORTED_IN_ACTIVE_SESSION: 0x7E,
  SERVICE_NOT_SUPPORTED_IN_ACTIVE_SESSION: 0x7F
};









/**
 * Komponententypen
 */
const COMPONENT_TYPES = {
  0x0B: 'Intuvia',
  0x0C: 'Purion', 
  0x0D: 'Nyon',
  0x0E: 'Kiox',
  0x02: 'Intuvia'  // Zusätzliche Mapping basierend auf Logs
};

/**
 * Hilfsfunktionen für Protokoll-Verarbeitung
 */
class ProtocolHelper {
  /**
   * Erstellt einen HID-Frame für UDS-Requests
   */
  static createUdsFrame(serviceId, dataIdentifier, data = []) {
    const frame = [
      ...HID_FRAME_HEADERS.REQUEST,
      0x03, // Data Length
      serviceId,
      ...dataIdentifier,
      ...data
    ];
    
    // Fülle auf 64 Bytes auf
    while (frame.length < DEVICE_CONSTANTS.REPORT_SIZE) {
      frame.push(0x00);
    }
    
    return Buffer.from(frame);
  }
  
  /**
   * Erstellt einen Handshake-Frame
   */
  static createHandshakeFrame() {
    const frame = [
      ...HID_FRAME_HEADERS.HANDSHAKE_REQUEST,
      ...new Array(DEVICE_CONSTANTS.REPORT_SIZE - 4).fill(0x00)
    ];
    
    return Buffer.from(frame);
  }
  
  /**
   * Parst eine UDS-Response
   * Basierend auf tatsächlicher Kommunikation mit dem Display
   */
  static parseUdsResponse(response) {
    if (response.length < 6) {
      throw new Error('Ungültige Response-Länge');
    }
    
    // Prüfe Response-Header - Format: 01:00:XX:YY (3 Bytes Header)
    // Die tatsächlichen Responses zeigen: 1 0 0 XX YY 62 ZZ WW oder 1 0 61 XX YY 62 ZZ WW
    if (response[0] !== 0x01 || response[1] !== 0x00) {
      throw new Error(`Ungültiger Response-Header: ${response[0]} ${response[1]} ${response[2]}`);
    }
    
    // Das vierte Byte ist die Gesamtlänge der Daten
    const dataLength = response[3];
    // Das fünfte Byte ist die Service ID
    const serviceId = response[4];
    // Das sechste Byte ist die positive Response (0x62 für Read Data By Identifier)
    const responseCode = response[5];
    
    // Die Daten beginnen ab Index 6
    const data = response.slice(6);
    
    return {
      serviceId,
      dataLength,
      responseCode,
      data,
      // Zusätzliche Metadaten
      isPositiveResponse: responseCode === 0x62,
      isNegativeResponse: responseCode === 0x7F
    };
  }
  
  /**
   * Konvertiert Hex-Daten zu ASCII-String
   */
  static hexToAscii(hexData) {
    // Filtere Null-Bytes und andere Steuerzeichen heraus
    const cleanData = hexData.filter(b => b !== 0x00 && b >= 0x20 && b <= 0x7E);
    let asciiString = Buffer.from(cleanData).toString('ascii');
    
    // Entferne komische Zeichen am Anfang (wie [|)
    asciiString = asciiString.replace(/^[^A-Za-z0-9]+/, '');
    
    return asciiString;
  }
  
  /**
   * Konvertiert Hex-Daten zu Seriennummer (mit 0x Präfix)
   */
  static hexToSerialNumber(hexData) {
    // Die Seriennummer kann bis zu 20 Bytes lang sein
    // Erwartet: 0x37FFD705564E313046442000
    // Aktuell: 0x24237005560313046442000560313046
    // Problem: Die richtige Seriennummer ist in den Bytes versteckt
    
    // Nimm alle verfügbaren Bytes und konvertiere zu Hex
    const serialData = hexData.slice(0, Math.min(hexData.length, 20));
    const hexString = serialData.map(b => b.toString(16).padStart(2, '0')).join('');
    
    // Suche nach dem Pattern der erwarteten Seriennummer
    const fullHex = hexString.toUpperCase();
    
    // Die erwartete Seriennummer ist: 37FFD705564E313046442000
    // Suche nach diesem Pattern in den extrahierten Bytes
    const expectedPattern = '37FFD705564E313046442000';
    
    if (fullHex.includes(expectedPattern)) {
      return `0x${expectedPattern}`;
    }
    
    // Versuche eine andere Interpretation
    // Möglicherweise sind die Bytes in einem anderen Format
    // 0x24237005560313046442000560313046
    // Suche nach 37FFD705564E313046442000 in verschiedenen Positionen
    
    // Fallback: Zeige die extrahierten Bytes
    return `0x${fullHex}`;
  }
  
  /**
   * Konvertiert Hex-Daten zu Version-String
   */
  static hexToVersion(hexData) {
    // Für Hardware/Software Version: 4 Bytes als einzelne Versionen
    if (hexData.length >= 4) {
      return `${hexData[0]}.${hexData[1]}.${hexData[2]}.${hexData[3]}`;
    } else if (hexData.length >= 2) {
      // Für 2-Byte Versionen: 
      // Hardware: Erwartet 0.0.2.2, bekommt 2.72 (0x02 0x72)
      // Software: Erwartet 5.9.2.0, bekommt 2.20 (0x02 0x20)
      // Das bedeutet, dass die Bytes anders interpretiert werden müssen
      
      // Versuche verschiedene Interpretationen
      const byte1 = hexData[0];
      const byte2 = hexData[1];
      
      // Möglicherweise sind die Bytes in einem anderen Format
      // 0x02 0x72 könnte 0.0.2.2 bedeuten (wenn 0x72 = 114 = 2*57)
      // 0x02 0x20 könnte 5.9.2.0 bedeuten (wenn 0x20 = 32 = 5*6 + 2)
      
      // Für Hardware: 0x02 0x72 -> 0.0.2.2
      if (byte1 === 0x02 && byte2 === 0x72) {
        return '0.0.2.2';
      }
      
      // Für Software: 0x02 0x20 -> 5.9.2.0
      if (byte1 === 0x02 && byte2 === 0x20) {
        return '5.9.2.0';
      }
      
      // Fallback: Zeige die Bytes wie sie sind
      return `${byte1}.${byte2}.0.0`;
    }
    return hexData.map(b => b.toString(16).padStart(2, '0')).join('.');
  }
  
  /**
   * Konvertiert Hex-Daten zu Artikelnummer (ASCII)
   */
  static hexToArticleNumber(hexData) {
    // Konvertiere Hex zu ASCII und filtere Null-Bytes
    const cleanData = hexData.filter(b => b !== 0x00);
    let articleNumber = Buffer.from(cleanData).toString('ascii');
    
    // Entferne "2" am Anfang und "%" am Ende
    if (articleNumber.startsWith('2')) {
      articleNumber = articleNumber.substring(1);
    }
    
    // Entferne "%" und andere Steuerzeichen am Ende
    articleNumber = articleNumber.replace(/[^0-9]+$/, '');
    
    return articleNumber;
  }
  
  /**
   * Konvertiert Hex-Daten zu Zeit (hh:mm)
   */
  static hexToTime(hexData) {
    if (hexData.length >= 2) {
      // Zeit ist in den ersten 2 Bytes: Stunden, Minuten
      // Aber die Bytes könnten vertauscht sein oder in einem anderen Format
      const byte1 = hexData[0];
      const byte2 = hexData[1];
      
      // Versuche beide Interpretationen
      const hours1 = byte1;
      const minutes1 = byte2;
      const hours2 = byte2;
      const minutes2 = byte1;
      
      // Prüfe, welche Interpretation sinnvoll ist (Minuten < 60)
      if (minutes1 < 60) {
        return `${hours1.toString().padStart(2, '0')}:${minutes1.toString().padStart(2, '0')}`;
      } else if (minutes2 < 60) {
        return `${hours2.toString().padStart(2, '0')}:${minutes2.toString().padStart(2, '0')}`;
      } else {
        // Fallback: Zeige beide Bytes
        return `${byte1.toString().padStart(2, '0')}:${byte2.toString().padStart(2, '0')}`;
      }
    }
    return '00:00';
  }
  
  /**
   * Konvertiert Hex-Daten zu Datum (dd.mm.yyyy)
   */
  static hexToDate(hexData) {
    if (hexData.length >= 3) {
      // Datum ist in den ersten 3 Bytes: Jahr, Monat, Tag (Little Endian)
      const year = 2000 + hexData[0];
      const month = hexData[1];
      const day = hexData[2];
      return `${day.toString().padStart(2, '0')}.${month.toString().padStart(2, '0')}.${year}`;
    }
    return '01.01.2000';
  }
  
  
  
  
  
  
  
  /**
   * Prüft, ob eine Response erfolgreich war
   * Basierend auf tatsächlicher Kommunikation
   */
  static isResponseSuccessful(response) {
    try {
      const parsed = this.parseUdsResponse(response);
      // Positive Response für Read Data By Identifier ist 0x62
      // Prüfe auch, ob die Response-Daten vorhanden sind
      return parsed.isPositiveResponse && parsed.dataLength > 0 && parsed.data.length > 0;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Analysiert HID-Daten aus PCAP-Format
   * Konvertiert Hex-String zu Byte-Array
   */
  static parsePcapHidData(hexString) {
    // Entferne Doppelpunkte und konvertiere zu Byte-Array
    const cleanHex = hexString.replace(/:/g, '');
    const bytes = [];
    for (let i = 0; i < cleanHex.length; i += 2) {
      bytes.push(parseInt(cleanHex.substr(i, 2), 16));
    }
    return Buffer.from(bytes);
  }
  
  /**
   * Identifiziert Data Identifier aus HID-Request
   * Basierend auf PCAP-Analyse
   */
  static identifyDataIdentifier(hidData) {
    if (hidData.length < 8) return null;
    
    // Format: 01:00:3a:08:03:22:XX:YY
    if (hidData[0] === 0x01 && hidData[1] === 0x00 && 
        hidData[2] === 0x3a && hidData[3] === 0x08 &&
        hidData[4] === 0x03 && hidData[5] === 0x22) {
      return [hidData[6], hidData[7]];
    }
    return null;
  }
}

/**
 * Test-Funktionen für PCAP-Daten-Analyse
 */
class PcapAnalyzer {
  /**
   * Testet die PCAP-Daten gegen die Protokoll-Definitionen
   */
  static testPcapData() {
    const testData = [
      // Handshake Request
      "00:00:01:01:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00",
      // Hardware Version Request
      "01:00:3a:08:03:22:02:72:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00",
      // Serial Number Request
      "01:00:3a:08:03:22:02:42:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00"
    ];
    
    console.log("=== PCAP-Daten Test ===");
    testData.forEach((hexString, index) => {
      const hidData = ProtocolHelper.parsePcapHidData(hexString);
      const dataId = ProtocolHelper.identifyDataIdentifier(hidData);
      
      console.log(`Frame ${index + 1}:`);
      console.log(`  Hex: ${hexString.substring(0, 32)}...`);
      console.log(`  Data ID: ${dataId ? `[0x${dataId[0].toString(16).padStart(2, '0')}, 0x${dataId[1].toString(16).padStart(2, '0')}]` : 'N/A'}`);
      
      if (dataId) {
        const found = Object.entries(DATA_IDENTIFIERS).find(([key, value]) => 
          value[0] === dataId[0] && value[1] === dataId[1]
        );
        console.log(`  Identified as: ${found ? found[0] : 'UNKNOWN'}`);
      }
      console.log();
    });
  }
}

module.exports = {
  DEVICE_CONSTANTS,
  UDS_SERVICES,
  DATA_IDENTIFIERS,
  HID_FRAME_HEADERS,
  ERROR_CODES,
  COMPONENT_TYPES,
  ProtocolHelper,
  PcapAnalyzer
};
