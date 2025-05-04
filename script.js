// Configurazione Firebase
const firebaseConfig = {
    apiKey: "AIzaSyBF86Rc7F40wNPABpFqdNYI4ZMLoflNoYY",
    authDomain: "bullybank-d1430.firebaseapp.com",
    projectId: "bullybank-d1430",
    storageBucket: "bullybank-d1430.firebasestorage.app",
    messagingSenderId: "1009938847726",
    appId: "1:1009938847726:web:d49623b2e9b0c98a4760ff"
};

// Inizializza Firebase
firebase.initializeApp(firebaseConfig);

// Riferimenti a servizi Firebase
const db = firebase.firestore();
const auth = firebase.auth();
const googleProvider = new firebase.auth.GoogleAuthProvider();

// Variabile per tenere traccia dell'utente
let currentUser = null;

// Variabile per tenere traccia dello stato privacy
let privacyMode = false;

// Controlla se l'utente è già loggato all'avvio
auth.onAuthStateChanged((user) => {
    // Mostra il contenuto di login e nascondi lo spinner dopo la verifica
    const showLoginContent = () => {
        document.getElementById('auth-spinner').style.display = 'none';
        document.getElementById('login-content').style.display = 'block';
    };

    if (user) {
        currentUser = user;
        console.log('Utente già loggato:', user.displayName);
        hideLoginScreen();
        checkAndLoadData();
        updateUserInfo();
    } else {
        // Mostra schermata di login con contenuto
        showLoginScreen();
        showLoginContent(); // Mostra i contenuti del login dopo aver verificato che l'utente non è autenticato
    }
});

// Inizializzazione app
document.addEventListener('DOMContentLoaded', function() {
    if (!navigator.onLine) {
        showOfflineMessage();
    }

    // Impostazione tema
    initTheme();
    
    // Inizializzazione dati
    initApp();
    
    // Event listeners
    setupEventListeners();
    
    // Aggiorna dashboard
    updateDashboard();

    registerServiceWorker();
});

// Variabili globali
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let categories = [];
let appData = {
    months: {}
};
let searchText = '';

// Funzione per autenticare con Google
// function signInWithGoogle() {
//     Aggiungi l'opzione di persistent per mantenere la sessione
    // auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
    //     .then(() => {
    //         return auth.signInWithPopup(googleProvider)
    //             .then((result) => {
    //                 currentUser = result.user;
    //                 showToast('Accesso effettuato');
    //                 hideLoginScreen();
    //                 checkAndLoadData();
    //             })
    //             .catch((error) => {
    //                 console.error('Errore durante l\'accesso con Google:', error);
    //                 showToast('Errore: ' + error.message);
    //             });
    //     });
// }

// Funzione per autenticare con Google
function signInWithGoogle() {
    // Nascondi il contenuto di login e mostra lo spinner durante il tentativo di accesso
    document.getElementById('auth-spinner').style.display = 'flex';
    document.getElementById('login-content').style.display = 'none';

    const provider = new firebase.auth.GoogleAuthProvider();

    firebase.auth().signInWithPopup(provider)
        .then((result) => {
            // Login riuscito
            currentUser = result.user;
            this.updateLoginStatus(true);
            alert('Accesso effettuato come ' + currentUser.displayName, 'success');
        })
        .catch((error) => {
            // Errore login
            console.error("Errore di autenticazione:", error);
            // alert('Errore: Accesso fallito: ' + error.message, 'error');

            // Mostra nuovamente il contenuto di login in caso di errore
            document.getElementById('auth-spinner').style.display = 'none';
            document.getElementById('login-content').style.display = 'block';
        });
}

// Funzione per disconnettersi
function signOut() {
    return auth.signOut()
        .then(() => {
            currentUser = null;
            showToast('Disconnessione effettuata');
            showLoginScreen();
        })
        .catch((error) => {
            console.error('Errore durante la disconnessione:', error);
            // showToast('Errore: ' + error.message);
        });
}

// Funzione per mostrare la schermata di login
function showLoginScreen() {
    const loginScreen = document.getElementById('login-screen');
    const appContainer = document.querySelector('.app-container');

    loginScreen.style.display = 'flex';
    appContainer.style.display = 'none';
}

// Funzione per nascondere la schermata di login
function hideLoginScreen() {
    const loginScreen = document.getElementById('login-screen');
    const appContainer = document.querySelector('.app-container');

    loginScreen.style.display = 'none';
    appContainer.style.display = 'flex';
}

// Funzione per salvare i dati su Firestore
function saveToFirestore() {
    if (!currentUser) {
        showToast('Devi effettuare l\'accesso per salvare i dati');
        return Promise.reject('Utente non autenticato');
    }

    setSyncStatus('syncing');

    const userId = currentUser.uid;
    const dataToSave = {
        appData: appData,
        categories: categories,
        lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
    };

    return db.collection('users').doc(userId).set(dataToSave)
        .then(() => {
            setSyncStatus('success', 'Sincronizzato');
            return true;
        })
        .catch(error => {
            setSyncStatus('error', 'Errore');
            console.error('Errore durante il salvataggio su Firestore:', error);
            throw error;
        });
}

// Funzione per caricare i dati da Firestore
function loadFromFirestore() {
    if (!currentUser) {
        showToast('Devi effettuare l\'accesso per caricare i dati');
        return Promise.reject('Utente non autenticato');
    }

    setSyncStatus('syncing', 'Caricamento...');

    const userId = currentUser.uid;

    return db.collection('users').doc(userId).get()
        .then(doc => {
            if (doc.exists) {
                // Dati trovati su Firestore
                const data = doc.data();

                // Aggiorna i dati locali
                appData = data.appData;
                categories = data.categories;

                // Salva i dati anche localmente
                localStorage.setItem('bullybank-data', JSON.stringify(appData));
                localStorage.setItem('bullybank-categories', JSON.stringify(categories));

                // Aggiorna l'interfaccia
                updateCategoriesUI();
                updateMonthUI();
                updateDashboard();
                updateSpeseFisseList();
                updateTransazioniList();

                setSyncStatus('success', 'Dati caricati');

                return true;
            } else {
                // Nessun dato trovato, carica i dati locali
                loadData();
                setSyncStatus('success', 'Dati locali');

                // Fai un backup iniziale dei dati locali
                saveToFirestore();

                return false;
            }
        })
        .catch(error => {
            setSyncStatus('error', 'Errore');
            console.error('Errore durante il caricamento da Firestore:', error);

            // In caso di errore, carica i dati locali
            loadData();

            throw error;
        });
}

// Funzione per verificare se ci sono dati più recenti nel cloud
function checkAndLoadData() {
    // Prima carica i dati locali
    loadData();

    // Poi verifica se ci sono dati nel cloud
    loadFromFirestore()
        .then(() => {
            // Imposta la sincronizzazione in tempo reale
            setupRealtimeSync();
        })
        .catch(error => {
            console.error('Errore nel caricamento dati iniziale:', error);
        });
}

// Funzione per configurare la sincronizzazione in tempo reale
function setupRealtimeSync() {
    if (!currentUser) return;

    const userId = currentUser.uid;

    // Ascolta modifiche nel database
    const unsubscribe = db.collection('users').doc(userId)
        .onSnapshot(doc => {
            if (doc.exists) {
                const data = doc.data();

                // Ottieni l'ultimo aggiornamento locale
                const lastLocalUpdate = appData.lastModified || '2000-01-01T00:00:00.000Z';

                // Ottieni l'ultimo aggiornamento dal cloud
                const lastServerUpdate = data.lastUpdate ? data.lastUpdate.toDate().toISOString() : '2000-01-01T00:00:00.000Z';

                // Se i dati del cloud sono più recenti, aggiorna localmente
                if (new Date(lastServerUpdate) > new Date(lastLocalUpdate)) {
                    console.log('Dati cloud più recenti, aggiornamento in corso...');

                    // Aggiorna i dati locali
                    appData = data.appData;
                    categories = data.categories;

                    // Salva i dati localmente
                    localStorage.setItem('bullybank-data', JSON.stringify(appData));
                    localStorage.setItem('bullybank-categories', JSON.stringify(categories));

                    // Aggiorna l'interfaccia solo se l'app è visibile
                    if (document.visibilityState === 'visible') {
                        updateCategoriesUI();
                        updateMonthUI();
                        updateDashboard();
                        updateSpeseFisseList();
                        updateTransazioniList();

                        showToast('Dati sincronizzati dal cloud');
                    }

                    setSyncStatus('success', 'Sincronizzato');
                }
            }
        }, error => {
            console.error('Errore nella sincronizzazione in tempo reale:', error);
            setSyncStatus('error', 'Errore sync');
        });

    // Salva la funzione di unsubscribe per poterla chiamare se necessario
    window.unsubscribeFromFirestore = unsubscribe;
}

