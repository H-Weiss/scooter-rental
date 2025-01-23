const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('database', {
  // Scooters operations
  getScooters: () => ipcRenderer.invoke('getScooters'),
  addScooter: (scooter) => ipcRenderer.invoke('addScooter', scooter),
  updateScooter: (scooter) => ipcRenderer.invoke('updateScooter', scooter),
  deleteScooter: (id) => ipcRenderer.invoke('deleteScooter', id),
  
  // Rentals operations
  getRentals: () => ipcRenderer.invoke('getRentals'),
  addRental: (rental) => ipcRenderer.invoke('addRental', rental),
  updateRental: (rental) => ipcRenderer.invoke('updateRental', rental),
  deleteRental: (id) => ipcRenderer.invoke('deleteRental', id),

  // Database management
  clearDatabase: () => ipcRenderer.invoke('clearDatabase')
});