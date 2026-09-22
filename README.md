# Parkr — Smart Parking Slot Sharing Marketplace

<div align="center">

<img src="public/assets/images/logo/parkr-logo-orange.svg" alt="Parkr Logo" width="180">

<h3>Connect Drivers with Verified Parking Spaces</h3>

<p>
A full-stack parking marketplace that connects drivers with parking-space owners through searchable listings, interactive maps, slot reservations, payment workflows, and administrator verification.
</p>

</div>

## Table of Contents

- [Overview](#overview)
- [Problem Statement](#problem-statement)
- [Objectives](#objectives)
- [Key Features](#key-features)
- [User Roles](#user-roles)
- [System Architecture](#system-architecture)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Environment Configuration](#environment-configuration)
- [Application Workflow](#application-workflow)
- [API Reference](#api-reference)
- [Data Model](#data-model)
- [Security](#security)
- [Deployment](#deployment)
- [Testing and Verification](#testing-and-verification)
- [Future Enhancements](#future-enhancements)
- [Contributing](#contributing)
- [License](#license)
- [Author](#author)

## Overview

**Parkr** is a web-based **parking slot sharing marketplace** designed to make parking-space discovery and reservation easier.

The platform provides three primary workspaces:

- **Drivers** can search for available parking spaces, view locations on an interactive map, make reservations, and manage their bookings.
- **Parking Owners** can publish parking spaces, upload parking-space images, configure pricing and availability, and manage reservations.
- **Administrators** can verify parking listings, manage users, review bookings, and monitor platform-level information.

Parkr uses a hybrid application architecture. The application can use **Firebase Authentication, Cloud Firestore, and Firebase Cloud Storage** for cloud-backed functionality while also supporting a persistent **Node.js/Express JSON data store** for local or offline development.

## Problem Statement

Finding suitable parking in busy areas can be time-consuming, while privately owned parking spaces may remain unused for significant periods.

Parkr addresses this problem by providing a common platform where:

1. Parking owners can make unused parking spaces available.
2. Drivers can discover suitable spaces based on location and requirements.
3. Parking listings can be reviewed before becoming available to users.
4. Drivers can reserve spaces for a specified date and duration.
5. Booking and payment information can be maintained digitally.

## Objectives

The main objectives of Parkr are to:

- Provide a centralized platform for parking-space discovery.
- Allow parking owners to share and manage available spaces.
- Help drivers find parking using an interactive map.
- Support parking-slot reservation and booking management.
- Provide role-based access for drivers, owners, and administrators.
- Support parking-space verification through administrator approval.
- Maintain booking and payment records.
- Provide cloud-backed storage through Firebase.
- Provide a persistent local fallback for development and offline operation.

## Key Features

### Driver Portal

- Interactive **Leaflet.js / OpenStreetMap** map.
- Parking-space search and filtering.
- Vehicle-type filtering such as Car, Bike, and Van.
- Parking price and operating-hour information.
- Date and duration based reservation.
- Booking status and booking history.
- Digital invoice/reference information.
- Payment workflow supporting:
  - UPI QR simulation.
  - Test-card validation.
  - Cash on arrival.

### Parking Owner Portal

- Dashboard with parking and reservation information.
- Add and publish parking spaces.
- Upload parking-space images.
- Support for JPG, PNG, and WEBP images.
- Configure parking price and operating hours.
- Manage slot capacity and availability.
- View incoming reservations.
- Track payment status.
- Submit new listings for administrator verification.

### Administrator Portal

- Platform dashboard.
- Parking-slot verification queue.
- Approve or reject submitted listings.
- User management.
- Booking and transaction monitoring.
- Platform-level reports and analytics.
- Occupancy and revenue information.

### Backend

- Node.js and Express.js REST API.
- Authentication and role-aware request handling.
- Parking-slot CRUD operations.
- Booking management.
- Payment processing workflow.
- Reporting endpoints.
- Persistent JSON fallback database.
- Email notification service using Nodemailer.

## User Roles

| Role | Main Responsibilities |
|---|---|
| **Driver** | Search parking, view locations, reserve spaces, make payments, and manage bookings |
| **Parking Owner** | Add parking spaces, upload images, configure pricing and availability, and manage reservations |
| **Administrator** | Verify listings, manage users, monitor bookings, and review platform information |

Access to workspace functionality should be controlled according to the authenticated user's role.

## System Architecture

<div align="center">

```text
                         +---------------------------+
                         |        Web Browser        |
                         | HTML5 / CSS3 / JavaScript |
                         |     Leaflet + OSM Maps    |
                         +------------+--------------+
                                      |
                                      | HTTP / REST
                                      v
                         +---------------------------+
                         |     Node.js + Express     |
                         |---------------------------|
                         | Authentication            |
                         | Parking Slot Management   |
                         | Booking Management        |
                         | Payment Workflow          |
                         | Reports / Analytics       |
                         | Notification Service      |
                         +------------+--------------+
                                      |
                     +----------------+----------------+
                     |                                 |
                     v                                 v
          +----------------------+          +----------------------+
          |   Firebase Services  |          |  Local JSON Storage  |
          |----------------------|          |----------------------|
          | Firebase Auth        |          | db.json / db.js      |
          | Cloud Firestore      |          | Persistent fallback  |
          | Firebase Storage     |          | Offline development  |
          +----------------------+          +----------------------+
```

</div>

### Architecture Components

#### Frontend

- HTML5
- CSS3
- JavaScript ES6+
- Leaflet.js
- OpenStreetMap

#### Application Server

- Node.js
- Express.js
- REST API

#### Cloud Services

- Firebase Authentication
- Cloud Firestore
- Firebase Cloud Storage

#### Local Persistence

- File-backed JSON database

#### Notifications

- Nodemailer

## Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | HTML5 | Application structure |
| Styling | CSS3 | Responsive user interface |
| Client Logic | JavaScript ES6+ | Application interaction and workflows |
| Maps | Leaflet.js | Interactive map interface |
| Map Data | OpenStreetMap | Map tiles and geographic data |
| Backend | Node.js | Server-side runtime |
| API | Express.js | REST API and routing |
| Authentication | Firebase Authentication | User authentication |
| Database | Cloud Firestore | Cloud NoSQL data storage |
| File Storage | Firebase Cloud Storage | Parking-space images |
| Local Database | JSON / Node.js | Local persistent fallback |
| Email | Nodemailer | Booking and notification emails |
| Deployment | Vercel / Firebase Hosting | Application deployment |
| Version Control | Git / GitHub | Source-code management |

## Project Structure

```text
Parkr/
├── backend/
│   ├── data/
│   │   ├── db.js
│   │   └── db.json
│   ├── routes/
│   │   ├── auth.js
│   │   ├── bookings.js
│   │   ├── payments.js
│   │   ├── reports.js
│   │   └── slots.js
│   ├── services/
│   │   └── notificationService.js
│   └── server.js
│
├── public/
│   ├── index.html
│   ├── login.html
│   ├── register.html
│   ├── driver.html
│   ├── owner.html
│   ├── admin.html
│   └── assets/
│       ├── css/
│       │   ├── auth.css
│       │   ├── components.css
│       │   ├── dashboard.css
│       │   ├── responsive.css
│       │   └── style.css
│       ├── images/
│       │   └── logo/
│       │       ├── parkr-logo.png
│       │       └── parkr-logo-orange.svg
│       └── js/
│           ├── admin.js
│           ├── app.js
│           ├── auth.js
│           ├── driver.js
│           ├── firebase-backend.js
│           ├── home.js
│           ├── models.js
│           ├── owner.js
│           ├── store.js
│           └── utils.js
│
├── firebase/
│   └── firebase-config.js
├── .env.example
├── .gitignore
├── firebase.json
├── firestore.rules
├── package.json
├── package-lock.json
├── README.md
└── vercel.json
```

## Prerequisites

Install the following before running the project:

- **Node.js 18 or later**
- **npm 9 or later**
- **Git**

Verify the installations:

```bash
node --version
npm --version
git --version
```

## Getting Started

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

Create a local `.env` file from the supplied example.

#### Windows PowerShell

```powershell
Copy-Item .env.example .env
```

#### Linux / macOS

```bash
cp .env.example .env
```

Configure the Firebase and other environment values required by the current project implementation.

> Do not commit `.env` or private credentials to GitHub.

### 4. Start the Application

```bash
npm start
```

The application can then be opened at the local development address configured by the project, for example:

```text
http://127.0.0.1:5500
```

If your `package.json` uses a different port, use the port printed by the server.

## Environment Configuration

The repository contains `.env.example` as the configuration template.

Depending on the enabled deployment mode, configuration may include Firebase project settings and notification-service settings.

Example structure:

```env
# Firebase
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

# Notification / Email configuration
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
```

Use the exact variable names already defined in your project's `.env.example`.

### Security Guidelines

- Never commit `.env`.
- Never publish Firebase private credentials.
- Never place SMTP passwords or service credentials in frontend JavaScript.
- Use Firebase Security Rules to protect Firestore and Storage resources.

## Application Workflow

### Driver Workflow

<div align="center">

```text
Register / Login
       |
       v
Driver Dashboard
       |
       v
Search Parking
       |
       v
View Parking on Map
       |
       v
Select Parking Space
       |
       v
Choose Date & Duration
       |
       v
Confirm Booking
       |
       v
Payment
       |
       v
Booking Confirmation
```

</div>

### Parking Owner Workflow

<div align="center">

```text
Register / Login
       |
       v
Owner Dashboard
       |
       v
Add Parking Space
       |
       v
Upload Image
       |
       v
Set Price / Hours / Capacity
       |
       v
Submit Listing
       |
       v
Administrator Verification
       |
       +------ Rejected
       |
       +------ Approved
                 |
                 v
          Listing Available
```

</div>

### Administrator Workflow

<div align="center">

```text
Administrator Login
        |
        v
Admin Dashboard
        |
        +--> Review Users
        |
        +--> Review Parking Listings
        |        |
        |        +--> Approve
        |        |
        |        +--> Reject
        |
        +--> Review Bookings
        |
        +--> Review Reports / Analytics
```

</div>

## API Reference

The backend exposes REST endpoints under:

```text
/api
```

### Parking Slots API

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/slots` | Retrieve parking slots |
| GET | `/api/slots/:id` | Retrieve a specific slot |
| POST | `/api/slots` | Create a parking slot |
| PATCH | `/api/slots/:id` | Update a parking slot |
| DELETE | `/api/slots/:id` | Delete a parking slot |

Example filtering:

```text
GET /api/slots?vehicle=Car&status=approved
```

### Bookings API

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/bookings` | Retrieve bookings |
| POST | `/api/bookings` | Create a booking |
| PATCH | `/api/bookings/:id` | Update booking status |

Supported booking filters include driver and owner identifiers where implemented:

```text
GET /api/bookings?driverId=<id>
GET /api/bookings?ownerId=<id>
```

### Payments API

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/payments/create-order` | Initialize a payment transaction |
| POST | `/api/payments/verify` | Verify a payment result |

### Reports API

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/reports/summary` | Retrieve platform summary information |
| GET | `/api/reports/occupancy` | Retrieve parking occupancy information |

> API availability depends on the backend configuration and current implementation.

## Data Model

Parkr works with the following core entities.

### User

Represents an authenticated platform user.

Typical role values:

```text
Driver
ParkingOwner
Admin
```

### ParkingSlot

Represents a parking space listed by an owner.

Typical information includes:

- Owner
- Location
- Vehicle type
- Price
- Operating hours
- Capacity
- Availability
- Verification/status
- Image information

### Booking

Represents a reservation made by a driver.

Typical information includes:

- Driver
- Parking slot
- Date
- Duration
- Amount
- Booking status
- Payment status

### Payment

Represents payment information associated with a booking.

### Review

Represents user feedback associated with a completed parking interaction where supported.

## Security

Parkr incorporates several security considerations:

- Role-based application access.
- Firebase Authentication for cloud authentication.
- Firestore Security Rules.
- Protected Storage access for uploaded parking images.
- Environment variables for sensitive configuration.
- Server-side API validation.
- Separation of frontend and backend responsibilities.
- Credentials should never be committed to source control.

### Production Security Checklist

Before production deployment:

- [ ] Configure Firebase Authentication.
- [ ] Configure Firebase Security Rules.
- [ ] Review Firestore access permissions.
- [ ] Review Firebase Storage rules.
- [ ] Keep all secrets outside the repository.
- [ ] Validate all API inputs.
- [ ] Restrict administrative operations to authorized users.
- [ ] Use HTTPS in production.
- [ ] Review email-service credentials and permissions.

## Deployment

Parkr includes deployment configuration for **Vercel** and **Firebase Hosting**.

### Deploying to Vercel

The repository contains `vercel.json`.

After installing/configuring the Vercel CLI:

```bash
npx vercel
```

Follow the CLI prompts and configure the required environment variables in the Vercel project.

### Deploying to Firebase Hosting

Authenticate with Firebase:

```bash
firebase login
```

Initialize Firebase Hosting if required:

```bash
firebase init hosting
```

Deploy the application:

```bash
firebase deploy
```

For production deployment, configure Firebase Authentication, Firestore, Storage, and their security rules before exposing the application publicly.

## Testing and Verification

Before deployment, verify the main application workflows.

### Authentication

- [ ] Driver registration works.
- [ ] Parking Owner registration works.
- [ ] Login works.
- [ ] Invalid credentials are rejected.
- [ ] Users are redirected to the correct workspace.

### Parking Management

- [ ] Owner can create a parking listing.
- [ ] Parking image upload works.
- [ ] Listing reaches the administrator verification workflow.
- [ ] Administrator can approve a listing.
- [ ] Administrator can reject a listing.
- [ ] Approved listings become available according to the application workflow.

### Booking

- [ ] Driver can search for parking.
- [ ] Driver can view parking details.
- [ ] Driver can select date and duration.
- [ ] Booking is created successfully.
- [ ] Booking status is updated correctly.

### Payment

- [ ] Payment workflow can be initiated.
- [ ] Payment result is validated.
- [ ] Booking and payment status are synchronized.

### Administration

- [ ] Administrator can inspect users.
- [ ] Administrator can review parking listings.
- [ ] Administrator can inspect booking information.
- [ ] Reports and analytics load correctly.

## Future Enhancements

Potential extensions for Parkr include:

- Real payment gateway integration.
- Advanced geospatial search and route optimization.
- Real-time parking availability.
- Push notifications.
- Mobile application.
- Dynamic pricing.
- Reservation cancellation and refund workflows.
- Enhanced owner and driver reviews.
- Advanced analytics dashboards.
- Automated fraud and duplicate-listing detection.
- Production-grade database migration from JSON fallback storage.

## Contributing

Contributions can be made through the standard Git workflow.

### Create a Feature Branch

```bash
git checkout -b feature/your-feature
```

### Stage Changes

```bash
git add .
```

### Commit Changes

```bash
git commit -m "feat: describe your change"
```

### Push the Branch

```bash
git push origin feature/your-feature
```

Then open a Pull Request on GitHub.

### Contribution Guidelines

- Keep changes focused.
- Follow the existing project structure.
- Do not commit secrets or environment files.
- Test affected workflows before submitting changes.
- Update documentation when functionality changes.

## License

This project is licensed under the **MIT License**.

See the `LICENSE` file for the complete license text.

## Author

<div align="center">

<h3>Krithick Rajan</h3>

<p>Computer Science and Engineering Student</p>

<p>
<a href="https://github.com/Krithick-Rajan">GitHub — Krithick-Rajan</a>
</p>

</div>

<div align="center">

<strong>Parkr — Smart Parking Slot Sharing Marketplace</strong>

<p>Built for efficient parking discovery, sharing, and reservation.</p>

</div>