// Funzione per aggiornare lo stato di sincronizzazione
function setSyncStatus(status, message) {
    const syncStatus = document.getElementById('sync-status');
    if (!syncStatus) return; // Previeni errori se l'elemento non esiste ancora

    const syncText = syncStatus.querySelector('.sync-text');

    syncStatus.className = 'sync-status';

    // Testo predefinito per ogni stato
    let defaultText = 'Non sincronizzato';
    switch (status) {
        case 'syncing':
            defaultText = 'Sincronizzazione...';
            syncStatus.classList.add('syncing');
            break;
        case 'success':
            defaultText = 'Sincronizzato';
            syncStatus.classList.add('success');
            break;
        case 'error':
            defaultText = 'Errore di sincronizzazione';
            syncStatus.classList.add('error');
            break;
    }

    // Imposta il testo visualizzato
    const displayText = message || defaultText;
    syncText.textContent = displayText;

    // Imposta l'attributo data-status per il tooltip su mobile
    syncStatus.setAttribute('data-status', displayText);

    // Reset dopo 3 secondi per 'success'
    if (status === 'success') {
        setTimeout(() => {
            syncStatus.className = 'sync-status';
            syncText.textContent = 'Sincronizzato';
            syncStatus.setAttribute('data-status', 'Sincronizzato');
        }, 3000);
    }
}

// Funzione per aggiornare le informazioni utente
function updateUserInfo() {
    const userNameElement = document.getElementById('user-name');
    const userEmailElement = document.getElementById('user-email');
    const userAvatarElement = document.getElementById('user-avatar');

    if (!userNameElement || !userEmailElement || !userAvatarElement) return;

    if (currentUser) {
        userNameElement.textContent = currentUser.displayName || 'Utente';
        userEmailElement.textContent = currentUser.email;

        // Imposta l'avatar dell'utente
        if (currentUser.photoURL) {
            userAvatarElement.src = currentUser.photoURL;
            userAvatarElement.classList.remove('blank-avatar');
        } else {
            // Se non c'è foto profilo, usa l'icona di un profilo vuoto
            userAvatarElement.src = './icons/blank-profile.svg'; // Useremo un SVG che creeremo
            userAvatarElement.classList.add('blank-avatar');
        }
    } else {
        userNameElement.textContent = '-';
        userEmailElement.textContent = '-';
        userAvatarElement.src = './icons/blank-profile.svg';
        userAvatarElement.classList.add('blank-avatar');
    }
}

// Controllo dello stato della connessione
window.addEventListener('online', function() {
    setSyncStatus('success', 'Online');
    hideOfflineMessage();

    // Se l'utente è autenticato, sincronizza
    if (currentUser) {
        saveToFirestore();
    }
});

window.addEventListener('offline', function() {
    setSyncStatus('error', 'Offline');
    showOfflineMessage();
});

// Funzione per mostrare il messaggio offline
function showOfflineMessage() {
    // Verifica se l'elemento esiste già
    let offlineMsg = document.getElementById('offline-message');

    if (!offlineMsg) {
        // Crea l'elemento se non esiste
        offlineMsg = document.createElement('div');
        offlineMsg.id = 'offline-message';
        offlineMsg.innerHTML = `
            <div class="offline-content">
                <span class="offline-icon">📶</span>
                <span>Connessione internet non disponibile. L'app richiede una connessione per funzionare correttamente.</span>
            </div>
        `;
        document.body.appendChild(offlineMsg);
    }

    // Mostra il messaggio
    offlineMsg.style.display = 'block';
}

// Funzione per nascondere il messaggio offline
function hideOfflineMessage() {
    const offlineMsg = document.getElementById('offline-message');
    if (offlineMsg) {
        offlineMsg.style.display = 'none';
    }
}

// Funzioni di inizializzazione
function initTheme() {
    const themeSelect = document.getElementById('theme-select');

    // Verifica se c'è una preferenza salvata
    let savedTheme = localStorage.getItem('bullybank-theme');

    // Se non c'è una preferenza salvata, imposta 'auto' come default
    if (!savedTheme) {
        savedTheme = 'auto';
        localStorage.setItem('bullybank-theme', 'auto');
    }

    // Applica il tema in base alle preferenze
    if (savedTheme === 'dark' || (savedTheme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.body.classList.add('dark-theme');
    } else {
        document.body.classList.remove('dark-theme');
    }

    // Aggiorna il select nelle impostazioni
    themeSelect.value = savedTheme;

    // Event listener per il select tema
    themeSelect.addEventListener('change', () => {
        const selectedTheme = themeSelect.value;
        localStorage.setItem('bullybank-theme', selectedTheme);

        if (selectedTheme === 'dark' || (selectedTheme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            document.body.classList.add('dark-theme');
        } else {
            document.body.classList.remove('dark-theme');
        }
    });

    // Listener per preferenze di sistema (se impostato su auto)
    if (savedTheme === 'auto') {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
            if (e.matches) {
                document.body.classList.add('dark-theme');
            } else {
                document.body.classList.remove('dark-theme');
            }
        });
    }
}

function initApp() {
    // Carica dati locali
    loadData();

    // Inizializza categorie se non esistono
    if (!categories || categories.length === 0) {
        categories = [
            { id: 'casa', name: 'Casa', color: '#FF9500' },
            { id: 'trasporti', name: 'Trasporti', color: '#FF3B30' },
            { id: 'alimentari', name: 'Alimentari', color: '#34C759' },
            { id: 'utenze', name: 'Utenze', color: '#5AC8FA' },
            { id: 'svago', name: 'Svago', color: '#AF52DE' },
            { id: 'altro', name: 'Altro', color: '#8E8E93' }
        ];
        saveCategories();
    }

    // Inizializza spese fisse globali se non esistono
    if (!appData.speseFisse) {
        appData.speseFisse = [];
        saveData();
    }

    // Inizializza la modalità privacy
    initPrivacy();

    // Aggiorna visualizzazione categorie
    updateCategoriesUI();

    // Inizializza mese corrente se non esiste
    initCurrentMonthData();

    // Aggiorna interfaccia con data corrente
    updateMonthUI();
}

function loadData() {
    try {
        // Carica categorie
        const savedCategories = localStorage.getItem('bullybank-categories');
        if (savedCategories) {
            categories = JSON.parse(savedCategories);
        }
        
        // Carica dati app
        const savedData = localStorage.getItem('bullybank-data');
        if (savedData) {
            appData = JSON.parse(savedData);
        }
    } catch (error) {
        console.error('Errore nel caricamento dei dati:', error);
        showToast('Errore nel caricamento dei dati');
    }
}

// Funzione per gestire il toggle privacy
function togglePrivacy() {
    privacyMode = !privacyMode;

    // Salva la preferenza nel localStorage
    localStorage.setItem('bullybank-privacy-mode', privacyMode ? 'true' : 'false');

    // Se stiamo disattivando la modalità privacy, aggiorna la dashboard
    if (!privacyMode) {
        // Prima rimuovi la classe censored da tutti gli elementi
        document.querySelectorAll('.amount, .list-item-amount').forEach(el => {
            el.classList.remove('censored');
            el.removeAttribute('data-original-text');
        });

        // Poi aggiorna completamente la visualizzazione dei dati
        updateDashboard();

        // Se siamo nella sezione spese fisse, aggiorna anche quella
        if (document.getElementById('spese-fisse').classList.contains('active')) {
            updateSpeseFisseList();
        }

        // Se siamo nella sezione transazioni, aggiorna anche quella
        if (document.getElementById('transazioni').classList.contains('active')) {
            updateTransazioniList();
        }
        
        updatePrivacyUI();
    } else {
        // Se stiamo attivando la modalità privacy, applica la censura
        updatePrivacyUI();
    }
}

// Funzione per applicare lo stato privacy alla UI
function updatePrivacyUI() {
    // Aggiorna il pulsante
    const privacyToggle = document.getElementById('privacy-toggle');
    const privacyIcon = privacyToggle.querySelector('.privacy-icon');

    if (privacyMode) {
        privacyToggle.classList.add('active');
        privacyIcon.textContent = '🔒';
    } else {
        privacyToggle.classList.remove('active');
        privacyIcon.textContent = '👁️';
    }

    // Aggiorna tutti gli elementi con classe amount
    const amountElements = document.querySelectorAll('.amount, .list-item-amount');
    amountElements.forEach(el => {
        if (privacyMode) {
            // Salva il testo originale se non è già stato salvato
            if (!el.hasAttribute('data-original-text')) {
                el.setAttribute('data-original-text', el.textContent);
            }
            el.classList.add('censored');
            // Nascondi il testo originale
            el.innerHTML = '<span>' + el.textContent + '</span>';
        } else {
            // Ripristina il testo originale
            if (el.hasAttribute('data-original-text')) {
                el.textContent = el.getAttribute('data-original-text');
            }
            el.classList.remove('censored');
        }
    });
}

// Inizializzazione della modalità privacy
function initPrivacy() {
    // Carica la preferenza dal localStorage
    const savedPrivacy = localStorage.getItem('bullybank-privacy-mode');
    if (savedPrivacy === 'true') {
        privacyMode = true;
    }

    // Aggiungi event listener al pulsante
    document.getElementById('privacy-toggle').addEventListener('click', togglePrivacy);

    // Applica stato iniziale
    updatePrivacyUI();
}

