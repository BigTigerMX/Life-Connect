const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*" } });

app.use(express.static('public'));
app.use(express.json());

// Archivos de datos persistentes
const HISTORY_FILE = './emergency_history.json';
const PROFILES_FILE = './medical_profiles.json';

let emergencyHistory = [];
let medicalProfiles = {};

// Cargar datos existentes
if (fs.existsSync(HISTORY_FILE)) {
    emergencyHistory = JSON.parse(fs.readFileSync(HISTORY_FILE));
}
if (fs.existsSync(PROFILES_FILE)) {
    medicalProfiles = JSON.parse(fs.readFileSync(PROFILES_FILE));
}

function saveHistory() {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(emergencyHistory, null, 2));
}

function saveProfiles() {
    fs.writeFileSync(PROFILES_FILE, JSON.stringify(medicalProfiles, null, 2));
}

// Generar código único
function generateCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Guardar ficha médica
app.post('/api/medical-profile', (req, res) => {
    const { phone, data } = req.body;
    medicalProfiles[phone] = {
        ...data,
        updatedAt: new Date().toISOString()
    };
    saveProfiles();
    res.json({ success: true });
});

// Obtener ficha
app.get('/api/medical-profile/:phone', (req, res) => {
    const profile = medicalProfiles[req.params.phone];
    if (profile) res.json(profile);
    else res.status(404).json({ error: 'No encontrado' });
});

// Crear emergencia
app.post('/api/emergency', (req, res) => {
    // ... tu código actual que crea la emergencia ...
    
    // Al final, antes de res.json, agrega:
    broadcastEmergency(emergency);
    
    res.json({ 
        success: true, 
        code,
        emergency,
        pcUrl: `/command-center?code=${code}` // URL para ver en el centro de comando
    });
});


// Guardar detalles post-emergencia
app.post('/api/emergency/:code/details', (req, res) => {
    const { code } = req.params;
    const { details, outcome } = req.body;
    
    const emergency = emergencyHistory.find(e => e.code === code);
    if (emergency) {
        emergency.userDetails = details;
        emergency.outcome = outcome;
        emergency.resolvedAt = new Date().toISOString();
        saveHistory();
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'No encontrado' });
    }
});

// Obtener historial por teléfono
app.get('/api/history/:phone', (req, res) => {
    const phone = req.params.phone;
    const userHistory = emergencyHistory.filter(e => 
        e.userPhone === phone || 
        (e.patientData && e.patientData.phone === phone)
    );
    res.json(userHistory);
});

// Vista PC
app.get('/view/:code', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'pc-view.html'));
});

// Obtener emergencia específica
app.get('/api/emergency/:code', (req, res) => {
    const emergency = emergencyHistory.find(e => e.code === req.params.code);
    if (emergency) res.json(emergency);
    else res.status(404).json({ error: 'Expirada o no encontrada' });
});

// Actualización ambulancia (simulación)
setInterval(() => {
    // Lógica de actualización...
}, 5000);

const PORT = process.env.PORT || 3000;
const os = require('os');

// Obtener IP local
const networkInterfaces = os.networkInterfaces();
let localIp = 'localhost';
for (const name of Object.keys(networkInterfaces)) {
    for (const net of networkInterfaces[name]) {
        if (net.family === 'IPv4' && !net.internal) {
            localIp = net.address;
        }
    }
}
// WebSocket - Emitir emergencias a todos los centros de comando conectados
io.on('connection', (socket) => {
    console.log('Centro de comando conectado:', socket.id);
    
    // Enviar datos iniciales al conectar
    socket.emit('INIT', {
        emergencies: emergencyHistory.filter(e => e.status === 'active'),
        timestamp: new Date().toISOString()
    });
    
    // Escuchar cuando una ambulancia actualiza su posición (simulado o real)
    socket.on('AMBULANCE_UPDATE', (data) => {
        io.emit('AMBULANCE_UPDATE', data);
    });
    
    // Escuchar cuando operador cierra servicio
    socket.on('CLOSE_SERVICE', (data) => {
        // Actualizar en base de datos
        const emergency = emergencyHistory.find(e => e.code === data.emergencyId);
        if (emergency) {
            emergency.status = 'completed';
            emergency.resolvedAt = new Date().toISOString();
            emergency.resolution = data.resolution;
            saveHistory();
            
            // Notificar a todos
            io.emit('SERVICE_CLOSED', {
                emergencyId: data.emergencyId,
                ambulance: data.ambulance,
                resolution: data.resolution
            });
        }
    });
    
    socket.on('disconnect', () => {
        console.log('Centro de comando desconectado:', socket.id);
    });
});

// Función para emitir nueva emergencia (la llamaremos desde la API)
function broadcastEmergency(emergency) {
    io.emit('NEW_EMERGENCY', emergency);
}

server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚑 LifeConnect Pro`);
    console.log(`💻 http://localhost:${PORT}`);
    console.log(`📱 http://${localIp}:${PORT}  <-- USA ESTA EN TU CELULAR`);
});

// Al final de server.js, reemplaza el listen por:
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚑 Server running on port ${PORT}`);
});
