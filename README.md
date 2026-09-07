# Parking Bay Register Sites App

Hosted Sites version of the parking bay register prototype.

This app is designed for iPad/tablet use. Staff can use separate tabs for staff parking and visitors, assign bays 1 to 10, check people in with a chosen start time, check them out, and review history.

## Features

- Tablet-first dashboard for bays 1 to 10
- Free and occupied bay states
- Name, car registration, notes, and start time capture
- Automatic check-out time
- Visitor sign-in/out with company, host, optional car registration, optional door pass, and optional bay assignment
- Shared bay availability across staff parking and visitors
- Shared hosted storage through Sites D1
- Searchable history

## Data Model

Staff parking sessions are stored in `parking_sessions`. Visitor sign-in records are stored in `visitor_sessions`. Both tables are defined in `db/schema.ts`.

## Local Development

```bash
npm install
npm run db:generate
npm run dev
```

## Build

```bash
npm run build
```

## Existing POC

The original browser-only proof of concept remains in `local-ipad-poc/`. It uses `localStorage` and is useful only for device-local demos.
