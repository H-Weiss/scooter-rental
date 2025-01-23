// Check if we're running in Electron
const isElectron = window.database !== undefined;

if (!isElectron) {
  console.warn('Not running in Electron - database operations will be mocked');
}

// Wrapper functions that either use Electron's database or mock data
export const getScooters = async () => {
  if (isElectron) {
    return await window.database.getScooters();
  }
  throw new Error('Database operations are only available in Electron');
};

export const addScooter = async (scooter) => {
  if (isElectron) {
    return await window.database.addScooter(scooter);
  }
  throw new Error('Database operations are only available in Electron');
};

export const updateScooter = async (scooter) => {
  if (isElectron) {
    return await window.database.updateScooter(scooter);
  }
  throw new Error('Database operations are only available in Electron');
};

export const deleteScooter = async (id) => {
  if (isElectron) {
    return await window.database.deleteScooter(id);
  }
  throw new Error('Database operations are only available in Electron');
};

export const getRentals = async () => {
  if (isElectron) {
    return await window.database.getRentals();
  }
  throw new Error('Database operations are only available in Electron');
};

export const addRental = async (rental) => {
  if (isElectron) {
    return await window.database.addRental(rental);
  }
  throw new Error('Database operations are only available in Electron');
};

export const updateRental = async (rental) => {
  if (isElectron) {
    return await window.database.updateRental(rental);
  }
  throw new Error('Database operations are only available in Electron');
};

export const deleteRental = async (id) => {
  if (isElectron) {
    return await window.database.deleteRental(id);
  }
  throw new Error('Database operations are only available in Electron');
};