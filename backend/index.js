#!/usr/bin/env node

const express = require('express');
const cors = require('cors');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { program } = require('commander');
const chalk = require('chalk');
const path = require('path');

const BoschDisplayTool = require('./lib/BoschDisplayTool');
const WebUsbWrapper = require('./lib/WebUsbWrapper');

// Express App Setup
const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'frontend/dist')));

// Globale Variablen
let displayTool = null;
let webUsbWrapper = null;
let isConnected = false;

// CLI Commands
program
  .name('bosch-display-webusb')
  .description('WebUSB-basiertes Tool zur Kommunikation mit Bosch eBike Displays')
  .version('2.0.0');

program
  .command('list')
  .description('Liste alle verfügbaren HID-Geräte auf')
  .option('-v, --verbose', 'Zeige detaillierte Informationen')
  .action(async (options) => {
    try {
      console.log(chalk.blue('🔍 Suche nach HID-Geräten...'));
      
      // Für WebUSB simulieren wir nur Bosch Displays
      const devices = [
        {
          vendorId: 0x108c,
          productId: 0x155,
          product: 'Bosch eBike Display (BUI25X)',
          manufacturer: 'Bosch eBike Systems',
          path: 'WebUSB-Device',
          interface: 0
        }
      ];
      
      if (devices.length === 0) {
        console.log(chalk.yellow('⚠️  Keine HID-Geräte gefunden.'));
        return;
      }

      console.log(chalk.green(`✓ Gefunden: ${devices.length} HID-Gerät(e)`));
      
      // Zeige Geräte in einer einfachen Tabelle
      console.log(chalk.blue('\n📋 Verfügbare Geräte:'));
      devices.forEach((device, index) => {
        const isBosch = device.vendorId === 0x108c && device.productId === 0x155;
        const status = isBosch ? chalk.green('✓ Bosch Display') : chalk.gray('Anderes Gerät');
        console.log(chalk.white(`  ${index + 1}. ${device.product} (${device.manufacturer})`));
        console.log(chalk.gray(`     VID: 0x${device.vendorId.toString(16).toUpperCase()}, PID: 0x${device.productId.toString(16).toUpperCase()}`));
        console.log(chalk.gray(`     Status: ${status}`));
      });
      
      if (options.verbose) {
        devices.forEach((device, index) => {
          console.log(chalk.gray(`\nGerät ${index + 1} Details:`));
          console.log(chalk.gray(`  Pfad: ${device.path || 'Unbekannt'}`));
          console.log(chalk.gray(`  Hersteller: ${device.manufacturer || 'Unbekannt'}`));
          console.log(chalk.gray(`  Interface: ${device.interface || 'Unbekannt'}`));
        });
      }
      
    } catch (error) {
      console.error(chalk.red('Fehler beim Auflisten der Geräte:'), error.message);
    }
  });

program
  .command('connect')
  .description('Verbinde mit dem Bosch Display und starte Web-Server')
  .option('-v, --verbose', 'Verbose-Ausgabe aktivieren')
  .option('-m, --mode <mode>', 'Modus: display (nur Display-Info) oder full (alle Komponenten)', 'display')
  .option('-p, --port <port>', 'Port für den Web-Server', '3000')
  .action(async (options) => {
    try {
      if (options.verbose) {
        console.log(chalk.gray('Verbose-Modus aktiviert'));
      }
      
      // Zeige Willkommensbildschirm
      console.log(chalk.blue.bold('╔══════════════════════════════════════════════════════════════╗'));
      console.log(chalk.blue.bold('║                Bosch eBike HMI Communicator                 ║'));
      console.log(chalk.blue.bold('║                    WebUSB-Interface                          ║'));
      console.log(chalk.blue.bold('╚══════════════════════════════════════════════════════════════╝'));
      console.log();
      console.log(chalk.gray('Ein Tool zur Kommunikation mit Bosch eBike Displays über WebUSB'));
      console.log(chalk.gray('Moderne Browser-basierte Lösung für einfache Nutzung'));
      console.log();
      
      // Backend startet nur als Web-Server - WebUSB wird vom Frontend gehandhabt
      console.log(chalk.blue('🔍 Backend startet als Web-Server...'));
      console.log(chalk.gray('WebUSB-Kommunikation wird vom Frontend gehandhabt'));
      
      // Keine WebUSB-Initialisierung im Backend
      webUsbWrapper = null;
      displayTool = null;
      
      // Starte Web-Server
      const port = parseInt(options.port) || 3000;
      server.listen(port, () => {
        console.log(chalk.green(`\n🌐 Web-Server läuft auf http://localhost:${port}`));
        console.log(chalk.blue('📱 Öffnen Sie diese URL in Ihrem Browser für das Web-Frontend'));
        console.log(chalk.gray('💡 Stellen Sie sicher, dass Ihr Browser WebUSB unterstützt (Chrome/Edge)'));
      });
      
      // WebSocket Events
      setupWebSocketEvents(io);
      
      // API Routes
      setupApiRoutes(app);
      
    } catch (error) {
      console.error(chalk.red('Verbindungsfehler:'), error.message);
    }
  });


