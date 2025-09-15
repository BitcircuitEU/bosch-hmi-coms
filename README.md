## 🚀 Features

### Grundlegende Funktionen
- **USB HID Kommunikation** mit Bosch eBike Displays (VID: 0x108c, PID: 0x155)
- **UDS-Protokoll** (Unified Diagnostic Services) über USB
- **Korrekte Handshake-Implementierung** nach Bosch-Standard
- **Multi-Device Support** für verschiedene eBike-Komponenten

### Erweiterte Diagnose-Funktionen
- **Session Management** (Default, Programming, Extended Diagnostic)
- **Security Access** für erweiterte Funktionen
- **Diagnostic Trouble Codes (DTCs)** auslesen
- **Drive Unit Kommunikation** (Motor, Sensoren)
- **Battery Management System** Zugriff
- **Multi-Component Support** (BUI, DU, BMS)

## 📋 Unterstützte Geräte

### Bosch User Interface (BUI)
- Intuvia, Purion, Nyon, Kiox Displays
- Component IDs: 0x20, 0x22, 0x39, 0x3A, 0x5D, 0x5E, 0x5F

### Drive Unit (DU)
- Motor und Sensoren
- Component IDs: 0x20, 0x22

### Battery Management System (BMS)
- Batterie-Informationen
- Component IDs: 0x20, 0x22

## 🛠️ Installation

```bash
# Repository klonen
git clone <repository-url>
cd bosch-hid

# Dependencies installieren
npm install

# Tool ausführen
npm start
```

## 📖 Verwendung

### Grundlegende Befehle

```bash
# Alle verfügbaren HID-Geräte auflisten
npm run list

# Mit Display verbinden und alle Informationen auslesen
npm run connect

# Mit erweiterten Optionen verbinden
npm run connect -- --session --diagnostic --verbose
```

### Erweiterte Befehle

```bash
# Erweiterte UDS-Session starten
node src/index.js session --type extended

# Diagnose durchführen
node src/index.js diagnostic --verbose

# Alle eBike-Komponenten anzeigen
node src/index.js devices
```

### Verfügbare Optionen

#### Connect-Befehl
- `--verbose, -v`: Verbose-Ausgabe aktivieren
- `--session, -s`: Erweiterte UDS-Session starten
- `--diagnostic, -d`: Erweiterte Diagnose durchführen

#### Session-Befehl
- `--type, -t <type>`: Session-Typ (default, programming, extended)

#### Diagnostic-Befehl
- `--verbose, -v`: Verbose-Ausgabe aktivieren

## 🔧 Technische Details

### Protokoll-Implementierung

#### Handshake-Protokoll
```
Request:  [0x00, 0x00, 0x03, 0x03, 0x02, 0x01]
Response: [0x00, 0x01, 0x02]
```

#### UDS Services
- **0x10**: Diagnostic Session Control
- **0x22**: Read Data By Identifier
- **0x2E**: Write Data By Identifier
- **0x27**: Security Access
- **0x19**: Read DTC Information
- **0x3E**: Tester Present

#### Data Identifiers

**BUI (Bosch User Interface)**
- 544 (0x0220): Software Version
- 545 (0x0221): Hardware Version
- 578 (0x0242): Serial Number
- 576 (0x0240): Present Time
- 586 (0x024A): Language Setting

**DU (Drive Unit)**
- 61744 (0xF130): Part Number
- 61836 (0xF1AC): Serial Number
- 61776 (0xF150): Hardware Version
- 61777 (0xF151): Software Version

**BMS (Battery Management)**
- 61744 (0xF130): Part Number
- 61836 (0xF1AC): Serial Number
- 61776 (0xF150): Hardware Version
- 61777 (0xF151): Software Version

### Kommunikationsarchitektur

```
PC (Node.js) ←→ USB HID ←→ Bosch Display ←→ CAN Bus ←→ eBike Components
```

- **USB HID Interface**: 64-Byte Pakete
- **UDS over USB**: Standard UDS Services
- **Multi-Component**: Unterstützung für BUI, DU, BMS

## 📊 Ausgabe-Beispiel

```
╔══════════════════════════════════════════════════════════════╗
║                    Bosch eBike Display Tool                  ║
║                    Kommunikations-Interface                  ║
╚══════════════════════════════════════════════════════════════╝

🤝 Führe Handshake durch...
✓ Handshake erfolgreich

📡 Starte erweiterte UDS-Session...
✓ Erweiterte Session gestartet

🔐 Führe Security Access durch...
✓ Security Access erfolgreich

📋 Display-Informationen:

🔧 System-Informationen:
  Seriennummer: 0x37FFD705564E313046442000
  Hardware-Version: 2.2.0.0
  Software-Version: 5.9.2.0
  Produktcode: BUI255
  Artikelnummer: 1270020909
  Komponente: Intuvia

🚴 Drive Unit Informationen:
  Part Number: DU123456789
  Serial Number: 0x123456789ABC
  Hardware Version: 1.0.0.0
  Software Version: 2.1.0.0

🔋 Battery Management System:
  Part Number: BMS987654321
  Serial Number: 0x987654321DEF
  Hardware Version: 1.5.0.0
  Software Version: 3.2.0.0

🔍 Diagnostic Trouble Codes:
  Anzahl DTCs: 0
  Keine DTCs gefunden
```

## 🔒 Sicherheit

- **Security Access**: Implementiert für erweiterte Funktionen
- **Session Management**: Verschiedene Sicherheitsstufen
- **DTC-Überwachung**: Kontinuierliche Fehlerüberwachung

## 🐛 Fehlerbehebung

### Häufige Probleme

1. **"Kein Bosch Display gefunden"**
   - Stellen Sie sicher, dass das Display angeschlossen ist
   - Prüfen Sie die USB-Verbindung
   - Führen Sie `npm run list` aus, um verfügbare Geräte zu sehen

2. **"Handshake fehlgeschlagen"**
   - Das Display ist möglicherweise nicht bereit
   - Versuchen Sie es erneut nach einigen Sekunden

3. **"Security Access fehlgeschlagen"**
   - Normal bei einigen Display-Versionen
   - Grundlegende Funktionen funktionieren trotzdem

### Debug-Modus

```bash
# Mit Debug-Ausgabe
npm run connect -- --verbose

# Oder direkt
node src/index.js connect --verbose
```

## 📝 Lizenz

MIT License - Siehe LICENSE-Datei für Details.

## 🤝 Beitragen

1. Fork des Repositories
2. Feature-Branch erstellen (`git checkout -b feature/AmazingFeature`)
3. Änderungen committen (`git commit -m 'Add some AmazingFeature'`)
4. Branch pushen (`git push origin feature/AmazingFeature`)
5. Pull Request erstellen

## 📚 Referenzen

- [Bosch eBike HIM Dokumentation](https://www.pedelecforum.de/forum/index.php?threads/classic-can-bus-daten-usw.17799/post-862775)
- [UDS-Protokoll Spezifikation](https://www.iso.org/standard/46408.html)
- [USB HID Spezifikation](https://www.usb.org/hid)

## 🆘 Support

Bei Problemen oder Fragen:
1. Prüfen Sie die [Issues](https://github.com/BitcircuitEU/bosch-hmi-coms/issues)
2. Erstellen Sie ein neues Issue mit detaillierter Beschreibung
3. Fügen Sie Logs mit `--verbose` Flag hinzu

---

**Entwickelt mit ❤️ für die eBike-Community**