function saveData() {
    try {
        // Aggiungi il timestamp dell'ultima modifica
        appData.lastModified = new Date().toISOString();

        // Salva localmente
        localStorage.setItem('bullybank-data', JSON.stringify(appData));

        // Salva su Firestore se l'utente è loggato
        if (currentUser) {
            saveToFirestore().catch(error => {
                console.error('Errore nel backup su Firestore:', error);
            });
        }
    } catch (error) {
        console.error('Errore nel salvataggio dei dati:', error);
        showToast('Errore nel salvataggio dei dati');
    }
}

function saveCategories() {
    try {
        // Salva localmente
        localStorage.setItem('bullybank-categories', JSON.stringify(categories));

        // Salva su Firestore se l'utente è loggato
        if (currentUser) {
            saveToFirestore().catch(error => {
                console.error('Errore nel backup su Firestore:', error);
            });
        }
    } catch (error) {
        console.error('Errore nel salvataggio delle categorie:', error);
        showToast('Errore nel salvataggio delle categorie');
    }
}

function initCurrentMonthData() {
    const monthKey = `${currentYear}-${currentMonth}`;

    if (!appData.months[monthKey]) {
        appData.months[monthKey] = {
            stipendio: 0,
            risparmio: 0,
            spendibili: 0,
            entrateExtra: [],
            debiti: [],
            transazioni: [],
            note: "" // Aggiungi campo per le note
        };

        saveData();
    }
}

// Event Listeners
function setupEventListeners() {
    // Navigation
    const navButtons = document.querySelectorAll('.nav-btn');
    navButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const target = this.getAttribute('data-target');
            openSection(target);
        });
    });

    // Bottom Navigation
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const target = this.getAttribute('data-target');
            openSection(target);
            
            // Aggiorna tab attiva
            document.querySelectorAll('.tab-btn').forEach(tab => {
                tab.classList.remove('active');
            });
            this.classList.add('active');
        });
    });
    
    // Month navigation
    document.getElementById('prev-month').addEventListener('click', prevMonth);
    document.getElementById('next-month').addEventListener('click', nextMonth);
    document.getElementById('prev-month-trans').addEventListener('click', prevMonth);
    document.getElementById('next-month-trans').addEventListener('click', nextMonth);

    document.getElementById('search-spese').addEventListener('input', handleSearchInput);
    document.getElementById('clear-search').addEventListener('click', clearSearch);
    
    document.getElementById('stipendio-amount').addEventListener('input', updateStipendioPreview);
    document.getElementById('risparmio-amount').addEventListener('input', updateStipendioPreview);
    
    // Dashboard actions
    document.getElementById('add-stipendio').addEventListener('click', () => {
        openModal('modal-stipendio');
        updateStipendioPreview(); // Aggiorna l'anteprima all'apertura
    });
    document.getElementById('manage-entrate').addEventListener('click', () => {
        updateEntrateExtraList();
        openModal('modal-gestione-entrate');
    });
    document.getElementById('manage-debiti').addEventListener('click', () => {
        updateDebitiList();
        openModal('modal-gestione-debiti');
    });
    
    // Spese fisse
    document.getElementById('add-spesa-fissa').addEventListener('click', () => openModal('modal-spesa-fissa'));
    document.getElementById('add-categoria').addEventListener('click', () => openModal('modal-categoria'));
    document.getElementById('sort-select').addEventListener('change', sortSpeseFisse);
    
    // Impostazioni
    document.getElementById('export-data').addEventListener('click', exportData);
    document.getElementById('import-data').addEventListener('click', () => document.getElementById('import-file').click());
    document.getElementById('import-file').addEventListener('change', importData);
    document.getElementById('reset-data').addEventListener('click', () => openModal('modal-confirm-reset'));
    document.getElementById('manage-categories').addEventListener('click', () => {
        updateCategoriesManagementList();
        openModal('modal-manage-categories');
    });
    
    // Modal forms
    document.getElementById('stipendio-form').addEventListener('submit', handleStipendioSubmit);
    document.getElementById('sottrai-form').addEventListener('submit', handleSottraiSubmit);
    document.getElementById('entrata-form').addEventListener('submit', handleEntrataSubmit);
    document.getElementById('debito-form').addEventListener('submit', handleDebitoSubmit);
    document.getElementById('spesa-fissa-form').addEventListener('submit', handleSpesaFissaSubmit);
    document.getElementById('categoria-form').addEventListener('submit', handleCategoriaSubmit);
    document.getElementById('aggiungi-spendibili-form').addEventListener('submit', handleAggiungiSpendibiliSubmit);
    
    // Reset confirmation
    document.getElementById('cancel-reset').addEventListener('click', () => closeModal('modal-confirm-reset'));
    document.getElementById('confirm-reset').addEventListener('click', resetData);
    
    // Close modals
    const closeButtons = document.querySelectorAll('.close-btn');
    closeButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const modal = this.closest('.modal');
            closeModal(modal.id);
        });
    });
    
    // Chiudi modal cliccando fuori
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                closeModal(this.id);
            }
        });
    });
    
    // Add from manage categories
    document.getElementById('add-category-from-manage').addEventListener('click', () => {
        closeModal('modal-manage-categories');
        openModal('modal-categoria');
    });

    // Gestione nuove entrate/debiti dai modali
    document.getElementById('add-entrata-from-list').addEventListener('click', () => {
        closeModal('modal-gestione-entrate');
        openModal('modal-entrata');
    });

    document.getElementById('add-debito-from-list').addEventListener('click', () => {
        closeModal('modal-gestione-debiti');
        openModal('modal-debito');
    });

    // Note mensili
    document.getElementById('edit-note').addEventListener('click', () => openNoteModal());
    document.getElementById('note-form').addEventListener('submit', handleNoteSubmit);

    // Login con Google
    document.getElementById('google-login-btn').addEventListener('click', signInWithGoogle);

    // Logout
    document.getElementById('logout-btn').addEventListener('click', function() {
        if (confirm('Sei sicuro di voler disconnettere l\'account? I dati rimarranno sincronizzati.')) {
            signOut();
        }
    });

    // Sincronizzazione manuale
    document.getElementById('sync-now-btn').addEventListener('click', function() {
        if (currentUser) {
            saveToFirestore()
                .then(() => {
                    showToast('Sincronizzazione completata');
                })
                .catch(error => {
                    showToast('Errore nella sincronizzazione: ' + error.message);
                });
        } else {
            showToast('Effettua l\'accesso per sincronizzare');
        }
    });
}

// Funzioni di navigazione
function openSection(sectionId) {
    // Nascondi tutte le sezioni
    const sections = document.querySelectorAll('.section');
    sections.forEach(section => {
        section.classList.remove('active');
    });

    // Deseleziona tutti i pulsanti
    const navButtons = document.querySelectorAll('.nav-btn');
    navButtons.forEach(btn => {
        btn.classList.remove('active');
    });

    // Deseleziona tutte le tab
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
        btn.classList.remove('active');
    });

    // Mostra sezione selezionata
    document.getElementById(sectionId).classList.add('active');

    // Attiva il pulsante e la tab corrispondenti
    document.querySelector(`.nav-btn[data-target="${sectionId}"]`).classList.add('active');
    document.querySelector(`.tab-btn[data-target="${sectionId}"]`).classList.add('active');

    // Aggiorna l'interfaccia in base alla sezione
    if (sectionId === 'dashboard') {
        updateDashboard();
    } else if (sectionId === 'spese-fisse') {
        // Reimpostazione del filtro quando si entra nella sezione spese fisse
        // Seleziona la categoria "tutte"
        document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        document.querySelector('.chip[data-categoria="tutte"]').classList.add('active');

        // Pulisci anche il campo di ricerca se esiste
        const searchInput = document.getElementById('search-spese');
        if (searchInput) {
            searchInput.value = '';
            searchText = ''; // Assicurati che anche la variabile globale sia reimpostata

            // Nascondi il pulsante di cancellazione
            const clearButton = document.getElementById('clear-search');
            if (clearButton) {
                clearButton.style.display = 'none';
            }
        }

        // Ora aggiorna la lista senza filtri
        updateSpeseFisseList();
    } else if (sectionId === 'transazioni') {
        updateTransazioniList();
    }
}

function prevMonth() {
    currentMonth--;
    if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
    }
    
    initCurrentMonthData();
    updateMonthUI();
    updateDashboard();
    updateSpeseFisseList();
    updateTransazioniList();
}

function nextMonth() {
    currentMonth++;
    if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
    }
    
    initCurrentMonthData();
    updateMonthUI();
    updateDashboard();
    updateSpeseFisseList();
    updateTransazioniList();
}

// Funzioni aggiornamento UI
function updateMonthUI() {
    const monthNames = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
    const monthName = monthNames[currentMonth];
    
    document.getElementById('current-month').textContent = `${monthName} ${currentYear}`;
    document.getElementById('current-month-trans').textContent = `${monthName} ${currentYear}`;
}