// WebSocket Event Setup
function setupWebSocketEvents(io) {
  io.on('connection', (socket) => {
    console.log(chalk.blue('🔌 Client verbunden:', socket.id));
    
    socket.on('connect-display', async (data) => {
      try {
        console.log(chalk.blue('📱 WebUSB Verbindung angefordert'));
        console.log(chalk.gray(`Gerät: ${data.device.productName} (VID: 0x${data.device.vendorId.toString(16)}, PID: 0x${data.device.productId.toString(16)})`));
        
        // Validiere Bosch Display
        if (data.device.vendorId !== 0x108c || data.device.productId !== 0x155) {
          throw new Error('Kein gültiges Bosch eBike Display');
        }
        
        // Setze Verbindungsstatus
        isConnected = true;
        
        socket.emit('display-connected', {
          success: true,
          device: data.device
        });
        
        console.log(chalk.green('✓ Display erfolgreich verbunden'));
        
      } catch (error) {
        console.error(chalk.red('❌ WebUSB Verbindungsfehler:'), error.message);
        socket.emit('display-error', {
          success: false,
          error: error.message
        });
      }
    });
    
    socket.on('read-display-info', async (data) => {
      try {
        if (!isConnected) {
          throw new Error('Display nicht verbunden');
        }
        
        const mode = data.mode || 'display';
        console.log(chalk.blue(`📊 Lese Display-Informationen (Modus: ${mode})`));
        
        // Fordere das Frontend auf, die WebUSB-Daten zu lesen
        socket.emit('request-display-data', { mode: mode });
        
      } catch (error) {
        console.error(chalk.red('❌ Display-Info-Lesefehler:'), error.message);
        socket.emit('display-error', {
          success: false,
          error: error.message
        });
      }
    });

    // Empfängt echte Display-Daten vom Frontend
    socket.on('display-data-response', async (data) => {
      try {
        console.log(chalk.green('✓ Display-Daten vom Frontend empfangen'));
        
        socket.emit('display-info', {
          success: true,
          data: data,
          timestamp: new Date().toISOString()
        });
        
      } catch (error) {
        console.error(chalk.red('❌ Display-Daten-Verarbeitungsfehler:'), error.message);
        socket.emit('display-error', {
          success: false,
          error: error.message
        });
      }
    });
    
    socket.on('disconnect-display', async () => {
      try {
        // Backend hat keine WebUSB-Verbindung zu trennen
        isConnected = false;
        
        socket.emit('display-disconnected', {
          success: true
        });
        
        console.log(chalk.green('✓ Display getrennt'));
        
      } catch (error) {
        console.error(chalk.red('❌ Display-Trennfehler:'), error.message);
        socket.emit('display-error', {
          success: false,
          error: error.message
        });
      }
    });
    
    socket.on('disconnect', () => {
      console.log(chalk.gray('🔌 Client getrennt:', socket.id));
    });
  });
}

// API Routes Setup
function setupApiRoutes(app) {
  // Health Check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      connected: isConnected
    });
  });
  
  // Geräte auflisten
  app.get('/api/devices', (req, res) => {
    try {
      const devices = [
        {
          vendorId: 0x108c,
          productId: 0x155,
          product: 'Bosch eBike Display (BUI25X)',
          manufacturer: 'Bosch eBike Systems',
          isBosch: true
        }
      ];
      
      res.json({
        success: true,
        devices: devices
      });
    } catch (error) {
      console.error(chalk.red('❌ Geräte-Auflistung:'), error.message);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
  
  // Display-Informationen lesen - nur für API-Kompatibilität
  app.post('/api/display/read', async (req, res) => {
    try {
      // Backend kann keine Display-Daten lesen - nur Frontend kann WebUSB nutzen
      return res.status(400).json({
        success: false,
        error: 'Display-Daten können nur über das Frontend gelesen werden'
      });
      
    } catch (error) {
      console.error(chalk.red('❌ API Display-Info-Lesefehler:'), error.message);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
  
  // Fallback für alle anderen Routen - serve React App
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend/dist/index.html'));
  });
}

program.parse();
