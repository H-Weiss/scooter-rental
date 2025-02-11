const { app, BrowserWindow, ipcMain } = require('electron');
const Store = require('electron-store');
const path = require('path');

// Initialize store
const store = new Store();

if (!store.get('scooters')) {
  store.set('scooters', []);
}
if (!store.get('rentals')) {
  store.set('rentals', []);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs')
    }
  });

  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

const generateOrderNumber = () => {
  const now = new Date()
  const year = now.getFullYear().toString().slice(-2)  // 2025 -> "25"
  const month = (now.getMonth() + 1).toString().padStart(2, '0')  // 1 -> "01"
  const day = now.getDate().toString().padStart(2, '0')  // 1 -> "01"
  
  // קבלת כל ההזמנות מהיום הנוכחי
  const rentals = store.get('rentals') || []
  const todayRentals = rentals.filter(rental => {
    const orderDate = rental.orderNumber?.slice(0, 6) // "250111"
    const today = `${year}${month}${day}` // "250111"
    return orderDate === today
  })

  // יצירת המספר הרץ
  const sequence = (todayRentals.length + 1).toString().padStart(3, '0')  // 1 -> "001"
  
  return `${year}${month}${day}${sequence}`
}

const calculateDailyRate = (days) => {
  if (days > 10) return 800; // Discounted rate for rentals longer than 10 days
  if (days > 5) return 1000; // Discounted rate for rentals between 6 and 10 days
  return 1200; // Base rate for rentals up to 5 days
};

// IPC Handlers
ipcMain.handle('getScooters', () => {
  return store.get('scooters');
});

ipcMain.handle('addScooter', (event, scooter) => {
  const scooters = store.get('scooters') || [];
  const newScooter = { ...scooter, id: Date.now().toString() };
  scooters.push(newScooter);
  store.set('scooters', scooters);
  return newScooter;
});

ipcMain.handle('updateScooter', (event, scooter) => {
  const scooters = store.get('scooters')
  const index = scooters.findIndex(s => s.id === scooter.id)
  
  if (index !== -1) {
    // נמצא את הקטנוע הקיים
    const existingScooter = scooters[index]
    
    // נעדכן את הקטנוע תוך שמירה על כל השדות הקיימים
    const updatedScooter = {
      ...existingScooter,  // שמירה על כל השדות הקיימים
      ...scooter,          // עדכון השדות החדשים
      // וידוא שהשדות החשובים קיימים
      licensePlate: scooter.licensePlate || existingScooter.licensePlate,
      color: scooter.color || existingScooter.color,
      mileage: scooter.mileage !== undefined ? scooter.mileage : existingScooter.mileage,
      year: scooter.year || existingScooter.year,
      status: scooter.status || existingScooter.status
    }
    
    scooters[index] = updatedScooter
    store.set('scooters', scooters)
    return updatedScooter
  }
  
  throw new Error('Scooter not found')
});

ipcMain.handle('deleteScooter', (event, id) => {
  const scooters = store.get('scooters');
  store.set('scooters', scooters.filter(s => s.id !== id));
  return id;
});

ipcMain.handle('getRentals', () => {
  return store.get('rentals');
});

ipcMain.handle('addRental', (event, rental) => {
  const rentals = store.get('rentals') || []
  const newRental = {
    ...rental,
    id: Date.now().toString(),
    orderNumber: generateOrderNumber()  // הוספת מספר הזמנה
  }
  rentals.push(newRental)
  store.set('rentals', rentals)
  return newRental
});

ipcMain.handle('updateRental', (event, rental) => {
  const rentals = store.get('rentals');
  const index = rentals.findIndex(r => r.id === rental.id);
  if (index !== -1) {
    rentals[index] = rental;
    store.set('rentals', rentals);
    return rental;
  }
  throw new Error('Rental not found');
});

ipcMain.handle('deleteRental', (event, id) => {
  const rentals = store.get('rentals');
  const scooters = store.get('scooters');

  // Find the rental to delete
  const rentalToDelete = rentals.find(r => r.id === id);
  if (!rentalToDelete) {
    throw new Error('Rental not found');
  }

  // Ensure the scooter associated with the rental remains intact
  const updatedScooters = scooters.map(scooter => {
    if (scooter.id === rentalToDelete.scooterId) {
      return {
        ...scooter,
        status: 'available', // Reset scooter status to available
      };
    }
    return scooter;
  });

  // Update the store
  store.set('scooters', updatedScooters);
  store.set('rentals', rentals.filter(r => r.id !== id));

  return id;
});

ipcMain.handle('clearDatabase', () => {
  try {
    // מחיקת כל הנתונים
    store.set('scooters', []);
    store.set('rentals', []);
    return { success: true };
  } catch (error) {
    console.error('Error clearing database:', error);
    throw error;
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

const totalAmount = days * calculatedDailyRate; // Final amount after applying discount
const originalAmount = days * 1200; // Original amount without discount