function updateDashboard() {
    const monthKey = `${currentYear}-${currentMonth}`;
    const monthData = appData.months[monthKey];
    
    if (!monthData) return;
    
    // Aggiorna valori
    document.getElementById('stipendio-value').textContent = formatCurrency(monthData.stipendio);
    // Cambia testo del pulsante stipendio in base allo stato
    const stipendioBtn = document.getElementById('add-stipendio');
    if (monthData.stipendio > 0) {
        stipendioBtn.textContent = 'Modifica';
    } else {
        stipendioBtn.textContent = 'Inserisci';
    }
    document.getElementById('risparmi-value').textContent = formatCurrency(monthData.risparmio);
    
    // Calcola spese fisse da array globale
    const speseFisseTotal = appData.speseFisse.reduce((sum, item) => sum + item.amount, 0);
    document.getElementById('spese-fisse-value').textContent = formatCurrency(speseFisseTotal);
    
    // Calcola spendibili sottraendo le spese fisse
    const spendibiliEffettivi = monthData.spendibili - speseFisseTotal;
    document.getElementById('spendibili-value').textContent = formatCurrency(spendibiliEffettivi);
    
    // Cambia colore se spendibili sono negativi
    const spendibiliElement = document.getElementById('spendibili-value');
    if (spendibiliEffettivi < 0) {
        spendibiliElement.style.color = 'var(--danger-color)';
    } else {
        spendibiliElement.style.color = ''; // Reset al colore predefinito
    }
    
    // Calcola e aggiorna entrate extra
    const entrateExtraTotal = monthData.entrateExtra.reduce((sum, item) => sum + item.amount, 0);
    document.getElementById('entrate-extra-value').textContent = formatCurrency(entrateExtraTotal);
    
    // Calcola e aggiorna debiti
    const debitiTotal = monthData.debiti.reduce((sum, item) => sum + item.amount, 0);
    document.getElementById('debiti-value').textContent = formatCurrency(debitiTotal);
    
    // Aggiorna barra progresso risparmi
    if (monthData.stipendio > 0) {
        const risparmiPercentage = (monthData.risparmio / monthData.stipendio) * 100;
        document.getElementById('risparmi-progress').style.width = `${risparmiPercentage}%`;
    } else {
        document.getElementById('risparmi-progress').style.width = '0%';
    }

    // Dopo aver aggiornato tutti i valori, riapplica la censura se necessario
    if (privacyMode) {
        updatePrivacyUI();
    }

    // Aggiorna anteprima note
    updateNotePreview();
}

function updateCategoriesUI() {
    // Aggiorna select categorie nei form
    const categoriesSelect = document.getElementById('spesa-categoria');
    categoriesSelect.innerHTML = '';

    // Crea una copia ordinata delle categorie
    const sortedCategories = [...categories].sort((a, b) => a.name.localeCompare(b.name));

    // Aggiungi le categorie ordinate alfabeticamente
    sortedCategories.forEach(category => {
        const option = document.createElement('option');
        option.value = category.id;
        option.textContent = category.name;
        categoriesSelect.appendChild(option);
    });

    // Aggiorna chip filtro
    const categorieContainer = document.getElementById('categorie-container');

    // Svuota il container completamente
    categorieContainer.innerHTML = '';

    // Aggiungi chip "Tutte" per prima
    const allChip = document.createElement('div');
    allChip.className = 'chip active';
    allChip.setAttribute('data-categoria', 'tutte');
    allChip.textContent = 'Tutte';
    allChip.addEventListener('click', function() {
        document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        this.classList.add('active');
        filterSpeseFisseByCategory('tutte');
    });
    categorieContainer.appendChild(allChip);

    // Aggiungi chip per ogni categoria in ordine alfabetico
    sortedCategories.forEach(category => {
        const chip = document.createElement('div');
        chip.className = 'chip';
        chip.setAttribute('data-categoria', category.id);
        chip.textContent = category.name;
        chip.style.backgroundColor = category.color;
        chip.style.color = getContrastColor(category.color);

        // Event listener per filtro
        chip.addEventListener('click', function() {
            document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
            this.classList.add('active');
            filterSpeseFisseByCategory(this.getAttribute('data-categoria'));
        });

        categorieContainer.appendChild(chip);
    });
}

function updateSpeseFisseList() {
    const speseFisseList = document.getElementById('spese-fisse-list');
    
    // Calcola totale
    const totalSpeseFisse = appData.speseFisse.reduce((sum, spesa) => sum + spesa.amount, 0);
    document.getElementById('totale-spese-fisse').textContent = formatCurrency(totalSpeseFisse);
    
    // Svuota lista
    speseFisseList.innerHTML = '';
    
    // Caso nessuna spesa
    if (appData.speseFisse.length === 0) {
        const noSpese = document.createElement('li');
        noSpese.textContent = 'Nessuna spesa fissa aggiunta';
        noSpese.style.textAlign = 'center';
        noSpese.style.color = 'var(--text-secondary)';
        speseFisseList.appendChild(noSpese);
    } else {
        // Popola lista
        appData.speseFisse.forEach((spesa, index) => {
            const li = document.createElement('li');
            
            const category = categories.find(cat => cat.id === spesa.category) || 
                              { name: 'Categoria eliminata', color: '#8E8E93' };
            
            li.innerHTML = `
                <div class="list-item-info">
                    <div class="list-item-name">${spesa.name}</div>
                    <span class="list-item-category" style="background-color: ${category.color}; color: ${getContrastColor(category.color)}">${category.name}</span>
                </div>
                <div class="list-item-amount">${formatCurrency(spesa.amount)}</div>
                <div class="list-item-actions">
                    <button class="action-icon edit-spesa" data-index="${index}">✏️</button>
                    <button class="action-icon delete-spesa" data-index="${index}">🗑️</button>
                </div>
            `;
            
            speseFisseList.appendChild(li);
        });
        
        // Aggiungi listeners
        document.querySelectorAll('.edit-spesa').forEach(btn => {
            btn.addEventListener('click', () => editSpesaFissa(parseInt(btn.getAttribute('data-index'))));
        });
        
        document.querySelectorAll('.delete-spesa').forEach(btn => {
            btn.addEventListener('click', () => deleteSpesaFissa(parseInt(btn.getAttribute('data-index'))));
        });
    }
    
    // Aggiorna totali per categoria
    updateCategorieTotals(appData.speseFisse);

    // Dopo aver aggiornato tutti i valori, riapplica la censura se necessario
    if (privacyMode) {
        updatePrivacyUI();
    }
}

function updateCategorieTotals(speseFisse) {
    const categorieTotals = {};
    const categoriesList = document.getElementById('categorie-summary-list');
    
    // Calcola totali per categoria
    speseFisse.forEach(spesa => {
        if (!categorieTotals[spesa.category]) {
            categorieTotals[spesa.category] = 0;
        }
        categorieTotals[spesa.category] += spesa.amount;
    });
    
    // Svuota lista
    categoriesList.innerHTML = '';
    
    // Caso nessuna spesa
    if (Object.keys(categorieTotals).length === 0) {
        const noCategories = document.createElement('li');
        noCategories.textContent = 'Nessuna spesa fissa aggiunta';
        noCategories.style.textAlign = 'center';
        noCategories.style.color = 'var(--text-secondary)';
        categoriesList.appendChild(noCategories);
    } else {
        // Popola lista
        Object.keys(categorieTotals).forEach(categoryId => {
            const category = categories.find(cat => cat.id === categoryId) || 
                              { name: 'Categoria eliminata', color: '#8E8E93' };
            
            const li = document.createElement('li');
            li.innerHTML = `
                <div class="list-item-info">
                    <span class="list-item-category" style="background-color: ${category.color}; color: ${getContrastColor(category.color)}">${category.name}</span>
                </div>
                <div class="list-item-amount">${formatCurrency(categorieTotals[categoryId])}</div>
            `;
            
            categoriesList.appendChild(li);
        });
    }

    // Dopo aver aggiornato tutti i valori, riapplica la censura se necessario
    if (privacyMode) {
        updatePrivacyUI();
    }
}

function updateTransazioniList() {
    const monthKey = `${currentYear}-${currentMonth}`;
    const monthData = appData.months[monthKey] || { transazioni: [] };
    const transazioniList = document.getElementById('transactions-list');

    // Svuota lista
    transazioniList.innerHTML = '';

    // Caso nessuna transazione
    if (monthData.transazioni.length === 0) {
        const noTransazioni = document.createElement('li');
        noTransazioni.textContent = 'Nessuna transazione registrata per questo mese';
        noTransazioni.style.textAlign = 'center';
        noTransazioni.style.color = 'var(--text-secondary)';
        transazioniList.appendChild(noTransazioni);
    } else {
        // Ordina transazioni dalla più recente
        const sortedTransazioni = [...monthData.transazioni].sort((a, b) => new Date(b.date) - new Date(a.date));

        // Popola lista
        sortedTransazioni.forEach((transazione, index) => {
            const li = document.createElement('li');

            const date = new Date(transazione.date);
            const formattedDate = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;

            li.innerHTML = `
                <div class="list-item-info">
                    <div class="list-item-name">${transazione.description}</div>
                    <div style="color: var(--text-secondary); font-size: 0.9rem;">${formattedDate}</div>
                </div>
                <div class="list-item-amount" style="color: ${transazione.type === 'entrata' ? 'var(--success-color)' : 'var(--danger-color)'}">
                    ${transazione.type === 'entrata' ? '+' : '-'}${formatCurrency(transazione.amount)}
                </div>
            `;

            transazioniList.appendChild(li);
        });
    }

    // Dopo aver aggiornato tutti i valori, riapplica la censura se necessario
    if (privacyMode) {
        updatePrivacyUI();
    }
}

