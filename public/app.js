/**
 * LIFECONNECT PRO - Sistema de Emergencias Médicas
 * JavaScript completo y funcional
 */

// ============================================
// CONFIGURACIÓN GLOBAL
// ============================================
// Registrar Service Worker para PWA
// Registrar Service Worker para instalar en celular
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service-worker.js')
    .then(() => console.log('Listo para instalar en celular'))
    .catch(err => console.log('Error:', err));
}


const CONFIG = {
    // Tu API Key de ElevenLabs (consíguela en elevenlabs.io)
    ELEVENLABS_API_KEY: 'sk_180772420368c844b69f537faa6f3c2d1dbf444f1c6a66a6', // ← REEMPLAZA ESTO
    
    // Voces en español recomendadas:
    // 'Xb7hHmiMSyWpm5mWc1y8' = Matilde (Chilena, muy natural) ← RECOMENDADA
    // 'OYTlRPJo9ZrC1xfb7Sk' = Ricardo (Español neutro)
    // 'z6kP9bSQoXtqZzQdCZ3J' = Carmen (Español España)
    ELEVENLABS_VOICE_ID: 'Xb7hHmiMSyWpm5mWc1y8', // Matilde - Español natural
    
    // Usar modelo multilingüe para mejor pronunciación en español
    ELEVENLABS_MODEL: 'eleven_multilingual_v2',
    
    // Ajustes para voz más natural en español
    VOICE_SETTINGS: {
        stability: 0.25,        // Menos estable = más emotiva/natural
        similarity_boost: 0.85,  // Equilibrio entre claridad y naturalidad
        style: 0.60,            // Expresividad
        use_speaker_boost: true
    },
    
    PAUSE_BETWEEN_STEPS: 2800, // Pausa ligeramente mayor para español
    INTRO_DELAY: 1500,
    
    GEO_OPTIONS: {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
    }
};

// ============================================
// ESTADO GLOBAL
// ============================================

const AppState = {
    currentScreen: 'splash',
    userProfile: null,
    currentEmergency: null,
    currentEmergencyType: null,
    isSpeaking: false,
    speechQueue: [],
    audioContext: null,
    metronomeInterval: null,
    elapsedTimeInterval: null,
    compressionCount: 0,
    hasProfile: false,
    isPracticeMode: false,
    voiceEnabled: true,
    mapsLoaded: false
};

// ============================================
// DATOS: GUÍAS DE EMERGENCIA COMPLETAS
// ============================================

