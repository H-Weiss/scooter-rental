const db = window.database;

export const getScooters = async () => {
  try {
    return await db.getScooters();
  } catch (error) {
    console.error('Error fetching scooters:', error);
    throw error;
  }
};

export const addScooter = async (scooter) => {
  try {
    return await db.addScooter(scooter);
  } catch (error) {
    console.error('Error adding scooter:', error);
    throw error;
  }
};

export const updateScooter = async (scooter) => {
  try {
    return await db.updateScooter(scooter);
  } catch (error) {
    console.error('Error updating scooter:', error);
    throw error;
  }
};

export const deleteScooter = async (id) => {
  try {
    return await db.deleteScooter(id);
  } catch (error) {
    console.error('Error deleting scooter:', error);
    throw error;
  }
};

export const getRentals = async () => {
  try {
    return await db.getRentals();
  } catch (error) {
    console.error('Error fetching rentals:', error);
    throw error;
  }
};

export const addRental = async (rental) => {
  try {
    return await db.addRental(rental);
  } catch (error) {
    console.error('Error adding rental:', error);
    throw error;
  }
};

export const updateRental = async (rental) => {
  try {
    return await db.updateRental(rental);
  } catch (error) {
    console.error('Error updating rental:', error);
    throw error;
  }
};

export const deleteRental = async (id) => {
  try {
    return await db.deleteRental(id);
  } catch (error) {
    console.error('Error deleting rental:', error);
    throw error;
  }
};

export const clearDatabase = async () => {
  try {
    return await window.database.clearDatabase();
  } catch (error) {
    console.error('Error clearing database:', error);
    throw error;
  }
};