function deleteTransaction(index) {
    const monthKey = `${currentYear}-${currentMonth}`;
    const monthData = appData.months[monthKey];
    
    // Ordina transazioni allo stesso modo di updateTransazioniList
    const sortedTransazioni = [...monthData.transazioni].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // Ottieni la transazione da eliminare
    const transactionToDelete = sortedTransazioni[index];
    
    // Trova l'indice reale nell'array originale
    const realIndex = monthData.transazioni.findIndex(t => 
        t.description === transactionToDelete.description && 
        t.amount === transactionToDelete.amount && 
        t.date === transactionToDelete.date && 
        t.type === transactionToDelete.type
    );
    
    if (realIndex === -1) {
        showToast('Errore nell\'eliminazione della transazione');
        return;
    }
    
    // Se è una transazione di tipo entrata, sottrai dagli spendibili
    if (transactionToDelete.type === 'entrata' && transactionToDelete.description !== 'Stipendio') {
        monthData.spendibili -= transactionToDelete.amount;
    }
    
    // Rimuovi la transazione
    monthData.transazioni.splice(realIndex, 1);
    
    // Salva e aggiorna
    saveData();
    updateTransazioniList();
    updateDashboard();
    showToast('Transazione eliminata');
}

function updateCategoriesManagementList() {
    const categoriesList = document.getElementById('categories-management-list');
    categoriesList.innerHTML = '';

    categories.forEach((category, index) => {
        const li = document.createElement('li');
        li.innerHTML = `
            <div class="list-item-info">
                <div class="list-item-name">${category.name}</div>
                <div class="color-preview" style="background-color: ${category.color}; width: 20px; height: 20px; border-radius: 50%; display: inline-block; margin-left: 10px;"></div>
            </div>
            <div class="list-item-actions">
                <button class="action-icon edit-category" data-index="${index}">✏️</button>
                <button class="action-icon delete-category" data-index="${index}">🗑️</button>
            </div>
        `;

        categoriesList.appendChild(li);
    });

    // Assicuriamoci che questi event listener funzionino correttamente
    document.querySelectorAll('.edit-category').forEach(btn => {
        btn.addEventListener('click', function() {
            const index = parseInt(this.getAttribute('data-index'));
            editCategory(index);
        });
    });

    document.querySelectorAll('.delete-category').forEach(btn => {
        btn.addEventListener('click', function() {
            const index = parseInt(this.getAttribute('data-index'));
            deleteCategory(index);
        });
    });
}

// Funzioni form handler
function handleStipendioSubmit(e) {
    e.preventDefault();

    const stipendioAmount = parseFloat(document.getElementById('stipendio-amount').value);
    const risparmioAmount = parseFloat(document.getElementById('risparmio-amount').value);

    if (isNaN(stipendioAmount) || isNaN(risparmioAmount)) {
        showToast('Inserisci valori validi');
        return;
    }

    if (risparmioAmount > stipendioAmount) {
        showToast('Il risparmio non può essere maggiore dello stipendio');
        return;
    }

    const monthKey = `${currentYear}-${currentMonth}`;

    // Memorizza i valori attuali
    const currentSpendibili = appData.months[monthKey].spendibili;
    const currentRisparmi = appData.months[monthKey].risparmio;

    // Calcola quanto degli spendibili attuali deriva da entrate extra
    let extraSpendibili = 0;
    let extraRisparmi = 0;

    if (appData.months[monthKey].entrateExtra && appData.months[monthKey].entrateExtra.length > 0) {
        appData.months[monthKey].entrateExtra.forEach(entrata => {
            if (entrata.destination === 'risparmi') {
                extraRisparmi += entrata.amount;
            } else { // 'spendibili' o undefined (retrocompatibilità)
                extraSpendibili += entrata.amount;
            }
        });
    }

    // Calcola valori dallo stipendio
    const spendibiliFromStipendio = stipendioAmount - risparmioAmount;

    // Se lo stipendio era già stato inserito prima, ottieni il vecchio valore
    const oldStipendio = appData.months[monthKey].stipendio;
    const oldRisparmio = appData.months[monthKey].risparmio;

    // Calcola nuovi valori
    const nuoviSpendibili = spendibiliFromStipendio + extraSpendibili;
    const nuoviRisparmi = risparmioAmount + extraRisparmi;

    // Aggiorna dati mese
    appData.months[monthKey].stipendio = stipendioAmount;
    appData.months[monthKey].risparmio = nuoviRisparmi;
    appData.months[monthKey].spendibili = nuoviSpendibili;

    // Controlla se c'è un mese precedente con debiti
    const prevMonthKey = getPreviousMonthKey(monthKey);
    if (appData.months[prevMonthKey] && appData.months[prevMonthKey].debiti.length > 0) {
        const debitiTotale = appData.months[prevMonthKey].debiti.reduce((sum, debito) => sum + debito.amount, 0);

        if (debitiTotale > 0) {
            // Sottrai dai spendibili
            appData.months[monthKey].spendibili -= debitiTotale;

            // Aggiungi transazione
            addTransazione(
                'Debiti dal mese precedente',
                debitiTotale,
                'uscita'
            );

            showToast(`Sottratti ${formatCurrency(debitiTotale)} di debiti dal mese precedente`);
        }
    }

    // Aggiungi transazione
    if (oldStipendio > 0) {
        addTransazione('Modifica stipendio', stipendioAmount, 'entrata');
    } else {
        addTransazione('Stipendio', stipendioAmount, 'entrata');
    }

    // Salva e aggiorna
    saveData();
    updateDashboard();
    closeModal('modal-stipendio');
    showToast(oldStipendio > 0 ? 'Stipendio modificato con successo' : 'Stipendio registrato con successo');

    // Reset form
    e.target.reset();
}

function handleSottraiSubmit(e) {
    e.preventDefault();
    
    const amount = parseFloat(document.getElementById('sottrai-amount').value);
    const description = document.getElementById('sottrai-description').value || 'Spesa';
    
    if (isNaN(amount) || amount <= 0) {
        showToast('Inserisci un importo valido');
        return;
    }
    
    const monthKey = `${currentYear}-${currentMonth}`;
    
    // Verifica se ci sono abbastanza spendibili
    if (amount > appData.months[monthKey].spendibili) {
        showToast('Importo maggiore degli spendibili disponibili');
        return;
    }
    
    // Sottrai dagli spendibili
    appData.months[monthKey].spendibili -= amount;
    
    // Aggiungi transazione
    addTransazione(description, amount, 'uscita');
    
    // Salva e aggiorna
    saveData();
    updateDashboard();
    closeModal('modal-sottrai');
    showToast('Importo sottratto con successo');
    
    // Reset form
    e.target.reset();
}

function handleEntrataSubmit(e) {
    e.preventDefault();

    const amount = parseFloat(document.getElementById('entrata-amount').value);
    const description = document.getElementById('entrata-description').value;
    const destination = document.querySelector('input[name="entrata-destination"]:checked').value;

    if (isNaN(amount) || amount <= 0 || !description) {
        showToast('Compila tutti i campi correttamente');
        return;
    }

    const monthKey = `${currentYear}-${currentMonth}`;

    // Aggiungi entrata extra
    appData.months[monthKey].entrateExtra.push({
        description: description,
        amount: amount,
        destination: destination, // Salva la destinazione
        date: new Date().toISOString()
    });

    // Aggiungi ai spendibili o ai risparmi in base alla scelta
    if (destination === 'spendibili') {
        appData.months[monthKey].spendibili += amount;
    } else {
        appData.months[monthKey].risparmio += amount;
    }

    // Aggiungi transazione
    addTransazione(description, amount, 'entrata');

    // Salva e aggiorna
    saveData();
    updateDashboard();
    closeModal('modal-entrata');
    showToast('Entrata extra aggiunta con successo');

    // Reset form
    e.target.reset();
}

function handleDebitoSubmit(e) {
    e.preventDefault();
    
    const amount = parseFloat(document.getElementById('debito-amount').value);
    const description = document.getElementById('debito-description').value;
    
    if (isNaN(amount) || amount <= 0 || !description) {
        showToast('Compila tutti i campi correttamente');
        return;
    }
    
    const monthKey = `${currentYear}-${currentMonth}`;
    
    // Aggiungi debito
    appData.months[monthKey].debiti.push({
        description: description,
        amount: amount,
        date: new Date().toISOString()
    });
    
    // Aggiungi transazione
    addTransazione(`Debito: ${description}`, amount, 'uscita');
    
    // Salva e aggiorna
    saveData();
    updateDashboard();
    closeModal('modal-debito');
    showToast('Debito aggiunto con successo');
    
    // Reset form
    e.target.reset();
}