const EMERGENCY_GUIDES = {
    heart: {
        id: 'heart',
        title: 'Persona desmayada o sin pulso',
        description: 'La persona no responde, no respira o no tiene pulso',
        introText: 'Voy a guiarle paso a paso para ayudar a esta persona. Mantenga la calma y escuche atentamente.',
        steps: [
            {
                text: 'Primero, verifique que el lugar sea seguro para usted y la víctima. No se acerque si hay peligro eléctrico, de tráfico o fuego.',
                pauseAfter: 3000,
                critical: false
            },
            {
                text: 'Acérquese y sacuda suavemente los hombros. Grite fuerte: ¿Está bien? ¿Me escucha?',
                pauseAfter: 2500,
                critical: false
            },
            {
                text: 'Si no responde, llame al nueve once inmediatamente. Diga: Necesito una ambulancia, hay una persona inconsciente que no responde.',
                pauseAfter: 4000,
                critical: true
            },
            {
                text: 'Coloque la persona boca arriba en el piso. Arrodíllese a su lado. Coloque el talón de una mano en el centro del pecho, justo entre los pezones. Coloque la otra mano encima.',
                pauseAfter: 5000,
                critical: true
            },
            {
                text: 'Con los brazos rectos, presione fuerte y rápido. Debe hacer cien compresiones por minuto. Deje que el pecho suba completamente entre cada presión.',
                pauseAfter: 6000,
                critical: true
            },
            {
                text: 'Si tiene un desfibrilador cerca, úselo inmediatamente siguiendo las instrucciones de voz del aparato. Si no, continúe con las compresiones sin parar hasta que llegue ayuda.',
                pauseAfter: 4000,
                critical: true
            },
            {
                text: 'Está haciendo un buen trabajo. Mantenga el ritmo. La ayuda viene en camino. No se rinda, cada compresión cuenta.',
                pauseAfter: 3000,
                critical: false
            }
        ],
        requiresMetronome: true,
        bpm: 110
    },
    
    bleeding: {
        id: 'bleeding',
        title: 'Sangrado grave',
        description: 'Sangrado fuerte que no para, heridas profundas',
        introText: 'Voy a ayudarle a controlar el sangrado. La presión es clave. Escuche con atención.',
        steps: [
            {
                text: 'No se asuste. Busque un paño limpio, toalla o camiseta. Si no tiene nada, use su propia prenda.',
                pauseAfter: 2500,
                critical: false
            },
            {
                text: 'Coloque el paño directamente sobre la herida y presione fuerte con ambas manos. Presione tan fuerte como pueda. Esto es vital para detener el sangrado.',
                pauseAfter: 4000,
                critical: true
            },
            {
                text: 'Si el paño se empapa de sangre, no lo quite. Ponga otro paño encima y siga presionando. Quitar el primer paño puede empeorar todo.',
                pauseAfter: 4000,
                critical: true
            },
            {
                text: 'Si es posible, eleve la parte del cuerpo que sangra por encima del nivel del corazón. Esto reduce la presión en la herida.',
                pauseAfter: 3000,
                critical: false
            },
            {
                text: 'Mantenga la presión firme durante al menos diez minutos. No afloje para ver si dejó de sangrar. Llame al nueve once si no ha parado.',
                pauseAfter: 4000,
                critical: true
            }
        ],
        requiresMetronome: false,
        bpm: null
    },
    
    breathing: {
        id: 'breathing',
        title: 'No puede respirar',
        description: 'Sofoco, asma grave, reacción alérgica, ahogo',
        introText: 'Vamos a ayudar a que respire mejor. Siga mis instrucciones al pie de la letra.',
        steps: [
            {
                text: 'Si la persona está consciente, siéntela en una silla o en el suelo, pero con el torso derecho, nunca acostada boca arriba. Esto facilita la respiración.',
                pauseAfter: 4000,
                critical: false
            },
            {
                text: 'Busque rápidamente si tiene un inhalador para el asma. Si lo tiene y está consciente, ayúdele a usarlo. Dos inhalaciones, una cada minuto.',
                pauseAfter: 4000,
                critical: true
            },
            {
                text: 'Afloje cualquier ropa ajustada. Abra botones de la camisa, afloje la corbata, el cinturón o cualquier cosa que apriete el pecho o cuello.',
                pauseAfter: 3000,
                critical: false
            },
            {
                text: 'Si tiene aire acondicionado o ventilador, póngalo cerca pero no directamente en la cara. El aire fresco ayuda.',
                pauseAfter: 2500,
                critical: false
            },
            {
                text: 'Si los labios se ponen azulados o morados, o si no puede hablar de lo afligido que está, llame al nueve once ahora mismo. Eso es una emergencia grave.',
                pauseAfter: 4000,
                critical: true
            },
            {
                text: 'Mantenga la calma usted también. El pánico contagia. Hable con voz suave y tranquila. Dígale que todo va a estar bien.',
                pauseAfter: 3000,
                critical: false
            }
        ],
        requiresMetronome: false,
        bpm: null
    },
    
    fall: {
        id: 'fall',
        title: 'Se cayó y no se mueve',
        description: 'Accidente, golpe fuerte, posible fractura',
        introText: 'En caídas fuertes, lo más importante es no mover al lesionado. Le explico por qué y qué hacer.',
        steps: [
            {
                text: 'No mueva a la persona de donde está, especialmente si cayó de una altura, se golpeó la cabeza o se queja de cuello o espalda. Podría empeorar una lesión grave.',
                pauseAfter: 4000,
                critical: true
            },
            {
                text: 'Si está consciente, hablele calmadamente. Pregúntele su nombre, qué día es hoy y dónde estamos. Esto evalúa si hay daño cerebral.',
                pauseAfter: 4000,
                critical: false
            },
            {
                text: 'Si se queja de dolor en cuello o espalda, dígale que no mueva la cabeza ni intente levantarse. Inmovilice su cabeza con sus manos si es necesario.',
                pauseAfter: 4000,
                critical: true
            },
            {
                text: 'Si está sangrando de la cabeza, presione suavemente con un paño limpio, pero no mueva el cuello. Mantenga la cabeza en la posición que está.',
                pauseAfter: 4000,
                critical: true
            },
            {
                text: 'Llame al nueve once. Diga: caída fuerte, posible lesión de columna. Necesito que vengan con tabla rígida para inmovilizar.',
                pauseAfter: 4000,
                critical: true
            },
            {
                text: 'Mientras llega ayuda, mantenga a la persona abrigada si hace frío, pero no la mueva. Hablele para que no se duerma si golpeó la cabeza.',
                pauseAfter: 3000,
                critical: false
            }
        ],
        requiresMetronome: false,
        bpm: null
    },
    
    poison: {
        id: 'poison',
        title: 'Se intoxicó o picó',
        description: 'Comió algo malo, picadura de insecto, quemadura',
        introText: 'Depende de la causa, pero hay reglas generales que aplican. Escuche atentamente.',
        steps: [
            {
                text: 'Si comió o bebió algo extraño, no le dé agua, leche ni medicinas para hacerlo vomitar. Eso puede empeorar según qué haya ingerido.',
                pauseAfter: 4000,
                critical: true
            },
            {
                text: 'Si fue picado por insecto y ve hinchazón en cara o cuello, o tiene dificultad para tragar o respirar, es una alergia grave. Llame nueve once urgente.',
                pauseAfter: 4000,
                critical: true
            },
            {
                text: 'Si fue alacrán o araña venenosa, mantenga la zona afectada inmóvil y elevada. No aplaste ni succione el veneno. Llame al nueve once.',
                pauseAfter: 4000,
                critical: true
            },
            {
                text: 'En caso de quemadura, enfríe la zona con agua corriente fría por diez minutos. No use hielo directo ni mantequilla ni pasta de dientes.',
                pauseAfter: 4000,
                critical: false
            },
            {
                text: 'Si los ojos se ven afectados, lávelos con agua limpia por quince minutos. Mantenga los párpados abiertos con los dedos mientras lava.',
                pauseAfter: 4000,
                critical: false
            },
            {
                text: 'En todos los casos, si la persona vomita, acuéstela de lado para que no se atragante. No le dé nada por la boca si está muy somnoliento.',
                pauseAfter: 4000,
                critical: true
            }
        ],
        requiresMetronome: false,
        bpm: null
    },
    
    other: {
        id: 'other',
        title: 'Otra emergencia grave',
        description: 'Dolor extremo, convulsiones, situación no listada',
        introText: 'Emergencia médica no especificada. Siga estos pasos generales de seguridad.',
        steps: [
            {
                text: 'Mantenga la calma. Evalúe si la persona está consciente y respira. Si no respira, elija la opción de desmayo en el menú anterior.',
                pauseAfter: 3000,
                critical: false
            },
            {
                text: 'Si está teniendo convulsiones, aleje objetos peligrosos pero no sujete los movimientos. No meta nada en su boca. Ponga algo suave bajo su cabeza.',
                pauseAfter: 4000,
                critical: true
            },
            {
                text: 'Llame al nueve once y describa exactamente lo que ve: qué le pasó, cuánto tiempo hace, cómo está ahora. Sea específico.',
                pauseAfter: 4000,
                critical: true
            },
            {
                text: 'Si tiene dolor intenso en el pecho que irradia al brazo o mandíbula, puede ser un infarto. Síntele tranquilo y llame urgente.',
                pauseAfter: 4000,
                critical: true
            },
            {
                text: 'No administre medicamentos ajenos ni agua si está inconsciente. Espere a los profesionales si no sabe exactamente qué hacer.',
                pauseAfter: 3000,
                critical: true
            }
        ],
        requiresMetronome: false,
        bpm: null
    }
};

