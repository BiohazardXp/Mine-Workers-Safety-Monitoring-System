# Mine Workers’ Safety Monitoring System

# Project Overview
The Mine Workers’ Safety Monitoring System is an **IoT-based real-time monitoring solution** that tracks workers’ vital signs (heart rate, temperature, blood pressure) and environmental conditions (toxic gases, dust, pressure, location).  
It improves worker safety by alerting supervisors when thresholds are exceeded and providing a **React.js real-time dashboard** for visualization.

# Features
- Real-time monitoring of heart rate, temperature, blood pressure
- Hazard detection (CH4, CO, H2S, SO2, NO2, NH3 gases, dust)
- SOS alerts from workers
- Web dashboard for supervisors
- Role-based authentication (admin/supervisor)
- Threshold-based alerts using WebSockets

# Tech Stack
# Frontend
- React.js
- React-Chart.js
- WebSocket client

# Backend
- Node.js + Express.js
- WebSocket (ws)
- MySQL (database)
- MQTT Broker (for IoT device communication)
  
## Hardware
- ESP32 + Zigbee
- Environmental sensors (BME680, gas sensors)
- Vital sensors (heart rate, temperature)


## How to Run
## Frontend
``bash
cd client
npm install
npm run dev

## Backend
- cd server
- node server.js
Make sure you have a web server such as apache for the mySQL database

## Authentication
- username = admin
- password - 123456
