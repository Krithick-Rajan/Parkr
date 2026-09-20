# 🅿️ Parkr — Smart Parking Slot Sharing Marketplace

<div align="center">

![Parkr Logo](assets/images/logo/parkr-logo.png)

### Connect Drivers with Verified Parking Spaces in Real Time
**A modern, full-stack smart parking marketplace featuring interactive Leaflet maps, role-based workspaces, real-time slot verification, instant payments, and dual cloud/offline storage.**

[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-4.x-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![JavaScript](https://img.shields.io/badge/ES6%2B-JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/)
[![Firebase](https://img.shields.io/badge/Firebase-v10-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)](https://firebase.google.com/)
[![Leaflet](https://img.shields.io/badge/Leaflet-v1.9-199900?style=for-the-badge&logo=leaflet&logoColor=white)](https://leafletjs.com/)
[![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](LICENSE)

[Live Demo](http://127.0.0.1:5500) • [Architecture](#-system-architecture--uml-compliance) • [Getting Started](#-getting-started) • [API Reference](#-api-endpoints)

</div>

---

## 📌 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
- [System Architecture & UML Compliance](#-system-architecture--uml-compliance)
- [Technology Stack](#-technology-stack)
- [Project Directory Structure](#-project-directory-structure)
- [Getting Started](#-getting-started)
- [Demo Credentials](#-demo-credentials)
- [API Endpoints](#-api-endpoints)
- [Deployment](#-deployment)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🌟 Overview

Urban parking congestion is a major source of wasted time, excessive fuel consumption, and traffic bottlenecks. **Parkr** bridges this gap with an intuitive two-sided marketplace where:
- **Drivers** easily discover, navigate to, and reserve vetted parking spaces near their destination.
- **Space Owners** monetize vacant driveways, residential plots, or commercial garages with automated bookings and photo-verified listings.
- **Administrators** verify new listings, audit financial transactions, oversee users, and track platform-wide occupancy and revenue analytics.

Parkr is designed with a **hybrid architecture**: it natively supports **Firebase (Authentication, Firestore, and Cloud Storage)** while maintaining a completely zero-config, persistent **Node.js/Express JSON database fallback** so the entire application functions flawlessly offline or without cloud API keys.

---

## 🚀 Key Features

### 🚗 1. Driver Portal (`driver.html`)
- **Interactive OpenStreetMap / Leaflet.js**: Real-time geolocation pins, custom markers for vehicle types, and visual route preview to the destination.
- **Smart Filtering & Search**: Find parking by city/locality, vehicle type (*Car*, *Bike*, *Van*), pricing, and operating hours.
- **Seamless Slot Booking**: Reserve by date and duration with immediate price calculation.
- **Multi-Modal Payment Gateway**:
  - **UPI QR Code Simulator** (Scan & Pay with Google Pay, PhonePe, Paytm).
  - **Zero-Fee Test Cards** with instant validation.
  - **Cash on Arrival** payment option.
- **Booking History & Status**: Track confirmed, ongoing, and past parking sessions with digital invoice reference numbers.

### 🏢 2. Parking Owner Workspace (`owner.html`)
- **Executive Dashboard**: Real-time performance metrics (Total Slots, Active Reservations, Lifetime Earnings, Occupancy %).
- **Add Slot with Photo Upload**:
  - Custom branded upload zone supporting JPG, PNG, and WEBP formats.
  - Live client-side photo preview card with human-readable file size and instant remove/clear capability.
  - Automatic submission to the admin approval queue.
- **Inventory Management**: Update pricing, open/close hours, slot capacity, and toggle availability.
- **Reservations Stream**: Monitor incoming driver reservations and track payment statuses.

### 🛡️ 3. Administrator Hub (`admin.html`)
- **System-Wide Dashboard**: High-level platform statistics (Total Users, Registered Slots, Completed Bookings, Gross Revenue).
- **Slot Verification Queue**: Review submitted owner parking listings and photos; approve or reject with instant status propagation.
- **User Management**: Search, filter, and inspect Driver, Owner, and Admin profiles.
- **Booking & Audit Log**: Comprehensive, real-time ledger of all platform transactions.
- **Analytics & Reporting**: Occupancy rates, popular zones, and revenue trends.

### ⚡ 4. Robust Backend & Services (`backend/`)
- **Modular REST API**: Clean Express.js routing architecture for slots, bookings, payments, auth, and analytics.
- **Persistent Data Store**: Atomic file-backed JSON database engine (`backend/data/db.js`) pre-seeded with realistic Bengaluru parking spots.
- **Automated Notifications**: Nodemailer email delivery for reservation receipts with free Ethereal virtual inbox fallback.
- **Aggressive Caching Control**: Tuned `Cache-Control` headers for sub-millisecond response latency and immediate frontend refresh.

---

## 📐 System Architecture & UML Compliance

Parkr strictly implements all software engineering models specified in standard academic and industry UML/DFD specifications:

```
                      +-----------------------------+
                      |         Web Client          |
                      | (HTML5 / CSS3 / ES6 / Leaflet) |
                      +--------------+--------------+
                                     |
               +---------------------+---------------------+
               | HTTP REST API                             | WebSocket / Firebase SDK
               v                                           v
+------------------------------+             +-------------------------------+
|      Express.js Backend      |             |     Firebase Cloud Suite      |
|  - Auth & Role Middleware    |             |  - Firebase Authentication    |
|  - Booking & Slot Controllers|             |  - Cloud Firestore (NoSQL)    |
|  - Payment Engine            |             |  - Firebase Cloud Storage     |
|  - Nodemailer Email Service  |             +-------------------------------+
+--------------+---------------+
               |
               v
+------------------------------+
| Persistent JSON Data Engine  |
|      (db.json / db.js)       |
+------------------------------+
```

### UML Alignment Highlights
1. **Class Diagram**: Implemented in [`assets/js/models.js`](assets/js/models.js) with OOP class hierarchies:
   - `User` $\to$ `Driver`, `ParkingOwner`, `Admin`
   - `ParkingSlot`, `Booking`, `Payment`, `Review`
2. **Use Case Realization**: Complete end-to-end user journeys for Drivers (Search $\to$ Book $\to$ Pay), Owners (List $\to$ Upload Photo $\to$ Manage), and Admins (Verify $\to$ Audit $\to$ Report).
3. **Data Flow Diagrams (DFD Levels 0, 1, and 2)**: Traced across data stores (`users`, `slots`, `bookings`, `payments`).

---

## 💻 Technology Stack

| Layer | Technology | Usage in Parkr |
|---|---|---|
| **Frontend UI** | HTML5, Modern CSS3, JavaScript (ES6+) | Fully responsive dark-themed dashboard UI, custom CSS variables, zero heavy framework overhead |
| **Mapping & GPS** | Leaflet.js & OpenStreetMap | High-performance, 100% free geospatial map visualization with zero API rate limits |
| **Backend Framework** | Node.js & Express.js | Dedicated RESTful micro-service backend (`/api/*`), route controllers, and static file server |
| **Cloud Authentication** | Firebase Auth | Secure token-based user authentication supporting Driver, Owner, and Admin roles |
| **Cloud Database** | Cloud Firestore | Real-time NoSQL cloud collections (`users`, `parkingSlots`, `bookings`, `payments`) |
| **Cloud Storage** | Firebase Storage | Scalable cloud bucket storage for parking slot verification images |
| **Local Storage Fallback** | File-backed JSON Engine | Built-in persistent database in `backend/data/db.json` for fully autonomous offline execution |
| **Email Delivery** | Nodemailer | Transactional email confirmation engine with Ethereal development inbox |
| **Deployment** | Vercel & Firebase Hosting | Dual deployment profiles via `vercel.json` and `firebase.json` |

---

## 📁 Project Directory Structure

```text
Parkr/
├── .env.example                # Template for environment variables
├── .gitignore                  # Git ignore rules for node_modules, .env, and logs
├── README.md                   # Project documentation
├── firebase.json               # Firebase deployment configuration
├── firestore.rules             # Cloud Firestore security rules
├── package.json                # Project dependencies and npm scripts
├── package-lock.json           # Locked dependency tree
├── vercel.json                 # Vercel serverless deployment config
│
├── index.html                  # Main marketing & discovery landing page
├── login.html                  # Unified role-based authentication portal
├── register.html               # New user onboarding (Driver / Space Owner)
├── driver.html                 # Driver workspace & interactive booking map
├── owner.html                  # Parking owner workspace & slot management
├── admin.html                  # System administrator oversight panel
│
├── assets/
│   ├── css/
│   │   ├── auth.css            # Authentication form styling
│   │   ├── components.css      # Reusable UI component library (cards, modals, badges)
│   │   ├── dashboard.css       # Workspace grid layouts and sidebar styling
│   │   ├── responsive.css      # Mobile, tablet, and widescreen breakpoints
│   │   └── style.css           # Global typography, colors, and base styles
│   ├── images/
│   │   └── logo/
│   │       ├── parkr-logo.png  # Primary Parkr logo
│   │       └── parkr-logo-orange.svg
│   └── js/
│       ├── admin.js            # Admin workspace controller
│       ├── app.js              # Global router, toast system, and session guardian
│       ├── auth.js             # Authentication form validation and role redirector
│       ├── driver.js           # Driver map controller, search, and checkout engine
│       ├── firebase-backend.js # Firebase client initialization & sync layer
│       ├── home.js             # Landing page interactive features
│       ├── models.js           # OOP domain models matching UML class diagram
│       ├── owner.js            # Owner workspace controller & photo upload engine
│       ├── store.js            # Unified reactive data store (Firebase + Local DB)
│       └── utils.js            # Formatting, date parsing, and DOM utilities
│
├── backend/
│   ├── server.js               # Express application entry point
│   ├── data/
│   │   ├── db.js               # Persistent JSON file storage manager
│   │   └── db.json             # Seeded database with parking spots and sample users
│   ├── routes/
│   │   ├── auth.js             # User login and registration endpoints
│   │   ├── bookings.js         # Reservation lifecycle endpoints
│   │   ├── payments.js         # Payment processing and validation
│   │   ├── reports.js          # Aggregated analytics and reporting
│   │   └── slots.js            # Parking slot CRUD and geo-query endpoints
│   └── services/
│       └── notificationService.js # Nodemailer booking alert service
│
├── firebase/
│   └── firebase-config.js      # Public Firebase Web SDK configuration
└── scripts/
    └── dev-server.cjs          # Standalone development static server
```

---

## ⚡ Getting Started

### Prerequisites
- **Node.js**: v18.0.0 or higher ([Download Node.js](https://nodejs.org/))
- **npm**: v9.0.0 or higher
- **Git**: ([Download Git](https://git-scm.com/))

### 1. Clone the Repository
```bash
git clone https://github.com/Krithick-Rajan/Parkr.git
cd Parkr
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Copy the sample environment file:
```bash
# On Windows PowerShell:
Copy-Item .env.example .env

# On Linux / macOS:
cp .env.example .env
```

*(Optional)* If you wish to connect your own Firebase project, configure your keys inside `.env`. If left unconfigured, Parkr automatically runs in **Offline Persistent Mode** without missing any features!

### 4. Run the Application
```bash
npm start
```

Open your browser and visit:
👉 **`http://127.0.0.1:5500`**

---

## 🔑 Demo Credentials

Parkr comes pre-seeded with ready-to-test accounts for all three roles:

| Role | Email Address | Password | Workspace |
|---|---|---|---|
| **Driver** | `arjun@parkr.com` | `driver123` | [driver.html](http://127.0.0.1:5500/driver.html) |
| **Parking Owner** | `harish@parkr.com` | `owner123` | [owner.html](http://127.0.0.1:5500/owner.html) |
| **Administrator** | `krithick@parkr.com` | `admin123` | [admin.html](http://127.0.0.1:5500/admin.html) |

---

## 📡 API Endpoints

The backend exposes a full suite of RESTful API endpoints on `http://127.0.0.1:5500/api`:

### 🚗 Slots API (`/api/slots`)
- `GET /api/slots` — Fetch all parking slots (supports `?vehicle=Car&status=approved` filters).
- `GET /api/slots/:id` — Retrieve specific slot details.
- `POST /api/slots` — Create a new parking slot (Owner).
- `PATCH /api/slots/:id` — Update slot pricing, availability, or status (Owner / Admin).
- `DELETE /api/slots/:id` — Remove a parking slot.

### 📅 Bookings API (`/api/bookings`)
- `GET /api/bookings` — List all reservations (supports `?driverId=...` and `?ownerId=...`).
- `POST /api/bookings` — Create a new reservation and trigger email alert.
- `PATCH /api/bookings/:id` — Update booking status (`confirmed`, `completed`, `cancelled`).

### 💳 Payments API (`/api/payments`)
- `POST /api/payments/create-order` — Initialize payment transaction order.
- `POST /api/payments/verify` — Verify payment receipt and update reservation state.

### 📊 Analytics & Reports API (`/api/reports`)
- `GET /api/reports/summary` — High-level platform KPIs (revenue, active slots, bookings).
- `GET /api/reports/occupancy` — Slot occupancy rates and peak parking hours.

---

## 🚀 Deployment

### Deploying to Vercel
The project includes a ready-to-use [`vercel.json`](vercel.json):
```bash
npx vercel
```

### Deploying to Firebase Hosting
```bash
firebase login
firebase init hosting
firebase deploy
```

---

## 🤝 Contributing

Contributions are welcome! Follow these steps to contribute:
1. Fork the Project.
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`).
3. Commit your Changes (`git commit -m 'feat: add some AmazingFeature'`).
4. Push to the Branch (`git push origin feature/AmazingFeature`).
5. Open a Pull Request.

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">
  <b>Built with ❤️ by <a href="https://github.com/Krithick-Rajan">Krithick Rajan</a></b>
</div>