// ============================================
// INICIALIZACIÓN
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    loadUserProfile();
    initApp();
});
// ============================================
// OPTIMIZACIONES DE PERFORMANCE
// ============================================

// Detectar si es offline/online
window.addEventListener('online', () => {
  console.log('🟢 Conexión restaurada');
  showToast('Conexión restaurada - Sincronizando datos...');
  syncPendingData();
});

window.addEventListener('offline', () => {
  console.log('🔴 Modo offline activado');
  showToast('Modo offline activado - Funcionando sin internet');
});

// Lazy loading de pantallas (carga solo cuando se necesita)
const screenModules = {
  'screen-guide': () => preloadEmergencyGuide(),
  'screen-medical-form': () => preloadMedicalForm()
};

function preloadEmergencyGuide() {
  // Precargar audio de voz en background
  if (AppState.voiceEnabled && 'speechSynthesis' in window) {
    const voices = window.speechSynthesis.getVoices();
    console.log('Voces precargadas:', voices.length);
  }
}

// Debounce para búsquedas (evita lag al escribir)
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Intersection Observer para animaciones fluidas (carga solo lo visible)
const observerOptions = {
  root: null,
  rootMargin: '0px',
  threshold: 0.1
};

const screenObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      // Precargar contenido de la siguiente pantalla lógica
      preloadNextScreen(entry.target.id);
    }
  });
}, observerOptions);

// Precarga inteligente
function preloadNextScreen(currentScreenId) {
  const flow = {
    'screen-home': 'screen-emergency-types',
    'screen-emergency-types': 'screen-guide',
    'screen-quick-profile': 'screen-guide'
  };
  
  const nextScreen = flow[currentScreenId];
  if (nextScreen && document.getElementById(nextScreen)) {
    // Precargar imágenes o datos de la siguiente pantalla
    console.log(`Precargando ${nextScreen}...`);
  }
}

// IndexedDB para almacenamiento robusto offline
const DB_NAME = 'LifeConnectDB';
const DB_VERSION = 1;
let db;

function initIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };
    
    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      
      // Store para emergencias pendientes
      if (!database.objectStoreNames.contains('pendingEmergencies')) {
        const store = database.createObjectStore('pendingEmergencies', { keyPath: 'id', autoIncrement: true });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
      
      // Store para historial local
      if (!database.objectStoreNames.contains('localHistory')) {
        database.createObjectStore('localHistory', { keyPath: 'date' });
      }
    };
  });
}

// Guardar emergencia localmente si no hay conexión
async function saveEmergencyOffline(emergencyData) {
  if (!db) await initIndexedDB();
  
  const transaction = db.transaction(['pendingEmergencies'], 'readwrite');
  const store = transaction.objectStore('pendingEmergencies');
  
  await store.add({
    ...emergencyData,
    timestamp: new Date().toISOString(),
    synced: false
  });
  
  // Registrar para Background Sync
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    const registration = await navigator.serviceWorker.ready;
    await registration.sync.register('sync-emergencias');
  }
}

// Sincronizar datos pendientes
async function syncPendingData() {
  if (!db) return;
  
  const transaction = db.transaction(['pendingEmergencies'], 'readonly');
  const store = transaction.objectStore('pendingEmergencies');
  const request = store.getAll();
  
  request.onsuccess = async () => {
    const pending = request.result.filter(item => !item.synced);
    
    for (const emergency of pending) {
      try {
        await fetch('/api/emergency', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(emergency)
        });
        
        // Marcar como sincronizado
        const updateTx = db.transaction(['pendingEmergencies'], 'readwrite');
        const updateStore = updateTx.objectStore('pendingEmergencies');
        emergency.synced = true;
        await updateStore.put(emergency);
        
      } catch (error) {
        console.error('Error sincronizando emergencia:', error);
      }
    }
  };
}

// Inicializar DB al cargar
document.addEventListener('DOMContentLoaded', () => {
  initIndexedDB().catch(console.error);
});

function initApp() {
    // Simular carga inicial
    setTimeout(() => {
        hideScreen('screen-splash');
        showScreen('screen-home');
        updateProfileUI();
    }, 2500);
    
    // Configurar eventos de botones de tipo sanguíneo
    initBloodTypeButtons();
}

// ============================================
// NAVEGACIÓN ENTRE PANTALLAS
// ============================================

