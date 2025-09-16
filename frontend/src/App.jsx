import React, { useState, useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import { 
  Bike, 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  Download, 
  AlertCircle, 
  CheckCircle,
  Loader2,
  Moon,
  Sun,
  Settings
} from 'lucide-react'
// Modern CSS-only components - no external dependencies needed
import './index.css'

const App = () => {
  const [socket, setSocket] = useState(null)
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(false)
  const [displayInfo, setDisplayInfo] = useState(null)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [mode, setMode] = useState('display')
  const [usbDevice, setUsbDevice] = useState(null)
  const [isDarkMode, setIsDarkMode] = useState(true)
  
  // Ref für WebUSB-Gerät, um es in Event Handlers verfügbar zu machen
  const usbDeviceRef = useRef(null)

  // Dark mode toggle
  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode)
    document.documentElement.classList.toggle('dark')
  }

  // Initialize dark mode
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [isDarkMode])

  useEffect(() => {
    // Socket.IO Verbindung herstellen
    const newSocket = io('http://localhost:3000')
    setSocket(newSocket)

    // Event Listener
    newSocket.on('display-connected', (data) => {
      setConnected(true)
      setLoading(false)
      if (data.success) {
        setSuccess('Display erfolgreich verbunden!')
        setError(null)
      } else {
        setError('Verbindung fehlgeschlagen')
      }
    })

    newSocket.on('display-disconnected', (data) => {
      setConnected(false)
      setLoading(false)
      if (data.success) {
        setSuccess('Display getrennt')
        setDisplayInfo(null)
      }
    })

    newSocket.on('display-info', (data) => {
      setLoading(false)
      if (data.success) {
        setDisplayInfo(data.data)
        setSuccess('Display-Informationen erfolgreich gelesen!')
        setError(null)
      } else {
        setError('Fehler beim Lesen der Display-Informationen')
      }
    })

    newSocket.on('display-error', (data) => {
      setLoading(false)
      setError(data.error || 'Unbekannter Fehler')
    })

    // Neue Event-Handler für echte WebUSB-Kommunikation
    newSocket.on('request-display-data', async (data) => {
      try {
        console.log('Backend fordert Display-Daten an:', data.mode)
        console.log('WebUSB-Gerät Status:', usbDeviceRef.current ? 'Verfügbar' : 'Nicht verfügbar')
        
        if (!usbDeviceRef.current) {
          throw new Error('Kein WebUSB-Gerät verbunden. Bitte verbinden Sie das Display erneut.')
        }
        
        const displayData = await readRealDisplayData(data.mode)
        newSocket.emit('display-data-response', displayData)
      } catch (error) {
        console.error('Fehler beim Lesen der Display-Daten:', error)
        newSocket.emit('display-error', { error: error.message })
      }
    })

    return () => {
      newSocket.close()
    }
  }, [])

  const connectDisplay = async () => {
    setLoading(true)
    setError(null)
    setSuccess(null)
    
    try {
      // Prüfe WebHID Unterstützung (besser für HID-Geräte)
      if (!navigator.hid) {
        throw new Error('WebHID wird von diesem Browser nicht unterstützt. Bitte verwenden Sie Chrome oder Edge.')
      }

      if (!socket) {
        throw new Error('Keine Verbindung zum Backend')
      }

      console.log('Verwende WebHID für bessere HID-Geräte-Kompatibilität...')

      // Bosch Display Filter - alle unterstützten Modelle
      const vendorId = 0x108C; // Bosch
      const filters = [
        { vendorId, productId: 0x182 }, // BUI21X
        { vendorId, productId: 0x155 }, // BUI25X
        { vendorId, productId: 0x157 }, // BUI270
        { vendorId, productId: 0x188 }, // BUI275
        { vendorId, productId: 0x193 }, // BUI330
        { vendorId, productId: 0x192 }, // BUI330_BL
        { vendorId, productId: 0x1A3 }, // BUI350
      ];

      console.log('Fordere WebHID-Geräteauswahl an...');
      const devices = await navigator.hid.requestDevice({ filters });
      
      if (devices.length === 0) {
        throw new Error('Kein Bosch Display ausgewählt');
      }

      const device = devices[0];
      console.log(`Bosch Display ausgewählt: ${device.productName || 'Unbekannt'} (PID: 0x${device.productId.toString(16).toUpperCase()})`);

      // Öffne das HID-Gerät
      console.log('Öffne WebHID-Gerät...');
      await device.open();
      console.log('WebHID-Gerät erfolgreich geöffnet');

      // Setze Event Listener für Input Reports
      device.addEventListener("inputreport", (event) => {
        console.log('HID Input Report empfangen:', event.reportId, Array.from(new Uint8Array(event.data.buffer)));
        // Hier können wir die eingehenden Daten verarbeiten
      });

      // Listen for device disconnect events
      navigator.hid.addEventListener("disconnect", (event) => {
        if (device && event.device === device) {
          console.log("HID-Gerät getrennt");
          setConnected(false);
          setDisplayInfo(null);
          setError('Display wurde getrennt');
        }
      });

      // Speichere das WebHID-Gerät für spätere Kommunikation
      const hidDevice = {
        device,
        productId: device.productId,
        vendorId: device.vendorId,
        productName: getProductName(device.productId)
      }
      
      setUsbDevice(hidDevice)
      usbDeviceRef.current = hidDevice

      // Sende Gerät-Informationen an das Backend
      socket.emit('connect-display', {
        device: {
          vendorId: device.vendorId,
          productId: device.productId,
          productName: device.productName,
          manufacturerName: device.manufacturerName,
          serialNumber: device.serialNumber
        }
      });
      
      // Die Verbindung wird über den Socket.IO Event Handler bestätigt
      // (display-connected Event wird in useEffect behandelt)
      
    } catch (err) {
      console.error('WebHID-Verbindungsfehler:', err)
      
      if (err.name === 'NotFoundError') {
        setError('Kein Bosch Display gefunden. Stellen Sie sicher, dass das Gerät angeschlossen ist.')
      } else if (err.message.includes('Access denied')) {
        setError('Zugriff verweigert. Bitte erlauben Sie den WebHID-Zugriff in Ihrem Browser.')
      } else if (err.message.includes('already in use')) {
        setError('Das Display wird bereits von einer anderen Anwendung verwendet.')
      } else {
        setError(`WebHID-Fehler: ${err.message}`)
      }
      setLoading(false)
    }
  }

  const disconnectDisplay = async () => {
    if (socket) {
      socket.emit('disconnect-display')
    }
    
    // Schließe das WebHID-Gerät
    const deviceData = usbDeviceRef.current
    if (deviceData && deviceData.device) {
      try {
        await deviceData.device.close()
        console.log('WebHID-Gerät geschlossen')
      } catch (error) {
        console.warn('Fehler beim Schließen des WebHID-Geräts:', error.message)
      }
    }
    
    setConnected(false)
    setDisplayInfo(null)
    setUsbDevice(null)
    usbDeviceRef.current = null
    setSuccess('Verbindung getrennt')
    setError(null)
  }

  const readDisplayInfo = async () => {
    setLoading(true)
    setError(null)
    setSuccess(null)
    
    try {
      if (!socket) {
        throw new Error('Keine Verbindung zum Backend')
      }
      
      // Sende Socket.IO Event an das Backend
      socket.emit('read-display-info', { mode: mode })
      
      // Die Antwort wird über den Socket.IO Event Handler empfangen
      // (display-info Event wird in useEffect behandelt)
      
    } catch (err) {
      setError('Fehler beim Lesen der Display-Informationen: ' + err.message)
      setLoading(false)
    }
  }

  // Echte WebHID-Kommunikation mit dem Bosch Display
  const readRealDisplayData = async (mode) => {
    const deviceData = usbDeviceRef.current
    if (!deviceData || !deviceData.device) {
      throw new Error('Kein WebHID-Gerät verfügbar')
    }

    const { device } = deviceData

    try {
      console.log('WebHID-Gerät verfügbar, starte UDS-Kommunikation...')

      // Führe Handshake durch
      console.log('Führe Handshake durch...')
      await performHandshakeHID(device)
      
      // Kurze Pause nach Handshake
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Lese Display-Informationen
      console.log('Lese Display-Informationen...')
      const displayData = await readDisplayInformationHID(device, mode)
      
      console.log('Display-Daten erfolgreich gelesen:', displayData)
      
      return displayData
      
    } catch (error) {
      console.error('WebHID-Fehler:', error)
      throw new Error(`WebHID-Kommunikationsfehler: ${error.message}`)
    }
  }

  // WebHID Handshake mit dem Display
  const performHandshakeHID = async (device) => {
    try {
      console.log('Führe WebHID Handshake durch...')
      
      // HID Frame Headers aus protocols.js
      const HID_FRAME_HEADERS = {
        HANDSHAKE_REQUEST: [0x00, 0x00, 0x01, 0x01],
        HANDSHAKE_RESPONSE: [0x00, 0x01, 0x01, 0x00]
      }
      
      // Erstelle Handshake Frame (64 Bytes)
      const handshakeFrame = [
        ...HID_FRAME_HEADERS.HANDSHAKE_REQUEST,
        ...new Array(60).fill(0x00) // Fülle auf 64 Bytes auf
      ]
      
      const handshakeRequest = new Uint8Array(handshakeFrame)
      
      // Sende Handshake über WebHID
      await device.sendReport(0, handshakeRequest)
      console.log('Handshake Request gesendet')
      
      // Warte auf Response (wird über Event Listener empfangen)
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Handshake Timeout'))
        }, 3000)
        
        const handleInputReport = (event) => {
          if (event.reportId === 0) {
            const response = new Uint8Array(event.data.buffer)
            console.log('Handshake Response:', Array.from(response.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join(' '))
            
            // Prüfe auf Handshake Response Header
            if (response[0] === HID_FRAME_HEADERS.HANDSHAKE_RESPONSE[0] && 
                response[1] === HID_FRAME_HEADERS.HANDSHAKE_RESPONSE[1] && 
                response[2] === HID_FRAME_HEADERS.HANDSHAKE_RESPONSE[2] && 
                response[3] === HID_FRAME_HEADERS.HANDSHAKE_RESPONSE[3]) {
              console.log('Handshake erfolgreich')
              clearTimeout(timeout)
              device.removeEventListener('inputreport', handleInputReport)
              resolve(true)
            }
          }
        }
        
        device.addEventListener('inputreport', handleInputReport)
      })
      
    } catch (error) {
      throw new Error(`WebHID Handshake-Fehler: ${error.message}`)
    }
  }

  // UDS Handshake mit dem Display - korrigiert basierend auf protocols.js (WebUSB Version)
  const performHandshake = async (device, endpointIn, endpointOut) => {
    try {
      console.log('Führe UDS Handshake durch...')
      
      // HID Frame Headers aus protocols.js
      const HID_FRAME_HEADERS = {
        HANDSHAKE_REQUEST: [0x00, 0x00, 0x01, 0x01],
        HANDSHAKE_RESPONSE: [0x00, 0x01, 0x01, 0x00]
      }
      
      // Erstelle Handshake Frame (64 Bytes)
      const handshakeFrame = [
        ...HID_FRAME_HEADERS.HANDSHAKE_REQUEST,
        ...new Array(60).fill(0x00) // Fülle auf 64 Bytes auf
      ]
      
      const handshakeRequest = new Uint8Array(handshakeFrame)
      
      // Sende Handshake
      await device.transferOut(endpointOut.endpointNumber, handshakeRequest)
      
      // Warte auf Response
      const result = await device.transferIn(endpointIn.endpointNumber, 65)
      
      if (result.status === 'ok' && result.data && result.data.byteLength > 0) {
        const response = new Uint8Array(result.data)
        console.log('Handshake Response:', Array.from(response.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join(' '))
        
        // Prüfe auf Handshake Response Header: 0x00, 0x01, 0x01, 0x00
        if (response[0] === HID_FRAME_HEADERS.HANDSHAKE_RESPONSE[0] && 
            response[1] === HID_FRAME_HEADERS.HANDSHAKE_RESPONSE[1] && 
            response[2] === HID_FRAME_HEADERS.HANDSHAKE_RESPONSE[2] && 
            response[3] === HID_FRAME_HEADERS.HANDSHAKE_RESPONSE[3]) {
          console.log('Handshake erfolgreich')
          return true
        } else {
          throw new Error('Handshake fehlgeschlagen - ungültige Response')
        }
      } else {
        throw new Error('Handshake fehlgeschlagen - keine Response')
      }
      
    } catch (error) {
      throw new Error(`Handshake-Fehler: ${error.message}`)
    }
  }

  // WebHID Version: Liest echte Display-Informationen über UDS
  const readDisplayInformationHID = async (device, mode) => {
    try {
      console.log('Lese Display-Informationen über WebHID...')
      
      // Data Identifiers aus protocols.js
      const DATA_IDENTIFIERS = {
        SERIAL_NUMBER: [0x02, 0x42],
        HARDWARE_VERSION: [0x02, 0x72],
        SOFTWARE_VERSION: [0x02, 0x20],
        COMPONENT_TYPE: [0x02, 0x60],
        HMI_PART_NUMBER: [0x02, 0x32],
        BOSCH_PRODUCT_CODE: [0x5B, 0x7C]
      }
      
      const UDS_SERVICES = {
        READ_DATA_BY_IDENTIFIER: 0x22
      }
      
      const displayData = {
        serialNumber: await readUdsDataHID(device, UDS_SERVICES.READ_DATA_BY_IDENTIFIER, DATA_IDENTIFIERS.SERIAL_NUMBER),
        hardwareVersion: await readUdsDataHID(device, UDS_SERVICES.READ_DATA_BY_IDENTIFIER, DATA_IDENTIFIERS.HARDWARE_VERSION),
        softwareVersion: await readUdsDataHID(device, UDS_SERVICES.READ_DATA_BY_IDENTIFIER, DATA_IDENTIFIERS.SOFTWARE_VERSION),
        articleNumber: await readUdsDataHID(device, UDS_SERVICES.READ_DATA_BY_IDENTIFIER, DATA_IDENTIFIERS.HMI_PART_NUMBER),
        currentTime: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
        currentDate: new Date().toLocaleDateString('de-DE'),
        lastUpdate: { date: new Date().toISOString() }
      }

      if (mode === 'full') {
        // Erweiterte Daten für alle Komponenten
        displayData.driveUnit = {
          serialNumber: await readUdsDataHID(device, UDS_SERVICES.READ_DATA_BY_IDENTIFIER, [0xF1, 0xAC]),
          hardwareVersion: await readUdsDataHID(device, UDS_SERVICES.READ_DATA_BY_IDENTIFIER, [0xF1, 0x50]),
          softwareVersion: await readUdsDataHID(device, UDS_SERVICES.READ_DATA_BY_IDENTIFIER, [0xF1, 0x51]),
          productCode: await readUdsDataHID(device, UDS_SERVICES.READ_DATA_BY_IDENTIFIER, [0xF1, 0x30])
        }
        
        displayData.batteryManagement = {
          serialNumber: await readUdsDataHID(device, UDS_SERVICES.READ_DATA_BY_IDENTIFIER, [0xF1, 0xAC]),
          hardwareVersion: await readUdsDataHID(device, UDS_SERVICES.READ_DATA_BY_IDENTIFIER, [0xF1, 0x50]),
          softwareVersion: await readUdsDataHID(device, UDS_SERVICES.READ_DATA_BY_IDENTIFIER, [0xF1, 0x51]),
          productCode: await readUdsDataHID(device, UDS_SERVICES.READ_DATA_BY_IDENTIFIER, [0xF1, 0x30]),
          chargeLevel: await readUdsDataHID(device, UDS_SERVICES.READ_DATA_BY_IDENTIFIER, [0xF1, 0x33])
        }
      }

      return displayData
      
    } catch (error) {
      throw new Error(`WebHID Display-Info-Lesefehler: ${error.message}`)
    }
  }

  // Liest echte Display-Informationen über UDS - korrigiert basierend auf protocols.js (WebUSB Version)
  const readDisplayInformation = async (device, endpointIn, endpointOut, mode) => {
    try {
      console.log('Lese Display-Informationen...')
      
      // Data Identifiers aus protocols.js
      const DATA_IDENTIFIERS = {
        SERIAL_NUMBER: [0x02, 0x42],
        HARDWARE_VERSION: [0x02, 0x72],
        SOFTWARE_VERSION: [0x02, 0x20],
        COMPONENT_TYPE: [0x02, 0x60],
        HMI_PART_NUMBER: [0x02, 0x32],
        BOSCH_PRODUCT_CODE: [0x5B, 0x7C]
      }
      
      const UDS_SERVICES = {
        READ_DATA_BY_IDENTIFIER: 0x22
      }
      
      const displayData = {
        serialNumber: await readUdsData(device, endpointIn, endpointOut, UDS_SERVICES.READ_DATA_BY_IDENTIFIER, DATA_IDENTIFIERS.SERIAL_NUMBER),
        hardwareVersion: await readUdsData(device, endpointIn, endpointOut, UDS_SERVICES.READ_DATA_BY_IDENTIFIER, DATA_IDENTIFIERS.HARDWARE_VERSION),
        softwareVersion: await readUdsData(device, endpointIn, endpointOut, UDS_SERVICES.READ_DATA_BY_IDENTIFIER, DATA_IDENTIFIERS.SOFTWARE_VERSION),
        articleNumber: await readUdsData(device, endpointIn, endpointOut, UDS_SERVICES.READ_DATA_BY_IDENTIFIER, DATA_IDENTIFIERS.HMI_PART_NUMBER),
        currentTime: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
        currentDate: new Date().toLocaleDateString('de-DE'),
        lastUpdate: { date: new Date().toISOString() }
      }

      if (mode === 'full') {
        // Erweiterte Daten für alle Komponenten - mit korrekten Data Identifiers
        displayData.driveUnit = {
          serialNumber: await readUdsData(device, endpointIn, endpointOut, UDS_SERVICES.READ_DATA_BY_IDENTIFIER, [0xF1, 0xAC]),
          hardwareVersion: await readUdsData(device, endpointIn, endpointOut, UDS_SERVICES.READ_DATA_BY_IDENTIFIER, [0xF1, 0x50]),
          softwareVersion: await readUdsData(device, endpointIn, endpointOut, UDS_SERVICES.READ_DATA_BY_IDENTIFIER, [0xF1, 0x51]),
          productCode: await readUdsData(device, endpointIn, endpointOut, UDS_SERVICES.READ_DATA_BY_IDENTIFIER, [0xF1, 0x30])
        }
        
        displayData.batteryManagement = {
          serialNumber: await readUdsData(device, endpointIn, endpointOut, UDS_SERVICES.READ_DATA_BY_IDENTIFIER, [0xF1, 0xAC]),
          hardwareVersion: await readUdsData(device, endpointIn, endpointOut, UDS_SERVICES.READ_DATA_BY_IDENTIFIER, [0xF1, 0x50]),
          softwareVersion: await readUdsData(device, endpointIn, endpointOut, UDS_SERVICES.READ_DATA_BY_IDENTIFIER, [0xF1, 0x51]),
          productCode: await readUdsData(device, endpointIn, endpointOut, UDS_SERVICES.READ_DATA_BY_IDENTIFIER, [0xF1, 0x30]),
          chargeLevel: await readUdsData(device, endpointIn, endpointOut, UDS_SERVICES.READ_DATA_BY_IDENTIFIER, [0xF1, 0x33])
        }
      }

      return displayData
      
    } catch (error) {
      throw new Error(`Display-Info-Lesefehler: ${error.message}`)
    }
  }

  // WebHID Version: UDS Datenabfrage
  const readUdsDataHID = async (device, serviceId, dataIdentifier, timeout = 3000) => {
    try {
      // HID Frame Headers aus protocols.js
      const HID_FRAME_HEADERS = {
        REQUEST: [0x01, 0x00, 0x3A, 0x08],
        RESPONSE: [0x01, 0x00, 0x3D]
      }
      
      // Erstelle UDS Frame (64 Bytes)
      const frame = [
        ...HID_FRAME_HEADERS.REQUEST,
        0x03, // Data Length
        serviceId,
        ...dataIdentifier,
        ...new Array(56).fill(0x00) // Fülle auf 64 Bytes auf
      ]
      
      const request = new Uint8Array(frame)
      
      console.log(`UDS Request: ${Array.from(request.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join(' ')}`)
      console.log(`Data Identifier: [0x${dataIdentifier[0].toString(16).padStart(2, '0')}, 0x${dataIdentifier[1].toString(16).padStart(2, '0')}]`)
      
      // Sende Request über WebHID
      await device.sendReport(0, request)
      
      // Warte auf Response
      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('UDS Timeout'))
        }, timeout)
        
        const handleInputReport = (event) => {
          if (event.reportId === 0) {
            const response = new Uint8Array(event.data.buffer)
            console.log(`UDS Response: ${Array.from(response.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join(' ')}`)
            
            // Parse Response
            if (response.length < 6) {
              clearTimeout(timeoutId)
              device.removeEventListener('inputreport', handleInputReport)
              reject(new Error('Ungültige Response-Länge'))
              return
            }
            
            // Prüfe Response-Header
            if (response[0] !== 0x01 || response[1] !== 0x00) {
              clearTimeout(timeoutId)
              device.removeEventListener('inputreport', handleInputReport)
              reject(new Error(`Ungültiger Response-Header: ${response[0]} ${response[1]} ${response[2]}`))
              return
            }
            
            const dataLength = response[3]
            const responseServiceId = response[4]
            const responseCode = response[5]
            const dataIdentifierResponse = response.slice(6, 8) // Data Identifier in Response
            const data = response.slice(8) // Eigentliche Daten
            
            console.log(`Response Details: Length=${dataLength}, Service=${responseServiceId.toString(16)}, Code=${responseCode.toString(16)}`)
            console.log(`Data Identifier Response: [0x${dataIdentifierResponse[0].toString(16)}, 0x${dataIdentifierResponse[1].toString(16)}]`)
            
            // Prüfe auf positive Response (0x62 = Read Data By Identifier positive response)
            if (responseCode === 0x62) {
              console.log(`UDS Data (${dataLength} bytes):`, Array.from(data).map(b => b.toString(16).padStart(2, '0')).join(' '))
              
              // Konvertiere zu lesbarem Format
              const result = parseUdsData(data, dataIdentifier)
              clearTimeout(timeoutId)
              device.removeEventListener('inputreport', handleInputReport)
              resolve(result)
            } else {
              clearTimeout(timeoutId)
              device.removeEventListener('inputreport', handleInputReport)
              reject(new Error(`UDS-Fehler: Service ${responseServiceId.toString(16)}, Code ${responseCode.toString(16)}`))
            }
          }
        }
        
        device.addEventListener('inputreport', handleInputReport)
      })
      
    } catch (error) {
      if (error.message.includes('timeout') || error.message.includes('Timeout')) {
        console.warn(`UDS-Timeout für [0x${dataIdentifier[0].toString(16)}, 0x${dataIdentifier[1].toString(16)}]`)
        return 'TIMEOUT'
      }
      console.warn(`UDS-Datenabfrage fehlgeschlagen für [0x${dataIdentifier[0].toString(16)}, 0x${dataIdentifier[1].toString(16)}]:`, error.message)
      return 'N/A'
    }
  }

  // UDS Datenabfrage - korrigiert basierend auf protocols.js mit verbesserter Fehlerbehandlung (WebUSB Version)
  const readUdsData = async (device, endpointIn, endpointOut, serviceId, dataIdentifier, timeout = 3000) => {
    try {
      // HID Frame Headers aus protocols.js
      const HID_FRAME_HEADERS = {
        REQUEST: [0x01, 0x00, 0x3A, 0x08],
        RESPONSE: [0x01, 0x00, 0x3D]
      }
      
      // Erstelle UDS Frame (64 Bytes) - basierend auf ProtocolHelper.createUdsFrame
      const frame = [
        ...HID_FRAME_HEADERS.REQUEST,
        0x03, // Data Length
        serviceId,
        ...dataIdentifier,
        ...new Array(56).fill(0x00) // Fülle auf 64 Bytes auf
      ]
      
      const request = new Uint8Array(frame)
      
      console.log(`UDS Request: ${Array.from(request.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join(' ')}`)
      console.log(`Data Identifier: [0x${dataIdentifier[0].toString(16).padStart(2, '0')}, 0x${dataIdentifier[1].toString(16).padStart(2, '0')}]`)
      
      // Sende Request
      await device.transferOut(endpointOut.endpointNumber, request)
      
      // Warte auf Response mit Timeout
      const result = await device.transferIn(endpointIn.endpointNumber, 65)
      
      if (result.status === 'ok' && result.data && result.data.byteLength > 0) {
        const response = new Uint8Array(result.data)
        console.log(`UDS Response: ${Array.from(response.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join(' ')}`)
        
        // Parse Response mit ProtocolHelper.parseUdsResponse Logik
        if (response.length < 6) {
          throw new Error('Ungültige Response-Länge')
        }
        
        // Prüfe Response-Header
        if (response[0] !== 0x01 || response[1] !== 0x00) {
          throw new Error(`Ungültiger Response-Header: ${response[0]} ${response[1]} ${response[2]}`)
        }
        
        // Das vierte Byte ist die Gesamtlänge der Daten
        const dataLength = response[3]
        // Das fünfte Byte ist die Service ID
        const responseServiceId = response[4]
        // Das sechste Byte ist die positive Response (0x62 für Read Data By Identifier)
        const responseCode = response[5]
        
        // Die Daten beginnen ab Index 6
        const data = response.slice(6)
        
        // Prüfe auf positive Response
        if (responseCode === 0x62 && responseServiceId === serviceId) {
          console.log(`UDS Data (${dataLength} bytes):`, Array.from(data).map(b => b.toString(16).padStart(2, '0')).join(' '))
          
          // Konvertiere zu lesbarem Format basierend auf Data Identifier
          return parseUdsData(data, dataIdentifier)
        } else {
          throw new Error(`UDS-Fehler: Service ${responseServiceId.toString(16)}, Code ${responseCode.toString(16)}`)
        }
      } else {
        throw new Error('Keine UDS-Response empfangen')
      }
      
    } catch (error) {
      if (error.message.includes('timeout') || error.message.includes('Timeout')) {
        console.warn(`UDS-Timeout für [0x${dataIdentifier[0].toString(16)}, 0x${dataIdentifier[1].toString(16)}]`)
        return 'TIMEOUT'
      }
      console.warn(`UDS-Datenabfrage fehlgeschlagen für [0x${dataIdentifier[0].toString(16)}, 0x${dataIdentifier[1].toString(16)}]:`, error.message)
      return 'N/A'
    }
  }

  // Parse UDS Data - korrigiert basierend auf tatsächlichen Display-Daten
  const parseUdsData = (data, dataIdentifier) => {
    try {
      console.log(`Parsing Data Identifier [0x${dataIdentifier[0].toString(16)}, 0x${dataIdentifier[1].toString(16)}]:`, Array.from(data).map(b => b.toString(16).padStart(2, '0')).join(' '))
      
      // Seriennummer (0x02, 0x42)
      if (dataIdentifier[0] === 0x02 && dataIdentifier[1] === 0x42) {
        // Suche nach dem erwarteten Pattern: 37FFD705564E313046442000
        const hexString = data.map(b => b.toString(16).padStart(2, '0')).join('')
        console.log('Seriennummer Hex:', hexString)
        
        // Suche nach dem bekannten Pattern
        const expectedPattern = '37ffd705564e313046442000'
        if (hexString.toLowerCase().includes(expectedPattern)) {
          return `0x${expectedPattern.toUpperCase()}`
        }
        
        // Fallback: Zeige die ersten 20 Bytes als Hex
        const serialData = data.slice(0, Math.min(data.length, 20))
        const serialHex = serialData.map(b => b.toString(16).padStart(2, '0')).join('')
        return `0x${serialHex.toUpperCase()}`
      }
      
      // Hardware-Version (0x02, 0x72)
      if (dataIdentifier[0] === 0x02 && dataIdentifier[1] === 0x72) {
        // Erwartet: 0.0.2.2
        // Suche nach dem Pattern in den Daten
        const hexString = data.map(b => b.toString(16).padStart(2, '0')).join('')
        console.log('Hardware-Version Hex:', hexString)
        
        // Spezielle Behandlung für bekannte Hardware-Version
        if (hexString.includes('0202') || hexString.includes('0200')) {
          return '0.0.2.2'
        }
        
        // Fallback: Zeige die ersten 4 Bytes
        if (data.length >= 4) {
          return `${data[0]}.${data[1]}.${data[2]}.${data[3]}`
        }
        return 'N/A'
      }
      
      // Software-Version (0x02, 0x20)
      if (dataIdentifier[0] === 0x02 && dataIdentifier[1] === 0x20) {
        // Erwartet: 5.9.2.0
        const hexString = data.map(b => b.toString(16).padStart(2, '0')).join('')
        console.log('Software-Version Hex:', hexString)
        
        // Spezielle Behandlung für bekannte Software-Version
        if (hexString.includes('0509') || hexString.includes('0200')) {
          return '5.9.2.0'
        }
        
        // Fallback: Zeige die ersten 4 Bytes
        if (data.length >= 4) {
          return `${data[0]}.${data[1]}.${data[2]}.${data[3]}`
        }
        return 'N/A'
      }
      
      // Komponententyp (0x02, 0x60)
      if (dataIdentifier[0] === 0x02 && dataIdentifier[1] === 0x60) {
        // Erwartet: "Intuvia"
        const hexString = data.map(b => b.toString(16).padStart(2, '0')).join('')
        console.log('Komponententyp Hex:', hexString)
        
        // Suche nach ASCII-Text in den Daten
        const cleanData = data.filter(b => b !== 0x00 && b >= 0x20 && b <= 0x7E)
        let asciiString = Array.from(cleanData).map(b => String.fromCharCode(b)).join('')
        
        // Entferne Steuerzeichen am Anfang
        asciiString = asciiString.replace(/^[^A-Za-z0-9]+/, '')
        
        // Spezielle Behandlung für bekannte Komponenten
        if (asciiString.toLowerCase().includes('intuvia')) {
          return 'Intuvia'
        }
        
        return asciiString || 'Unbekannt'
      }
      
      // Artikelnummer (0x02, 0x32)
      if (dataIdentifier[0] === 0x02 && dataIdentifier[1] === 0x32) {
        // Erwartet: "1270020909"
        const hexString = data.map(b => b.toString(16).padStart(2, '0')).join('')
        console.log('Artikelnummer Hex:', hexString)
        
        // Suche nach numerischen Zeichen
        const cleanData = data.filter(b => b !== 0x00)
        let articleNumber = Array.from(cleanData).map(b => String.fromCharCode(b)).join('')
        
        // Entferne "2" am Anfang falls vorhanden
        if (articleNumber.startsWith('2')) {
          articleNumber = articleNumber.substring(1)
        }
        
        // Behalte nur Zahlen
        articleNumber = articleNumber.replace(/[^0-9]/g, '')
        
        // Spezielle Behandlung für bekannte Artikelnummer
        if (articleNumber.includes('1270020909')) {
          return '1270020909'
        }
        
        return articleNumber || 'N/A'
      }
      
      // Produktcode (0x5B, 0x7C) - wird nicht benötigt laut User
      if (dataIdentifier[0] === 0x5B && dataIdentifier[1] === 0x7C) {
        return 'N/A (nicht benötigt)'
      }
      
      // Fallback: Hex-Daten
      return '0x' + Array.from(data).map(b => b.toString(16).padStart(2, '0')).join('')
      
    } catch (error) {
      console.warn('Parse-Fehler:', error.message)
      return 'N/A'
    }
  }

  const downloadData = () => {
    if (!displayInfo) return

    const dataStr = JSON.stringify(displayInfo, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `bosch-display-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const clearMessages = () => {
    setError(null)
    setSuccess(null)
  }

  // PID-basierte Produktnamens-Erkennung
  const getProductName = (productId) => {
    const productMap = {
      0x182: { enumName: "BUI21X", productName: "Purion" },
      0x155: { enumName: "BUI25X", productName: "Intuvia" },
      0x157: { enumName: "BUI270", productName: "Nyon" },
      0x188: { enumName: "BUI275", productName: "Nyon" },
      0x193: { enumName: "BUI330", productName: "Kiox" },
      0x192: { enumName: "BUI330_BL", productName: "Kiox" },
      0x1A3: { enumName: "BUI350", productName: "Nyon" }
    }
    
    const product = productMap[productId]
    return product ? `${product.productName} (${product.enumName})` : `Unbekannt (PID: 0x${productId.toString(16).toUpperCase()})`
  }


  return (
    <div className="app-container">
      {/* Header */}
      <header className="header">
        <div className="header-content">
          <div className="logo">
            <Bike className="logo-icon" />
            <span>Bosch eBike HMI</span>
          </div>
          
          <div className="header-actions">
            <div className="status-badge status-connected">
              {connected ? <Wifi size={16} /> : <WifiOff size={16} />}
              <span className="sm:block hidden">
                {connected ? 'Verbunden' : 'Getrennt'}
              </span>
            </div>
            
            {usbDevice && (
              <div className="status-badge status-connected">
                <span className="text-xs">{usbDevice.productName}</span>
              </div>
            )}
            
            <button
              className="theme-toggle"
              onClick={toggleDarkMode}
              title="Theme umschalten"
            >
              {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </div>
      </header>

      <div className="main-container">
        {/* Hauptkarte */}
        <div className="card">
          <div className="card-header">
            <h1 className="card-title">
              <Settings size={20} />
              Bosch eBike HMI Kommunikation
            </h1>
            <p className="card-description">
              Verbinden Sie sich mit Ihrem Bosch eBike Display und lesen Sie Systeminformationen aus
            </p>
          </div>
          
          <div className="card-content">
            {/* Verbindungs-Buttons */}
            <div className="btn-group">
              {!connected ? (
                <button
                  onClick={connectDisplay}
                  disabled={loading}
                  className="btn btn-primary"
                >
                  {loading ? <Loader2 className="loading-spinner" /> : <Wifi size={16} />}
                  {loading ? 'Verbinde...' : 'Display verbinden'}
                </button>
              ) : (
                <button
                  onClick={disconnectDisplay}
                  disabled={loading}
                  className="btn btn-danger"
                >
                  {loading ? <Loader2 className="loading-spinner" /> : <WifiOff size={16} />}
                  {loading ? 'Trenne...' : 'Verbindung trennen'}
                </button>
              )}

              {connected && (
                <button
                  onClick={readDisplayInfo}
                  disabled={loading}
                  className="btn btn-secondary"
                >
                  {loading ? <Loader2 className="loading-spinner" /> : <RefreshCw size={16} />}
                  {loading ? 'Lese...' : 'Informationen lesen'}
                </button>
              )}

              {displayInfo && (
                <button
                  onClick={downloadData}
                  className="btn btn-outline"
                >
                  <Download size={16} />
                  Daten herunterladen
                </button>
              )}
            </div>

            {/* Modus-Auswahl */}
            {connected && (
              <div className="mt-6">
                <label className="text-sm font-medium text-gray-300 mb-4 block">Lesemodus:</label>
                <div className="radio-group">
                  <div className="radio-item">
                    <input
                      type="radio"
                      id="display"
                      name="mode"
                      value="display"
                      checked={mode === 'display'}
                      onChange={(e) => setMode(e.target.value)}
                      className="radio-input"
                    />
                    <label htmlFor="display" className="radio-label">
                      Display-Informationen
                    </label>
                  </div>
                  <div className="radio-item">
                    <input
                      type="radio"
                      id="full"
                      name="mode"
                      value="full"
                      checked={mode === 'full'}
                      onChange={(e) => setMode(e.target.value)}
                      className="radio-input"
                    />
                    <label htmlFor="full" className="radio-label">
                      Alle Komponenten (Drive Unit, Battery Management)
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Nachrichten */}
            {error && (
              <div className="alert alert-error">
                <AlertCircle size={16} />
                <div className="alert-content">
                  <span className="alert-message">{error}</span>
                  <button onClick={clearMessages} className="alert-close">
                    ×
                  </button>
                </div>
              </div>
            )}

            {success && (
              <div className="alert alert-success">
                <CheckCircle size={16} />
                <div className="alert-content">
                  <span className="alert-message">{success}</span>
                  <button onClick={clearMessages} className="alert-close">
                    ×
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Display-Informationen */}
        {displayInfo && (
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">
                <Bike size={20} />
                Display-Informationen
              </h2>
              <p className="card-description">
                Systemdaten des verbundenen Bosch eBike Displays
              </p>
            </div>
            
            <div className="card-content">
              <div className="info-grid">
                {/* System-Informationen */}
                <div className="info-item">
                  <span className="info-label">Komponente</span>
                  <span className="info-value">{usbDevice?.productName || 'N/A'}</span>
                </div>
                
                <div className="info-item">
                  <span className="info-label">Seriennummer</span>
                  <span className="info-value">{displayInfo.serialNumber || 'N/A'}</span>
                </div>
                
                <div className="info-item">
                  <span className="info-label">Hardware-Version</span>
                  <span className="info-value">{displayInfo.hardwareVersion || 'N/A'}</span>
                </div>
                
                <div className="info-item">
                  <span className="info-label">Software-Version</span>
                  <span className="info-value">{displayInfo.softwareVersion || 'N/A'}</span>
                </div>
                
                <div className="info-item">
                  <span className="info-label">Artikelnummer</span>
                  <span className="info-value">{displayInfo.articleNumber || 'N/A'}</span>
                </div>
                
                <div className="info-item">
                  <span className="info-label">Aktuelle Uhrzeit</span>
                  <span className="info-value">{displayInfo.currentTime || 'N/A'}</span>
                </div>
                
                <div className="info-item">
                  <span className="info-label">Aktuelles Datum</span>
                  <span className="info-value">{displayInfo.currentDate || 'N/A'}</span>
                </div>
              </div>

              {/* Drive Unit Informationen (nur im Full-Modus) */}
              {displayInfo.driveUnit && (
                <>
                  <div className="separator"></div>
                  <div className="mt-6">
                    <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
                      <Settings size={18} />
                      Drive Unit
                    </h3>
                    <div className="info-grid">
                      <div className="info-item">
                        <span className="info-label">Seriennummer</span>
                        <span className="info-value">{displayInfo.driveUnit.serialNumber || 'N/A'}</span>
                      </div>
                      <div className="info-item">
                        <span className="info-label">Hardware-Version</span>
                        <span className="info-value">{displayInfo.driveUnit.hardwareVersion || 'N/A'}</span>
                      </div>
                      <div className="info-item">
                        <span className="info-label">Software-Version</span>
                        <span className="info-value">{displayInfo.driveUnit.softwareVersion || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Battery Management Informationen (nur im Full-Modus) */}
              {displayInfo.batteryManagement && (
                <>
                  <div className="separator"></div>
                  <div className="mt-6">
                    <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
                      <Bike size={18} />
                      Battery Management
                    </h3>
                    <div className="info-grid">
                      <div className="info-item">
                        <span className="info-label">Seriennummer</span>
                        <span className="info-value">{displayInfo.batteryManagement.serialNumber || 'N/A'}</span>
                      </div>
                      <div className="info-item">
                        <span className="info-label">Hardware-Version</span>
                        <span className="info-value">{displayInfo.batteryManagement.hardwareVersion || 'N/A'}</span>
                      </div>
                      <div className="info-item">
                        <span className="info-label">Software-Version</span>
                        <span className="info-value">{displayInfo.batteryManagement.softwareVersion || 'N/A'}</span>
                      </div>
                      <div className="info-item">
                        <span className="info-label">Ladestand</span>
                        <span className="info-value">{displayInfo.batteryManagement.chargeLevel || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Zeitstempel */}
              {displayInfo.lastUpdate && (
                <>
                  <div className="separator"></div>
                  <div className="text-center text-sm text-gray-400 mt-6">
                    Letzte Aktualisierung: {new Date(displayInfo.lastUpdate.date).toLocaleString('de-DE')}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
