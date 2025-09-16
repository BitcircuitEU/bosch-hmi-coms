# Bosch eBike HMI Frontend

Ein modernes, responsives Frontend für die Kommunikation mit Bosch eBike Displays über WebHID.

## ✨ Features

- **Modernes Design**: Verwendet shadcn/ui Komponenten für ein professionelles Aussehen
- **Dunkles Theme**: Standardmäßig dunkles Design mit Toggle-Funktion
- **Responsive**: Optimiert für Desktop, Tablet und Mobile
- **WebHID Integration**: Direkte Kommunikation mit Bosch eBike Displays
- **Real-time Updates**: Socket.IO für Live-Kommunikation mit dem Backend
- **Datenexport**: JSON-Export der Display-Informationen

## 🎨 Design-System

### Komponenten
- **Button**: Verschiedene Varianten (primary, secondary, destructive, outline, ghost)
- **Card**: Für strukturierte Inhalte mit Header, Content und Footer
- **Badge**: Status-Anzeigen und Labels
- **Alert**: Benachrichtigungen für Erfolg und Fehler
- **RadioGroup**: Modus-Auswahl mit modernen Radio-Buttons
- **Separator**: Visuelle Trennung von Inhalten

### Theme
- **Dunkles Theme**: Standardmäßig aktiviert
- **CSS-Variablen**: Für konsistente Farben und Spacing
- **Tailwind CSS**: Für responsive Design und Utility-Klassen

### Responsive Design
- **Mobile First**: Optimiert für kleine Bildschirme
- **Breakpoints**: 
  - `sm`: 640px+
  - `md`: 768px+
  - `lg`: 1024px+
  - `xl`: 1280px+
- **Flexible Grid**: Info-Grid passt sich automatisch an
- **Touch-friendly**: Große Buttons und Touch-Targets

## 🚀 Installation

```bash
# Dependencies installieren
npm install

# Development Server starten
npm run dev

# Build für Production
npm run build
```

## 🛠️ Technologie-Stack

- **React 18**: Moderne React-Features
- **Vite**: Schneller Build-Tool
- **Tailwind CSS**: Utility-first CSS Framework
- **shadcn/ui**: Moderne UI-Komponenten
- **Lucide React**: Icon-Bibliothek
- **Socket.IO**: Real-time Kommunikation
- **WebHID API**: Hardware-Kommunikation

## 📱 Mobile Optimierungen

- **Kompakte Header**: Logo und Status auf kleinem Raum
- **Stack-Layout**: Buttons stapeln sich vertikal auf kleinen Bildschirmen
- **Touch-Targets**: Mindestens 44px für bessere Bedienbarkeit
- **Readable Text**: Angepasste Schriftgrößen für mobile Geräte
- **Flexible Grid**: Info-Items passen sich automatisch an

## 🎯 Verwendung

1. **Display verbinden**: Klicken Sie auf "Display verbinden" und wählen Sie Ihr Bosch eBike Display aus
2. **Modus wählen**: Wählen Sie zwischen "Display-Informationen" oder "Alle Komponenten"
3. **Daten lesen**: Klicken Sie auf "Informationen lesen" um Systemdaten abzurufen
4. **Daten exportieren**: Verwenden Sie "Daten herunterladen" für JSON-Export
5. **Theme wechseln**: Nutzen Sie den Sonne/Mond-Button für Theme-Umschaltung

## 🔧 Anpassungen

### Farben ändern
Bearbeiten Sie die CSS-Variablen in `src/index.css`:

```css
:root {
  --primary: 221.2 83.2% 53.3%;
  --secondary: 210 40% 96%;
  /* ... weitere Variablen */
}
```

### Komponenten anpassen
Alle UI-Komponenten befinden sich in `src/components/ui/` und können individuell angepasst werden.

### Responsive Breakpoints
Anpassungen in `tailwind.config.js`:

```javascript
theme: {
  screens: {
    'sm': '640px',
    'md': '768px',
    'lg': '1024px',
    'xl': '1280px',
  }
}
```

## 📄 Lizenz

Dieses Projekt ist für den internen Gebrauch bei Bosch bestimmt.