function showScreen(screenId) {
    // Ocultar todas las pantallas
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    
    // Mostrar la solicitada
    const target = document.getElementById(screenId);
    if (target) {
        target.classList.add('active');
        AppState.currentScreen = screenId;
        
        // Scroll al top
        target.scrollTop = 0;
    }
}

function hideScreen(screenId) {
    const screen = document.getElementById(screenId);
    if (screen) {
        screen.classList.remove('active');
    }
}

// ============================================
// FLUJO PRINCIPAL DE EMERGENCIA
// ============================================

function selectEmergencyType() {
    showScreen('screen-emergency-types');
}

function selectReportType() {
    showScreen('screen-report');
}

function backHome() {
    stopSpeech();
    stopMetronome();
    clearInterval(AppState.elapsedTimeInterval);
    showScreen('screen-home');
}

function backToTypes() {
    stopSpeech();
    showScreen('screen-emergency-types');
}

// Cuando selecciona un tipo de emergencia
function showGuideOrEmergency(type) {
    AppState.currentEmergencyType = type;
    
    // Mostrar modal de confirmación
    const modal = document.getElementById('modal-confirm-emergency');
    const desc = document.getElementById('confirm-description');
    const guide = EMERGENCY_GUIDES[type];
    
    if (desc && guide) {
        desc.textContent = guide.description;
    }
    
    if (modal) {
        modal.classList.remove('hidden');
    }
}

function closeConfirmModal() {
    const modal = document.getElementById('modal-confirm-emergency');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// Opción: Es emergencia real -> Ir a confirmar perfil o describir
function confirmRealEmergency() {
    closeConfirmModal();
    
    if (AppState.hasProfile) {
        showScreen('screen-quick-profile');
        updateQuickProfile();
    } else {
        showScreen('screen-describe-other');
    }
}

// Opción: Solo ver guía (modo práctica)
function showOnlyGuide() {
    closeConfirmModal();
    AppState.isPracticeMode = true;
    loadGuide(AppState.currentEmergencyType);
    showScreen('screen-guide');
}

// ============================================
// PANTALLA DE PERFIL RÁPIDO
// ============================================

function confirmUseProfile() {
    // Preparar datos de emergencia con perfil
    const emergencyData = {
        type: AppState.currentEmergencyType,
        patientData: AppState.userProfile, // Tu ficha médica
        forOther: false,
        timestamp: new Date().toISOString()
    };
    
    // Obtener GPS y enviar al servidor
    sendEmergencyWithLocation(emergencyData, () => {
        // Solo después de enviar, mostrar guía
        loadGuide(AppState.currentEmergencyType);
        showScreen('screen-guide');
    });
}


function confirmUseProfile() {
    // Usar el perfil guardado para la emergencia
    loadGuide(AppState.currentEmergencyType);
    showScreen('screen-guide');
    startEmergencyProtocol(true);
}

function selectOtherPerson() {
    showScreen('screen-describe-other');
}

function editBeforeSend() {
    showScreen('screen-medical-form');
    document.getElementById('medical-form-title').textContent = 'Editar Ficha Médica';
}

function backFromDescribe() {
    if (AppState.hasProfile) {
        showScreen('screen-quick-profile');
    } else {
        showScreen('screen-emergency-types');
    }
}

// ============================================
// GUÍAS DE EMERGENCIA (VOZ Y VISUAL)
// ============================================

function loadGuide(type) {
    const guide = EMERGENCY_GUIDES[type];
    if (!guide) return;
    
    // Actualizar UI
    const titleEl = document.getElementById('guide-title');
    const subtitleEl = document.getElementById('guide-subtitle');
    const stepsContainer = document.getElementById('steps-list');
    
    if (titleEl) titleEl.textContent = guide.title;
    if (subtitleEl) subtitleEl.textContent = guide.description;
    
    // Generar pasos visuales
    if (stepsContainer) {
        stepsContainer.innerHTML = guide.steps.map((step, index) => `
            <div class="step-card" id="step-${index}">
                <h4>Paso ${index + 1} ${step.critical ? '⚠️' : ''}</h4>
                <p>${step.text}</p>
            </div>
        `).join('');
    }
    
    // Configurar metrónomo si es necesario
    const metronomeOverlay = document.getElementById('metronome-overlay');
    if (guide.requiresMetronome && metronomeOverlay) {
        metronomeOverlay.classList.remove('hidden');
    } else if (metronomeOverlay) {
        metronomeOverlay.classList.add('hidden');
    }
    
    // Iniciar voz después de un delay
    if (AppState.voiceEnabled) {
        setTimeout(() => {
            speakText(guide.introText, () => {
                playGuideSteps(guide.steps, 0);
            });
        }, CONFIG.INTRO_DELAY);
    }
    
    // Iniciar timer de emergencia
    startElapsedTimer();
}

function playGuideSteps(steps, index) {
    if (index >= steps.length || AppState.currentScreen !== 'screen-guide') return;
    
    const step = steps[index];
    
    // Highlight visual del paso actual
    document.querySelectorAll('.step-card').forEach((el, i) => {
        el.style.opacity = i === index ? '1' : '0.5';
        el.style.transform = i === index ? 'scale(1.02)' : 'scale(1)';
    });
    
    // Scroll al paso
    const currentStep = document.getElementById(`step-${index}`);
    if (currentStep) {
        currentStep.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    
    // Hablar paso
    speakText(step.text, () => {
        setTimeout(() => {
            playGuideSteps(steps, index + 1);
        }, step.pauseAfter || CONFIG.PAUSE_BETWEEN_STEPS);
    });
}

function replayInstructions() {
    if (AppState.currentEmergencyType) {
        const guide = EMERGENCY_GUIDES[AppState.currentEmergencyType];
        playGuideSteps(guide.steps, 0);
    }
}

// ============================================
// SISTEMA DE VOZ (TTS)
// ============================================

async function speakText(text, onComplete) {
    if (!AppState.voiceEnabled) {
        if (onComplete) onComplete();
        return;
    }
    
    AppState.isSpeaking = true;
    showVoiceIndicator(true);
    
    // Intentar usar ElevenLabs primero
    try {
        await speakWithElevenLabs(text, onComplete);
    } catch (error) {
        // Fallback a Web Speech API
        speakWithWebSpeech(text, onComplete);
    }
}

async function speakWithElevenLabs(text, onComplete) {
    try {
        // Mostrar indicador de carga si es necesario
        console.log('Generando voz con ElevenLabs...');
        
        const response = await fetch(
            `https://api.elevenlabs.io/v1/text-to-speech/${CONFIG.ELEVENLABS_VOICE_ID}/stream`, 
            {
                method: 'POST',
                headers: {
                    'Accept': 'audio/mpeg',
                    'Content-Type': 'application/json',
                    'xi-api-key': CONFIG.ELEVENLABS_API_KEY
                },
                body: JSON.stringify({
                    text: text,
                    model_id: CONFIG.ELEVENLABS_MODEL || 'eleven_multilingual_v2',
                    voice_settings: {
                        stability: CONFIG.VOICE_SETTINGS.stability,
                        similarity_boost: CONFIG.VOICE_SETTINGS.similarity_boost,
                        style: CONFIG.VOICE_SETTINGS.style,
                        use_speaker_boost: CONFIG.VOICE_SETTINGS.use_speaker_boost
                    }
                })
            }
        );
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail?.message || 'Error en ElevenLabs');
        }
        
        // Crear blob y reproducir
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        
        // Configurar eventos antes de reproducir
        audio.onended = () => {
            AppState.isSpeaking = false;
            showVoiceIndicator(false);
            URL.revokeObjectURL(audioUrl); // Limpiar memoria
            if (onComplete) onComplete();
        };
        
        audio.onerror = (e) => {
            console.error('Error reproduciendo audio:', e);
            throw new Error('Error de reproducción');
        };
        
        // Ajustar volumen
        audio.volume = 1.0;
        
        // Reproducir
        await audio.play();
        
    } catch (error) {
        console.error('ElevenLabs falló:', error.message);
        // Fallback a voz del navegador
        speakWithWebSpeech(text, onComplete);
    }
}


