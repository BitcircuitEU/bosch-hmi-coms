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
 */
const DATA_IDENTIFIERS = {
  // System Information
  SERIAL_NUMBER: [0x02, 0x42],
  HARDWARE_VERSION: [0x02, 0x21],
  SOFTWARE_VERSION: [0x02, 0x20],
  COMPONENT_TYPE: [0x02, 0x60],
  HMI_PART_NUMBER: [0x02, 0x32],
  
  // System State
  PRESENT_DATE_TIME: [0x02, 0x3A],
  CURRENT_TIME: [0x02, 0x40],
  CURRENT_DATE: [0x02, 0x3A],
  
  // Bosch specific
  BOSCH_PRODUCT_CODE: [0x5B, 0x7C],
  
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
   */
  static parseUdsResponse(response) {
    if (response.length < 6) {
      throw new Error('Ungültige Response-Länge');
    }
    
    // Prüfe Response-Header - anpassen an tatsächliches Format
    if (response[0] !== 0x01 || response[1] !== 0x00) {
      throw new Error('Ungültiger Response-Header');
    }
    
    // Das dritte Byte ist die Länge, das vierte Byte ist die Service ID
    const dataLength = response[2];
    const serviceId = response[3];
    
    // Die Daten beginnen nach Header (3 Bytes) und Länge/Service ID (2 Bytes)
    // Also ab Index 5, aber nimm nur die relevanten Daten
    // Für Version-Daten sind die letzten 4 Bytes relevant
    const data = response.slice(5);
    
    return {
      serviceId,
      dataLength,
      data
    };
  }
  
  /**
   * Konvertiert Hex-Daten zu ASCII-String
   */
  static hexToAscii(hexData) {
    // Filtere Null-Bytes und andere Steuerzeichen heraus
    const cleanData = hexData.filter(b => b !== 0x00 && b >= 0x20 && b <= 0x7E);
    return Buffer.from(cleanData).toString('ascii');
  }
  
  /**
   * Konvertiert Hex-Daten zu Seriennummer (mit 0x Präfix)
   */
  static hexToSerialNumber(hexData) {
    // Die Seriennummer ist in den ersten 12 Bytes (ohne Duplikate)
    // Response: 62024237FFD705564E31304644200000
    // Seriennummer: 37FFD705564E313046442000
    const serialData = hexData.slice(0, 12);
    const hexString = serialData.map(b => b.toString(16).padStart(2, '0')).join('');
    return `0x${hexString.toUpperCase()}`;
  }
  
  /**
   * Konvertiert Hex-Daten zu Version-String
   */
  static hexToVersion(hexData) {
    // Für Hardware/Software Version: 4 Bytes als einzelne Versionen
    if (hexData.length >= 4) {
      return `${hexData[0]}.${hexData[1]}.${hexData[2]}.${hexData[3]}`;
    }
    return hexData.map(b => b.toString(16).padStart(2, '0')).join('.');
  }
  
  /**
   * Konvertiert Hex-Daten zu Artikelnummer (ASCII)
   */
  static hexToArticleNumber(hexData) {
    // Konvertiere Hex zu ASCII und filtere Null-Bytes
    const cleanData = hexData.filter(b => b !== 0x00);
    return Buffer.from(cleanData).toString('ascii');
  }
  
  /**
   * Konvertiert Hex-Daten zu Zeit (hh:mm)
   */
  static hexToTime(hexData) {
    if (hexData.length >= 2) {
      // Zeit ist in den ersten 2 Bytes: Stunden, Minuten
      const hours = hexData[0];
      const minutes = hexData[1];
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }
    return '00:00';
  }
  
  /**
   * Konvertiert Hex-Daten zu Datum (dd.mm.yyyy)
   */
  static hexToDate(hexData) {
    if (hexData.length >= 3) {
      // Datum ist in den ersten 3 Bytes: Tag, Monat, Jahr
      const day = hexData[0];
      const month = hexData[1];
      const year = 2000 + hexData[2];
      return `${day.toString().padStart(2, '0')}.${month.toString().padStart(2, '0')}.${year}`;
    }
    return '01.01.2000';
  }
  
  
  
  
  
  
  
  /**
   * Prüft, ob eine Response erfolgreich war
   */
  static isResponseSuccessful(response) {
    try {
      const parsed = this.parseUdsResponse(response);
      // Positive Response für Read Data By Identifier ist 0x62
      // Aber das Display scheint andere Service-IDs zu verwenden
      // Prüfe, ob es eine gültige Response ist (nicht 0x7F = negative response)
      return parsed.serviceId !== 0x7F && parsed.dataLength > 0;
    } catch (error) {
      return false;
    }
  }
}

module.exports = {
  DEVICE_CONSTANTS,
  UDS_SERVICES,
  DATA_IDENTIFIERS,
  HID_FRAME_HEADERS,
  ERROR_CODES,
  COMPONENT_TYPES,
  ProtocolHelper
};
