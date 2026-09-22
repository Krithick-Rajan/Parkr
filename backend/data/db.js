const fs = require("fs");
const path = require("path");

const dbPath = path.join(__dirname, "db.json");

const initialData = {
  users: [],
  slots: [
    {
      id: "SL-001",
      slotId: "SL-001",
      displayId: "SL-001",
      name: "MG Road Metro Parking",
      location: "MG Road, Bengaluru",
      address: "12/4 MG Road, near Metro Station, Bengaluru",
      lat: 12.9756,
      lng: 77.6067,
      price: 50,
      pricePerHour: 50,
      vehicle: "Car",
      vehicleType: "Car",
      total: 25,
      totalSlots: 25,
      available: 25,
      availableSlots: 25,
      status: "approved",
      verificationStatus: "approved",
      availabilityStatus: "available",
      rating: 4.8,
      open: "06:00",
      close: "23:00",
      ownerId: "USR-002",
      owner: "Sri",
      ownerEmail: "sri@parkr.com",
      features: ["CCTV", "Covered", "Security Guard", "EV Charging"]
    },
    {
      id: "SL-002",
      slotId: "SL-002",
      displayId: "SL-002",
      name: "Indiranagar 100ft Space",
      location: "100 Feet Rd, Indiranagar, Bengaluru",
      address: "454 100 Feet Rd, Indiranagar, Bengaluru",
      lat: 12.9784,
      lng: 77.6408,
      price: 35,
      pricePerHour: 35,
      vehicle: "Bike",
      vehicleType: "Bike",
      total: 40,
      totalSlots: 40,
      available: 40,
      availableSlots: 40,
      status: "approved",
      verificationStatus: "approved",
      availabilityStatus: "available",
      rating: 4.6,
      open: "07:00",
      close: "22:00",
      ownerId: "USR-002",
      owner: "Sri",
      ownerEmail: "sri@parkr.com",
      features: ["CCTV", "Well Lit", "Easy Exit"]
    },
    {
      id: "SL-003",
      slotId: "SL-003",
      displayId: "SL-003",
      name: "Koramangala 5th Block Hub",
      location: "5th Block, Koramangala, Bengaluru",
      address: "18 80 Feet Road, 5th Block Koramangala, Bengaluru",
      lat: 12.9352,
      lng: 77.6245,
      price: 60,
      pricePerHour: 60,
      vehicle: "Car",
      vehicleType: "Car",
      total: 20,
      totalSlots: 20,
      available: 20,
      availableSlots: 20,
      status: "approved",
      verificationStatus: "approved",
      availabilityStatus: "available",
      rating: 4.9,
      open: "08:00",
      close: "23:59",
      ownerId: "USR-002",
      owner: "Sri",
      ownerEmail: "sri@parkr.com",
      features: ["Valet Assistance", "Covered", "CCTV", "24/7 Access"]
    }
  ],
  bookings: [],
  payments: []
};

function readDb() {
  try {
    if (!fs.existsSync(dbPath)) {
      fs.mkdirSync(path.dirname(dbPath), { recursive: true });
      fs.writeFileSync(dbPath, JSON.stringify(initialData, null, 2), "utf8");
      return JSON.parse(JSON.stringify(initialData));
    }
    const content = fs.readFileSync(dbPath, "utf8");
    return JSON.parse(content || "{}");
  } catch (error) {
    console.error("[DB] Failed to read db.json, returning initial fallback:", error.message);
    return JSON.parse(JSON.stringify(initialData));
  }
}

function writeDb(data) {
  try {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), "utf8");
  } catch (error) {
    console.error("[DB] Failed to write db.json:", error.message);
  }
}

module.exports = {
  readDb,
  writeDb
};