function speakWithWebSpeech(text, onComplete) {
    if (!('speechSynthesis' in window)) {
        AppState.isSpeaking = false;
        if (onComplete) onComplete();
        return;
    }
    
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Configuración específica para español
    utterance.lang = 'es-MX'; // o 'es-ES' para España
    utterance.rate = 0.88;    // Más lento para emergencias (más claro)
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    
    // Buscar voz específica en español
    const voices = window.speechSynthesis.getVoices();
    
    // Prioridad: Google español > Microsoft > cualquier español
    const spanishVoice = voices.find(v => 
        v.name.includes('Google español') || 
        v.name.includes('Microsoft Sabina') ||
        v.lang === 'es-MX' ||
        v.lang === 'es-ES' ||
        v.lang.startsWith('es-')
    );
    
    if (spanishVoice) {
        utterance.voice = spanishVoice;
        console.log('Usando voz:', spanishVoice.name);
    } else {
        console.log('Voz española no encontrada, usando default');
    }
    
    utterance.onend = () => {
        AppState.isSpeaking = false;
        showVoiceIndicator(false);
        if (onComplete) onComplete();
    };
    
    utterance.onerror = (e) => {
        console.error('Error TTS:', e);
        AppState.isSpeaking = false;
        showVoiceIndicator(false);
        if (onComplete) onComplete();
    };
    
    window.speechSynthesis.speak(utterance);
}

// Precargar voces (necesario en algunos navegadores)
if ('speechSynthesis' in window) {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
    };
}


function stopSpeech() {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
    }
    AppState.isSpeaking = false;
    showVoiceIndicator(false);
}

function showVoiceIndicator(show) {
    const indicator = document.getElementById('voice-indicator');
    const replayBtn = document.getElementById('btn-replay-instructions');
    
    if (indicator) {
        if (show) indicator.classList.remove('hidden');
        else indicator.classList.add('hidden');
    }
    
    if (replayBtn) {
        if (show) replayBtn.classList.add('hidden');
        else replayBtn.classList.remove('hidden');
    }
}

// ============================================
// METRÓNOMO PARA RCP
// ============================================

function toggleMetronome() {
    const btn = document.getElementById('btn-toggle-metronome');
    const circle = document.getElementById('metronome-circle');
    
    if (AppState.metronomeInterval) {
        // Detener
        clearInterval(AppState.metronomeInterval);
        AppState.metronomeInterval = null;
        if (btn) {
            btn.innerHTML = '<i class="fas fa-play"></i><span>Iniciar compresiones</span>';
        }
        if (circle) circle.classList.remove('beating');
    } else {
        // Iniciar (110 BPM = cada 545ms)
        AppState.compressionCount = 0;
        if (circle) circle.classList.add('beating');
        
        AppState.metronomeInterval = setInterval(() => {
            AppState.compressionCount++;
            if (AppState.compressionCount > 30) AppState.compressionCount = 1;
            
            const countEl = document.getElementById('compression-number');
            if (countEl) countEl.textContent = AppState.compressionCount;
            
            // Sonido de click opcional
            playClickSound();
        }, 545);
        
        if (btn) {
            btn.innerHTML = '<i class="fas fa-pause"></i><span>Detener</span>';
        }
    }
}

