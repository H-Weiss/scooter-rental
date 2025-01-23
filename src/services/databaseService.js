const { ipcRenderer } = window.require('electron')

export const databaseService = {
  // Scooter operations
  getAllScooters: () => ipcRenderer.invoke('get-scooters'),
  getAvailableScooters: () => ipcRenderer.invoke('get-available-scooters'),
  addScooter: (scooter) => ipcRenderer.invoke('add-scooter', scooter),

  // Rental operations
  getActiveRentals: () => ipcRenderer.invoke('get-active-rentals'),
  addRental: (rental) => ipcRenderer.invoke('add-rental', rental)
}