function handleSpesaFissaSubmit(e) {
    e.preventDefault();
    
    const nome = document.getElementById('spesa-nome').value;
    const categoria = document.getElementById('spesa-categoria').value;
    const amount = parseFloat(document.getElementById('spesa-amount').value);
    
    if (!nome || !categoria || isNaN(amount) || amount <= 0) {
        showToast('Compila tutti i campi correttamente');
        return;
    }
    
    // Controlla se stiamo modificando una spesa esistente
    const editIndex = e.target.hasAttribute('data-edit-index') ? 
                      parseInt(e.target.getAttribute('data-edit-index')) : -1;
    
    if (editIndex >= 0) {
        // Modifica spesa esistente
        appData.speseFisse[editIndex] = {
            name: nome,
            category: categoria,
            amount: amount
        };
        
        showToast('Spesa fissa aggiornata');
    } else {
        // Aggiungi nuova spesa
        appData.speseFisse.push({
            name: nome,
            category: categoria,
            amount: amount
        });
        
        showToast('Spesa fissa aggiunta');
    }
    
    // Salva e aggiorna
    saveData();
    updateSpeseFisseList();
    updateDashboard();
    closeModal('modal-spesa-fissa');
    
    // Reset form e rimuovi attributo data-edit-index
    e.target.removeAttribute('data-edit-index');
    e.target.reset();
}

function handleCategoriaSubmit(e) {
    e.preventDefault();

    const nome = document.getElementById('categoria-nome').value;
    const colore = document.getElementById('categoria-colore').value;

    if (!nome || !colore) {
        showToast('Compila tutti i campi');
        return;
    }

    // Blocca la creazione di una categoria "Tutte"
    if (nome.toLowerCase() === 'tutte') {
        showToast('Non è possibile creare una categoria "Tutte"');
        return;
    }

    // Controlla se stiamo modificando una categoria esistente
    const editIndex = e.target.hasAttribute('data-edit-index') ?
        parseInt(e.target.getAttribute('data-edit-index')) : -1;

    if (editIndex >= 0) {
        // Modifica categoria esistente
        categories[editIndex].name = nome;
        categories[editIndex].color = colore;

        showToast('Categoria aggiornata');
    } else {
        // Crea nuova categoria
        const categoryId = nome.toLowerCase().replace(/\s+/g, '-');

        // Verifica se esiste già
        if (categories.some(cat => cat.id === categoryId)) {
            showToast('Esiste già una categoria con questo nome');
            return;
        }

        // Aggiungi categoria
        categories.push({
            id: categoryId,
            name: nome,
            color: colore
        });

        showToast('Categoria aggiunta');
    }

    // Salva e aggiorna
    saveCategories();
    updateCategoriesUI();
    closeModal('modal-categoria');

    // Reset form e rimuovi attributo data-edit-index
    e.target.removeAttribute('data-edit-index');
    e.target.reset();
}

function handleAggiungiSpendibiliSubmit(e) {
    e.preventDefault();
    
    const amount = parseFloat(document.getElementById('aggiungi-amount').value);
    const description = document.getElementById('aggiungi-description').value || 'Aggiunta agli spendibili';
    
    if (isNaN(amount) || amount <= 0) {
        showToast('Inserisci un importo valido');
        return;
    }
    
    const monthKey = `${currentYear}-${currentMonth}`;
    
    // Aggiungi agli spendibili
    appData.months[monthKey].spendibili += amount;
    
    // Aggiungi transazione
    addTransazione(description, amount, 'entrata');
    
    // Salva e aggiorna
    saveData();
    updateDashboard();
    closeModal('modal-aggiungi-spendibili');
    showToast('Importo aggiunto con successo');
    
    // Reset form
    e.target.reset();
}

// Funzioni di modifica e cancellazione
function editSpesaFissa(index) {
    const spesa = appData.speseFisse[index];
    
    // Popola form
    document.getElementById('spesa-nome').value = spesa.name;
    document.getElementById('spesa-categoria').value = spesa.category;
    document.getElementById('spesa-amount').value = spesa.amount;
    
    // Aggiungi indice per l'edit
    document.getElementById('spesa-fissa-form').setAttribute('data-edit-index', index);
    
    // Apri modale
    openModal('modal-spesa-fissa');
}

function deleteSpesaFissa(index) {
    // Rimuovi spesa
    appData.speseFisse.splice(index, 1);
    
    // Salva e aggiorna
    saveData();
    updateSpeseFisseList();
    updateDashboard();
    showToast('Spesa fissa eliminata');
}

function editCategory(index) {
    const category = categories[index];
    
    // Popola form
    document.getElementById('categoria-nome').value = category.name;
    document.getElementById('categoria-colore').value = category.color;
    
    // Aggiungi indice per l'edit
    document.getElementById('categoria-form').setAttribute('data-edit-index', index);
    
    // Chiudi modale categorie e apri modale edit
    closeModal('modal-manage-categories');
    openModal('modal-categoria');
}

function deleteCategory(index) {
    // Controlla se ci sono spese con questa categoria
    const categoryId = categories[index].id;
    let categoryUsed = false;

    // Controlla in tutti i mesi
    Object.keys(appData.months).forEach(monthKey => {
        if (appData.months[monthKey].speseFisse && appData.months[monthKey].speseFisse.some(spesa => spesa.category === categoryId)) {
            categoryUsed = true;
        }
    });

    // Controlla anche nelle spese fisse globali
    if (appData.speseFisse && appData.speseFisse.some(spesa => spesa.category === categoryId)) {
        categoryUsed = true;
    }

    if (categoryUsed) {
        showToast('Impossibile eliminare: categoria in uso');
        return;
    }

    // Rimuovi categoria
    categories.splice(index, 1);

    // Salva e aggiorna
    saveCategories();
    updateCategoriesUI();
    updateCategoriesManagementList();
    showToast('Categoria eliminata');
}

// Funzioni di filtro e ordinamento
function sortSpeseFisse() {
    const sortBy = document.getElementById('sort-select').value;

    // Copia array per non modificare l'originale direttamente
    const speseFisse = [...appData.speseFisse];

    switch (sortBy) {
        case 'nome':
            speseFisse.sort((a, b) => a.name.localeCompare(b.name));
            break;
        case 'categoria':
            speseFisse.sort((a, b) => {
                const catA = categories.find(cat => cat.id === a.category)?.name || '';
                const catB = categories.find(cat => cat.id === b.category)?.name || '';
                return catA.localeCompare(catB);
            });
            break;
        case 'costo':
            speseFisse.sort((a, b) => b.amount - a.amount);
            break;
    }

    // Aggiorna array originale
    appData.speseFisse = speseFisse;

    // Salva i dati
    saveData();

    // Aggiorna UI
    updateSpeseFisseList();
}

function filterSpeseFisseByCategory(categoryId) {
    // Aggiorna la classe attiva per la chip selezionata
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    document.querySelector(`.chip[data-categoria="${categoryId}"]`).classList.add('active');

    // Applica i filtri combinati
    applyFilters();
}