function playClickSound() {
    // Sonido muy corto para el ritmo
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        oscillator.frequency.value = 800;
        gainNode.gain.value = 0.1;
        
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.05);
    } catch (e) {
        // Silenciar si no hay soporte de audio
    }
}

function stopMetronome() {
    if (AppState.metronomeInterval) {
        clearInterval(AppState.metronomeInterval);
        AppState.metronomeInterval = null;
    }
}

// ============================================
// TEMPORIZADOR DE EMERGENCIA
// ============================================

function startElapsedTimer() {
    let seconds = 0;
    const timerEl = document.getElementById('elapsed-time');
    const panel = document.getElementById('timer-panel');
    
    if (panel) panel.classList.remove('hidden');
    
    AppState.elapsedTimeInterval = setInterval(() => {
        seconds++;
        const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
        const secs = (seconds % 60).toString().padStart(2, '0');
        
        if (timerEl) timerEl.textContent = `${mins}:${secs}`;
    }, 1000);
}

// ============================================
// ACCIONES DE EMERGENCIA
// ============================================

function call911() {
    window.location.href = 'tel:911';
    showToast('Llamando al 911...');
}

function call911Direct() {
    window.location.href = 'tel:911';
}

function shareLocation() {
    if (!navigator.geolocation) {
        showToast('Geolocalización no disponible');
        return;
    }
    
    showLoading('Obteniendo ubicación...');
    
    navigator.geolocation.getCurrentPosition(
        (position) => {
            hideLoading();
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
            
            // Copiar al portapapeles o compartir
            if (navigator.share) {
                navigator.share({
                    title: 'Mi ubicación - Emergencia',
                    text: 'Necesito ayuda médica urgente en esta ubicación:',
                    url: mapsUrl
                });
            } else {
                // Fallback: mostrar en pantalla
                window.open(mapsUrl, '_blank');
            }
        },
        (error) => {
            hideLoading();
            showToast('No se pudo obtener ubicación');
        },
        CONFIG.GEO_OPTIONS
    );
}

function markAsResolved() {
    document.getElementById('modal-resolve').classList.remove('hidden');
}

function saveResolution() {
    const outcome = document.getElementById('resolve-outcome').value;
    const notes = document.getElementById('resolve-notes').value;
    
    if (!outcome) {
        showToast('Seleccione un resultado');
        return;
    }
    
    // Guardar en historial local
    const emergency = {
        type: AppState.currentEmergencyType,
        title: EMERGENCY_GUIDES[AppState.currentEmergencyType]?.title || 'Emergencia',
        date: new Date().toISOString(),
        outcome: outcome,
        notes: notes,
        duration: document.getElementById('elapsed-time')?.textContent || '00:00'
    };
    
    let history = JSON.parse(localStorage.getItem('emergency_history') || '[]');
    history.unshift(emergency);
    localStorage.setItem('emergency_history', JSON.stringify(history));
    
    closeModal('modal-resolve');
    showToast('Emergencia guardada en historial');
    backHome();
}

// ============================================
// FORMULARIO MÉDICO
// ============================================

function showMedicalProfile() {
    document.getElementById('medical-form-title').textContent = 'Mi Ficha Médica';
    document.getElementById('btn-skip-medical').style.display = 'block';
    showScreen('screen-medical-form');
    loadMedicalForm();
}

function editMedicalProfile() {
    showMedicalProfile();
}

function loadMedicalForm() {
    const profile = JSON.parse(localStorage.getItem('medical_profile'));
    if (!profile) return;
    
    document.getElementById('med-name').value = profile.name || '';
    document.getElementById('med-age').value = profile.age || '';
    document.getElementById('med-gender').value = profile.gender || '';
    document.getElementById('med-blood').value = profile.bloodType || '';
    document.getElementById('med-allergies').value = profile.allergies || '';
    document.getElementById('med-medications').value = profile.medications || '';
    document.getElementById('med-contact-name').value = profile.contactName || '';
    document.getElementById('med-contact-phone').value = profile.contactPhone || '';
    document.getElementById('med-insurance').value = profile.insurance || '';
    document.getElementById('med-policy').value = profile.policyNumber || '';
    
    // Marcar tipo de sangre
    document.querySelectorAll('.blood-btn').forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.value === profile.bloodType);
    });
    
    // Marcar condiciones
    document.querySelectorAll('.condition-item input').forEach(cb => {
        cb.checked = profile.conditions?.includes(cb.value) || false;
    });
}

function initBloodTypeButtons() {
    document.querySelectorAll('.blood-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.blood-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            document.getElementById('med-blood').value = btn.dataset.value;
        });
    });
}

function saveMedicalData() {
    const profile = {
        name: document.getElementById('med-name').value,
        age: document.getElementById('med-age').value,
        gender: document.getElementById('med-gender').value,
        bloodType: document.getElementById('med-blood').value,
        allergies: document.getElementById('med-allergies').value,
        medications: document.getElementById('med-medications').value,
        conditions: Array.from(document.querySelectorAll('.condition-item input:checked')).map(cb => cb.value),
        contactName: document.getElementById('med-contact-name').value,
        contactPhone: document.getElementById('med-contact-phone').value,
        insurance: document.getElementById('med-insurance').value,
        policyNumber: document.getElementById('med-policy').value,
        updatedAt: new Date().toISOString()
    };
    
    if (!profile.name || !profile.age || !profile.bloodType) {
        showToast('Complete los campos obligatorios');
        return;
    }
    
    localStorage.setItem('medical_profile', JSON.stringify(profile));
    AppState.userProfile = profile;
    AppState.hasProfile = true;
    
    showToast('Ficha médica guardada correctamente');
    backHome();
}

function skipMedicalForm() {
    backHome();
}

function loadUserProfile() {
    const profile = JSON.parse(localStorage.getItem('medical_profile'));
    if (profile) {
        AppState.userProfile = profile;
        AppState.hasProfile = true;
    }
}

function updateProfileUI() {
    const widget = document.getElementById('profile-widget');
    const prompt = document.getElementById('profile-prompt');
    const countBadge = document.getElementById('history-count');
    
    if (AppState.hasProfile && widget) {
        widget.classList.remove('hidden');
        if (prompt) prompt.style.display = 'none';
        
        const nameEl = document.getElementById('widget-user-name');
        if (nameEl) nameEl.textContent = AppState.userProfile.name;
    } else if (prompt) {
        prompt.style.display = 'block';
        if (widget) widget.classList.add('hidden');
    }
    
    // Actualizar contador de historial
    const history = JSON.parse(localStorage.getItem('emergency_history') || '[]');
    if (countBadge) countBadge.textContent = history.length;
}

// ============================================
// HOSPITALES CERCANOS
// ============================================

function showHospitalsNearby() {
    showScreen('screen-hospitals');
    initHospitalsMap();
}

function initHospitalsMap() {
    const statusEl = document.getElementById('location-status');
    
    if (!navigator.geolocation) {
        if (statusEl) statusEl.innerHTML = '<i class="fas fa-exclamation-circle"></i> Geolocalización no soportada';
        return;
    }
    
    navigator.geolocation.getCurrentPosition(
        (position) => {
            const { latitude, longitude } = position.coords;
            
            // Cargar Google Maps con hospitales cercanos
            const mapUrl = `https://www.google.com/maps/embed?pb=!1m16!1m12!1m3!1d15000!2d${longitude}!3d${latitude}!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!2m1!1shospital!5e0!3m2!1ses!2smx!4v1`;
            
            const mapContainer = document.getElementById('hospitals-map');
            if (mapContainer) {
                mapContainer.innerHTML = `<iframe width="100%" height="100%" frameborder="0" style="border:0" src="${mapUrl}" allowfullscreen></iframe>`;
            }
            
            if (statusEl) statusEl.innerHTML = '<i class="fas fa-check-circle"></i> Ubicación encontrada';
            
            // Generar lista de hospitales simulada (en producción usar Places API)
            generateHospitalsList(latitude, longitude);
        },
        (error) => {
            console.error('Error de geolocalización:', error);
            if (statusEl) statusEl.innerHTML = '<i class="fas fa-exclamation-circle"></i> Active el GPS para ver hospitales cercanos';
        }
    );
}

function generateHospitalsList(lat, lng) {
    const list = document.getElementById('hospitals-list');
    if (!list) return;
    
    // Hospitales de ejemplo (en producción obtener de Google Places API)
    const hospitals = [
        { name: 'Hospital General', distance: '1.2 km', time: '5 min', phone: '5551234567' },
        { name: 'Hospital de Emergencias', distance: '2.5 km', time: '8 min', phone: '5559876543' },
        { name: 'Centro Médico', distance: '3.1 km', time: '12 min', phone: '5554567890' }
    ];
    
    list.innerHTML = hospitals.map(h => `
        <div class="hospital-item">
            <h4>${h.name}</h4>
            <p>${h.distance} • ${h.time}</p>
            <div class="meta">
                <button onclick="window.location.href='tel:${h.phone}'">
                    <i class="fas fa-phone"></i> Llamar
                </button>
                <button onclick="window.open('https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(h.name)}', '_blank')">
                    <i class="fas fa-directions"></i> Cómo llegar
                </button>
            </div>
        </div>
    `).join('');
}

function refreshHospitals() {
    initHospitalsMap();
}

function backFromHospitals() {
    showScreen('screen-home');
}

// ============================================
// HISTORIAL DE EMERGENCIAS
// ============================================

function showHistory() {
    showScreen('screen-history');
    loadHistory();
}

function loadHistory() {
    const history = JSON.parse(localStorage.getItem('emergency_history') || '[]');
    const list = document.getElementById('history-list');
    const empty = document.getElementById('history-empty');
    const statsTotal = document.getElementById('total-emergencies');
    const statsResolved = document.getElementById('resolved-emergencies');
    
    if (statsTotal) statsTotal.textContent = history.length;
    if (statsResolved) statsResolved.textContent = history.filter(h => h.outcome === 'resolved').length;
    
    if (history.length === 0) {
        if (list) list.innerHTML = '';
        if (empty) empty.style.display = 'block';
        return;
    }
    
    if (empty) empty.style.display = 'none';
    
    if (list) {
        list.innerHTML = history.map(item => `
            <div class="history-item" onclick="showHistoryDetail('${item.date}')">
                <div class="header">
                    <span class="type">${item.title}</span>
                    <span class="date">${new Date(item.date).toLocaleDateString()}</span>
                </div>
                <div class="code">${new Date(item.date).toLocaleTimeString()}</div>
                <div class="details">${item.notes || 'Sin notas adicionales'}</div>
                <span class="outcome ${item.outcome || 'resolved'}">
                    ${getOutcomeText(item.outcome)}
                </span>
            </div>
        `).join('');
    }
}