// Funzioni per import/export e reset
function exportData() {
    try {
        // Crea oggetto da esportare
        const exportObj = {
            appData: appData,
            categories: categories,
            version: '1.0'
        };
        
        // Converti in JSON
        const jsonStr = JSON.stringify(exportObj);
        
        // Cifra i dati (semplice Base64 per questo esempio)
        const encryptedData = btoa(jsonStr);
        
        // Crea file
        const blob = new Blob([encryptedData], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        
        // Crea link e simula click
        const a = document.createElement('a');
        a.href = url;
        // a.download = `bullybank_backup_${formatDateForFilename()}.bbk`;
        a.download = `bullybank_backup_${formatDateForFilename()}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showToast('Backup esportato con successo');
    } catch (error) {
        console.error('Errore nell\'esportazione dei dati:', error);
        showToast('Errore nell\'esportazione dei dati');
    }
}

function importData(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();

    if(file.name.startsWith("bullybank_backup")){
        reader.onload = function(event) {
            try {
                // Leggi e decifra i dati
                const encryptedData = event.target.result;
                const jsonStr = atob(encryptedData);
                const importedData = JSON.parse(jsonStr);

                // Verifica versione
                if (!importedData.version) {
                    throw new Error('Formato file non valido');
                }

                // Importa dati
                appData = importedData.appData;
                categories = importedData.categories;

                // Salva e aggiorna
                saveData();
                saveCategories();

                // Resetta il file input
                document.getElementById('import-file').value = '';

                // Aggiorna interfaccia
                updateCategoriesUI();
                updateMonthUI();
                updateDashboard();
                updateSpeseFisseList();
                updateTransazioniList();

                showToast('Dati importati con successo');
            } catch (error) {
                console.error('Errore nell\'importazione dei dati:', error);
                showToast('Errore nell\'importazione dei dati');
            }
        };

        reader.readAsText(file);
    }else{
        showToast('File errato');
    }
}

function resetData() {
    // Reset dati
    appData = { months: {} };
    
    // Non resettiamo le categorie per mantenere la personalizzazione
    
    // Salva e aggiorna
    saveData();
    initCurrentMonthData();
    
    // Chiudi modale
    closeModal('modal-confirm-reset');
    showToast('Tutti i dati sono stati cancellati');
    
    // Ricarica la pagina dopo un breve ritardo per permettere la visualizzazione del toast
    setTimeout(function() {
        window.location.reload();
    }, 500);
}

// Funzioni helper
function addTransazione(description, amount, type) {
    const monthKey = `${currentYear}-${currentMonth}`;
    
    appData.months[monthKey].transazioni.push({
        description: description,
        amount: amount,
        type: type,
        date: new Date().toISOString()
    });
}

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.style.display = 'flex';

    // Rimuovi la classe di chiusura se presente
    modal.classList.remove('closing');

    // Aggiungi classe open per attivare l'animazione
    // Piccolo trick: aspetta il prossimo frame per far scattare la transizione
    setTimeout(() => {
        modal.classList.add('open');
    }, 10);

    // Posiziona il focus sul primo input
    const firstInput = modal.querySelector('input');
    if (firstInput) {
        setTimeout(() => firstInput.focus(), 100);
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);

    // Aggiungi la classe di chiusura e rimuovi open
    modal.classList.add('closing');
    modal.classList.remove('open');

    // Nascondi il modale dopo che l'animazione è completa
    setTimeout(() => {
        modal.style.display = 'none';
        modal.classList.remove('closing');

        // Reset form
        const form = modal.querySelector('form');
        if (form) {
            form.reset();

            // Rimuovi attributo data-edit-index se presente
            if (form.hasAttribute('data-edit-index')) {
                form.removeAttribute('data-edit-index');
            }
        }
    }, 300); // Tempo corrispondente alla durata dell'animazione
}

function showToast(message) {
    const toast = document.getElementById('toast-notification');
    const toastMessage = document.getElementById('toast-message');

    toastMessage.textContent = message;
    toast.style.display = 'block';

    // Reset animazione
    toast.classList.remove('visible');

    // Forza reflow
    toast.offsetHeight;

    // Avvia animazione
    toast.classList.add('visible');

    // Aggiungi un piccolo effetto pulsante per attirare l'attenzione
    setTimeout(() => {
        toast.style.animation = 'toast-pulse 1s ease';
    }, 400);

    // Nascondi toast dopo 3 secondi
    setTimeout(() => {
        toast.classList.remove('visible');

        // Dopo che l'animazione di uscita è completa, nascondi l'elemento
        setTimeout(() => {
            toast.style.display = 'none';
            toast.style.animation = '';
        }, 300);
    }, 3000);
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('it-IT', {
        style: 'currency',
        currency: 'EUR'
    }).format(amount);
}

// function formatDateForFilename() {
//     const now = new Date();
//     return `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}`;
// }

function formatDateForFilename() {
    const now = new Date();
    return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
}

function getContrastColor(hexColor) {
    // Rimuovi # se presente
    hexColor = hexColor.replace('#', '');
    
    // Converti in RGB
    const r = parseInt(hexColor.substr(0, 2), 16);
    const g = parseInt(hexColor.substr(2, 2), 16);
    const b = parseInt(hexColor.substr(4, 2), 16);
    
    // Calcola luminosità (formula semplificata)
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    
    // Ritorna bianco o nero in base alla luminosità
    return luminance > 0.5 ? '#000000' : '#FFFFFF';
}

function getPreviousMonthKey(monthKey) {
    const [year, month] = monthKey.split('-').map(Number);
    
    let prevMonth = month - 1;
    let prevYear = year;
    
    if (prevMonth < 0) {
        prevMonth = 11;
        prevYear--;
    }
    
    return `${prevYear}-${prevMonth}`;
}

function updateEntrateExtraList() {
    const monthKey = `${currentYear}-${currentMonth}`;
    const monthData = appData.months[monthKey] || { entrateExtra: [] };
    const entrateList = document.getElementById('entrate-extra-list');

    // Svuota lista
    entrateList.innerHTML = '';

    // Caso nessuna entrata
    if (!monthData.entrateExtra || monthData.entrateExtra.length === 0) {
        const noEntrate = document.createElement('li');
        noEntrate.textContent = 'Nessuna entrata extra per questo mese';
        noEntrate.style.textAlign = 'center';
        noEntrate.style.color = 'var(--text-secondary)';
        entrateList.appendChild(noEntrate);
        return;
    }

    // Popola lista
    monthData.entrateExtra.forEach((entrata, index) => {
        const li = document.createElement('li');

        const date = new Date(entrata.date);
        const formattedDate = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;

        // Determina la destinazione (per retrocompatibilità)
        const destination = entrata.destination || 'spendibili';
        const destinationText = destination === 'spendibili' ? 'Spendibili' : 'Risparmi';

        li.innerHTML = `
            <div class="list-item-info">
                <div class="list-item-name">${entrata.description}</div>
                <div style="color: var(--text-secondary); font-size: 0.9rem;">
                    ${formattedDate} - Destinazione: ${destinationText}
                </div>
            </div>
            <div class="list-item-amount" style="color: var(--success-color)">
                +${formatCurrency(entrata.amount)}
            </div>
            <div class="list-item-actions">
                <button class="action-icon delete-entrata" data-index="${index}">🗑️</button>
            </div>
        `;

        entrateList.appendChild(li);
    });

    // Aggiungi listener per eliminazione
    document.querySelectorAll('.delete-entrata').forEach(btn => {
        btn.addEventListener('click', function() {
            const index = parseInt(this.getAttribute('data-index'));
            deleteEntrataExtra(index);
        });
    });

    // Dopo aver aggiornato tutti i valori, riapplica la censura se necessario
    if (privacyMode) {
        updatePrivacyUI();
    }
}

function updateDebitiList() {
    const monthKey = `${currentYear}-${currentMonth}`;
    const monthData = appData.months[monthKey] || { debiti: [] };
    const debitiList = document.getElementById('debiti-list');

    // Svuota lista
    debitiList.innerHTML = '';

    // Caso nessun debito
    if (!monthData.debiti || monthData.debiti.length === 0) {
        const noDebiti = document.createElement('li');
        noDebiti.textContent = 'Nessun debito per questo mese';
        noDebiti.style.textAlign = 'center';
        noDebiti.style.color = 'var(--text-secondary)';
        debitiList.appendChild(noDebiti);
        return;
    }

    // Popola lista
    monthData.debiti.forEach((debito, index) => {
        const li = document.createElement('li');

        const date = new Date(debito.date);
        const formattedDate = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;

        li.innerHTML = `
            <div class="list-item-info">
                <div class="list-item-name">${debito.description}</div>
                <div style="color: var(--text-secondary); font-size: 0.9rem;">${formattedDate}</div>
            </div>
            <div class="list-item-amount" style="color: var(--danger-color)">
                -${formatCurrency(debito.amount)}
            </div>
            <div class="list-item-actions">
                <button class="action-icon delete-debito" data-index="${index}">🗑️</button>
            </div>
        `;

        debitiList.appendChild(li);
    });

    // Aggiungi listener per eliminazione
    document.querySelectorAll('.delete-debito').forEach(btn => {
        btn.addEventListener('click', function() {
            const index = parseInt(this.getAttribute('data-index'));
            deleteDebito(index);
        });
    });

    // Dopo aver aggiornato tutti i valori, riapplica la censura se necessario
    if (privacyMode) {
        updatePrivacyUI();
    }
}

function deleteEntrataExtra(index) {
    const monthKey = `${currentYear}-${currentMonth}`;
    const monthData = appData.months[monthKey];

    if (!monthData || !monthData.entrateExtra || index >= monthData.entrateExtra.length) {
        showToast('Errore: entrata non trovata');
        return;
    }

    // Ottieni l'entrata da eliminare
    const entrata = monthData.entrateExtra[index];

    // Sottrai dall'area corretta in base alla destinazione
    if (entrata.destination === 'spendibili' || !entrata.destination) { // Per retrocompatibilità
        monthData.spendibili -= entrata.amount;
    } else {
        monthData.risparmio -= entrata.amount;
    }

    // Rimuovi entrata
    monthData.entrateExtra.splice(index, 1);

    // Salva e aggiorna
    saveData();
    updateEntrateExtraList();
    updateDashboard();
    showToast('Entrata extra eliminata');
}

function deleteDebito(index) {
    const monthKey = `${currentYear}-${currentMonth}`;
    const monthData = appData.months[monthKey];

    if (!monthData || !monthData.debiti || index >= monthData.debiti.length) {
        showToast('Errore: debito non trovato');
        return;
    }

    // Rimuovi debito
    monthData.debiti.splice(index, 1);

    // Salva e aggiorna
    saveData();
    updateDebitiList();
    updateDashboard();
    showToast('Debito eliminato');
}

// Funzione per aggiornare l'anteprima
function updateStipendioPreview() {
    const stipendioAmount = parseFloat(document.getElementById('stipendio-amount').value) || 0;
    const risparmioAmount = parseFloat(document.getElementById('risparmio-amount').value) || 0;

    // Calcola spendibili lordi (senza considerare spese fisse)
    const spendibiliLordi = stipendioAmount - risparmioAmount;

    // Ottieni dati mese corrente
    const monthKey = `${currentYear}-${currentMonth}`;
    const monthData = appData.months[monthKey] || { entrateExtra: [], spendibili: 0, risparmio: 0 };

    // Calcola spese fisse
    const speseFisseTotal = appData.speseFisse ? appData.speseFisse.reduce((sum, item) => sum + item.amount, 0) : 0;

    // Calcola entrate extra suddivise per destinazione
    let entrateExtraSpendibili = 0;
    let entrateExtraRisparmi = 0;

    if (monthData.entrateExtra && monthData.entrateExtra.length > 0) {
        monthData.entrateExtra.forEach(entrata => {
            if (entrata.destination === 'risparmi') {
                entrateExtraRisparmi += entrata.amount;
            } else { // 'spendibili' o undefined (retrocompatibilità)
                entrateExtraSpendibili += entrata.amount;
            }
        });
    }

    // Calcola debiti dal mese precedente
    const prevMonthKey = getPreviousMonthKey(monthKey);
    let debitiPrecedenti = 0;

    if (appData.months[prevMonthKey] && appData.months[prevMonthKey].debiti) {
        debitiPrecedenti = appData.months[prevMonthKey].debiti.reduce((sum, debito) => sum + debito.amount, 0);
    }

    // Calcola risparmi totali e spendibili netti
    const risparmiTotali = risparmioAmount + entrateExtraRisparmi;
    const spendibiliNetti = spendibiliLordi + entrateExtraSpendibili - speseFisseTotal - debitiPrecedenti;

    // Aggiorna elementi UI
    document.getElementById('preview-spendibili-lordi').textContent = formatCurrency(spendibiliLordi);
    document.getElementById('preview-spese-fisse').textContent = formatCurrency(speseFisseTotal);
    document.getElementById('preview-entrate-extra-spendibili').textContent = formatCurrency(entrateExtraSpendibili);
    document.getElementById('preview-entrate-extra-risparmi').textContent = formatCurrency(entrateExtraRisparmi);
    document.getElementById('preview-debiti').textContent = formatCurrency(debitiPrecedenti);
    document.getElementById('preview-spendibili-netti').textContent = formatCurrency(spendibiliNetti);

    // Aggiungi questa riga qui, insieme agli altri aggiornamenti degli elementi UI
    document.getElementById('preview-risparmio-base').textContent = formatCurrency(risparmioAmount);

    document.getElementById('preview-risparmi-totali').textContent = formatCurrency(risparmiTotali);

    // Cambia colore se spendibili sono negativi
    const spendibiliElement = document.getElementById('preview-spendibili-netti');
    if (spendibiliNetti < 0) {
        spendibiliElement.style.color = 'var(--danger-color)';
    } else {
        spendibiliElement.style.color = 'var(--success-color)';
    }

    // Dopo aver aggiornato tutti i valori, riapplica la censura se necessario
    if (privacyMode) {
        updatePrivacyUI();
    }
}

// Registrazione del Service Worker (aggiungi alla fine del file script.js)
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', function() {
            navigator.serviceWorker.register('service-worker.js')
                .then(function(registration) {
                    console.log('ServiceWorker registrato con successo: ', registration.scope);
                }, function(err) {
                    console.log('Registrazione ServiceWorker fallita: ', err);
                });
        });
    }
}

// Funzione per aprire il modale delle note
function openNoteModal() {
    const monthKey = `${currentYear}-${currentMonth}`;
    const note = appData.months[monthKey].note || "";

    document.getElementById('note-text').value = note;
    openModal('modal-note');
}

// Funzione per gestire il salvataggio delle note
function handleNoteSubmit(e) {
    e.preventDefault();

    const monthKey = `${currentYear}-${currentMonth}`;
    const noteText = document.getElementById('note-text').value;

    // Salva la nota
    appData.months[monthKey].note = noteText;

    // Aggiorna UI e salva
    updateNotePreview();
    saveData();
    closeModal('modal-note');
    showToast('Nota salvata');
}

// Funzione per aggiornare l'anteprima della nota nella dashboard
function updateNotePreview() {
    const monthKey = `${currentYear}-${currentMonth}`;
    const notePreview = document.getElementById('note-preview');
    const note = appData.months[monthKey].note || "";

    if (note.trim() === "") {
        notePreview.textContent = "Nessuna nota per questo mese";
        notePreview.classList.remove('has-content');
    } else {
        notePreview.textContent = note;
        notePreview.classList.add('has-content');
    }
}

// Funzione per gestire l'input di ricerca
function handleSearchInput(e) {
    searchText = e.target.value.toLowerCase();
    const clearButton = document.getElementById('clear-search');

    // Mostra/nascondi il pulsante di cancellazione
    if (searchText.length > 0) {
        clearButton.style.display = 'block';
    } else {
        clearButton.style.display = 'none';
    }

    // Applica filtri combinati (ricerca + categoria)
    applyFilters();
}

// Funzione per cancellare la ricerca
function clearSearch() {
    document.getElementById('search-spese').value = '';
    searchText = '';
    document.getElementById('clear-search').style.display = 'none';

    // Applica filtri (solo categorie ora)
    applyFilters();
}

// Funzione per applicare tutti i filtri combinati
function applyFilters() {
    // Ottieni la categoria selezionata
    const selectedCategory = document.querySelector('.chip.active').getAttribute('data-categoria');

    // Se non c'è testo di ricerca e la categoria è "tutte",
    // semplicemente aggiorna tutta la lista
    if (searchText === '' && selectedCategory === 'tutte') {
        updateSpeseFisseList();
        return;
    }

    // Altrimenti, filtriamo in base alla ricerca e alla categoria
    filterSpeseFisseBySearchAndCategory(searchText, selectedCategory);
}

// Nuova funzione di filtro combinato per ricerca e categorie
function filterSpeseFisseBySearchAndCategory(query, categoryId) {
    const speseFisseList = document.getElementById('spese-fisse-list');

    // Svuota lista
    speseFisseList.innerHTML = '';

    // Filtra spese in base a categoria e ricerca
    let filteredSpese = [...appData.speseFisse];

    // Filtro per categoria (se non è "tutte")
    if (categoryId !== 'tutte') {
        filteredSpese = filteredSpese.filter(spesa => spesa.category === categoryId);
    }

    // Filtro per testo di ricerca
    if (query !== '') {
        filteredSpese = filteredSpese.filter(spesa =>
            spesa.name.toLowerCase().includes(query)
        );
    }

    // Caso nessuna spesa corrisponde ai filtri
    if (filteredSpese.length === 0) {
        const noSpese = document.createElement('li');
        noSpese.className = 'empty-search-result';
        noSpese.textContent = 'Nessuna spesa corrisponde ai criteri di ricerca';
        speseFisseList.appendChild(noSpese);

        // Aggiorna totale mostrato a zero
        document.getElementById('totale-spese-fisse').textContent = formatCurrency(0);
        return;
    }

    // Popola lista con spese filtrate
    filteredSpese.forEach((spesa) => {
        const li = document.createElement('li');

        const category = categories.find(cat => cat.id === spesa.category) ||
            { name: 'Categoria eliminata', color: '#8E8E93' };

        // Trova l'indice reale nella lista non filtrata
        const realIndex = appData.speseFisse.findIndex(
            s => s.name === spesa.name && s.amount === spesa.amount && s.category === spesa.category
        );

        li.innerHTML = `
            <div class="list-item-info">
                <div class="list-item-name">${spesa.name}</div>
                <span class="list-item-category" style="background-color: ${category.color}; color: ${getContrastColor(category.color)}">${category.name}</span>
            </div>
            <div class="list-item-amount">${formatCurrency(spesa.amount)}</div>
            <div class="list-item-actions">
                <button class="action-icon edit-spesa" data-index="${realIndex}">✏️</button>
                <button class="action-icon delete-spesa" data-index="${realIndex}">🗑️</button>
            </div>
        `;

        speseFisseList.appendChild(li);
    });

    // Aggiungi listeners
    document.querySelectorAll('.edit-spesa').forEach(btn => {
        btn.addEventListener('click', () => editSpesaFissa(parseInt(btn.getAttribute('data-index'))));
    });

    document.querySelectorAll('.delete-spesa').forEach(btn => {
        btn.addEventListener('click', () => deleteSpesaFissa(parseInt(btn.getAttribute('data-index'))));
    });

    // Aggiorna totale mostrato
    const totalFilteredSpese = filteredSpese.reduce((sum, spesa) => sum + spesa.amount, 0);
    document.getElementById('totale-spese-fisse').textContent = formatCurrency(totalFilteredSpese);

    // Dopo aver aggiornato tutti i valori, riapplica la censura se necessario
    if (privacyMode) {
        updatePrivacyUI();
    }
}