function getOutcomeText(outcome) {
    const texts = {
        'resolved': 'Resuelto',
        'hospital': 'Hospitalizado',
        'false': 'Falsa alarma',
        'other': 'Otro'
    };
    return texts[outcome] || outcome;
}

function showHistoryDetail(date) {
    // Mostrar detalle en modal
    const history = JSON.parse(localStorage.getItem('emergency_history') || '[]');
    const item = history.find(h => h.date === date);
    if (item) {
        // Implementar vista detallada si es necesario
        showToast('Duración: ' + item.duration);
    }
}

function shareHistoryItem() {
    showToast('Compartiendo...');
}

function filterHistory() {
    showToast('Filtros próximamente');
}

// ============================================
// REPORTES (FRAP)
// ============================================

function submitReport() {
    const report = {
        what: document.getElementById('report-what').value,
        when: document.getElementById('report-when').value,
        where: document.getElementById('report-where').value,
        who: document.getElementById('report-who').value,
        details: document.getElementById('report-details').value,
        actions: document.getElementById('report-actions').value,
        date: new Date().toISOString()
    };
    
    if (!report.what) {
        showToast('Describa qué pasó');
        return;
    }
    
    // Guardar reporte
    let reports = JSON.parse(localStorage.getItem('reports') || '[]');
    reports.push(report);
    localStorage.setItem('reports', JSON.stringify(reports));
    
    showToast('Reporte enviado correctamente');
    backHome();
}

// ============================================
// PRIMEROS AUXILIOS (GUÍA RÁPIDA)
// ============================================

function showFirstAidGuide() {
    showScreen('screen-first-aid');
}

function searchFirstAid(query) {
    const topics = document.querySelectorAll('.aid-topic');
    const lowerQuery = query.toLowerCase();
    
    topics.forEach(topic => {
        const text = topic.textContent.toLowerCase();
        topic.style.display = text.includes(lowerQuery) ? 'flex' : 'none';
    });
}

function showAidDetail(topic) {
    // Mostrar guía específica de primeros auxilios
    AppState.isPracticeMode = true;
    
    const topicToType = {
        'cuts': 'bleeding',
        'burns': 'poison',
        'fractures': 'fall',
        'choking': 'breathing',
        'cpr': 'heart',
        'bleeding': 'bleeding'
    };
    
    if (topicToType[topic]) {
        AppState.currentEmergencyType = topicToType[topic];
        loadGuide(topicToType[topic]);
        showScreen('screen-guide');
    }
}

// ============================================
// CENTRO DE COMANDO (EMERGENCIA ACTIVA)
// ============================================

function startEmergencyProtocol(useProfile) {
    // Simular conexión con centro de comando
    setTimeout(() => {
        showScreen('screen-active-emergency');
        
        // Generar código de caso aleatorio
        const caseNumber = Math.floor(100000 + Math.random() * 900000);
        const caseEl = document.getElementById('active-case-number');
        if (caseEl) caseEl.textContent = caseNumber;
        
        // Simular progreso de ambulancia
        simulateAmbulanceProgress();
        
    }, 2000);
}

function simulateAmbulanceProgress() {
    const bar = document.getElementById('ambulance-progress-bar');
    const etaEl = document.getElementById('eta-time');
    let progress = 0;
    
    const interval = setInterval(() => {
        progress += 2;
        if (bar) bar.style.width = progress + '%';
        
        if (progress >= 100) {
            clearInterval(interval);
            if (etaEl) etaEl.textContent = 'Llegó';
            if (etaEl) etaEl.style.color = '#6EE7B7';
        }
    }, 1000);
}

function showCommandDetails() {
    showToast('Detalles del caso');
}

function speakPatientStatus() {
    if (AppState.userProfile) {
        const text = `Paciente: ${AppState.userProfile.name}, ${AppState.userProfile.age} años, tipo de sangre ${AppState.userProfile.bloodType}. Condiciones: ${AppState.userProfile.conditions?.join(', ') || 'Ninguna'}`;
        speakText(text);
    }
}

function shareLocationCommand() {
    shareLocation();
}

function resolveCase() {
    markAsResolved();
}

// ============================================
// UTILIDADES Y UI
// ============================================

function toggleSettings() {
    document.getElementById('modal-settings').classList.remove('hidden');
}

function closeModal(modalId) {
    document.getElementById(modalId)?.classList.add('hidden');
}

function showToast(message) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

function showLoading(text = 'Cargando...') {
    const overlay = document.getElementById('loading-overlay');
    const textEl = document.getElementById('loading-text');
    if (overlay) overlay.classList.remove('hidden');
    if (textEl) textEl.textContent = text;
}

function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.classList.add('hidden');
}

function clearAllData() {
    if (confirm('¿Está seguro? Se borrarán todas sus fichas e historial.')) {
        localStorage.clear();
        AppState.userProfile = null;
        AppState.hasProfile = false;
        location.reload();
    }
}

// ============================================
// DESCRIPCIÓN DE OTRO PACIENTE
// ============================================

function sendEmergencyOther() {
    const description = document.getElementById('other-description').value;
    const age = document.getElementById('other-age').value;
    const conscious = document.getElementById('other-conscious').value;
    
    if (!description) {
        showToast('Describa al paciente');
        return;
    }
    
    // Guardar datos del "otro" y proceder
    AppState.currentEmergency = {
        forOther: true,
        description: description,
        age: age,
        conscious: conscious,
        alerts: document.getElementById('other-alerts').value
    };
    
    loadGuide(AppState.currentEmergencyType);
    showScreen('screen-guide');
    startEmergencyProtocol(false);
}
