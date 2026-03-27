import React from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix default marker icons for Leaflet + bundler
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
    iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const PICKUP_SPOTS = [
    { name: "🚪 IEC Main Gate", lat: 28.6758, lng: 77.4471, desc: "Easy landmark, security nearby" },
    { name: "🏢 Admin Block Entrance", lat: 28.6762, lng: 77.4479, desc: "Open visibility, easy to coordinate" },
    { name: "📚 Library Entrance", lat: 28.6766, lng: 77.4484, desc: "Well-frequented daytime location" },
    { name: "🍽️ Campus Cafeteria", lat: 28.6761, lng: 77.4489, desc: "Busy common area" },
    { name: "🅿️ Parking Zone A", lat: 28.6754, lng: 77.4482, desc: "Spacious meetup point" },
    { name: "🏠 Hostel Gate", lat: 28.6752, lng: 77.4475, desc: "Monitored and easy to spot" },
];

export default function MapModal({ onClose }) {
    return (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.75)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
            onClick={e => e.target === e.currentTarget && onClose()}>
            <div style={{ background: "#0f172a", border: "1px solid #1f2937", borderRadius: 20, padding: 24, width: "100%", maxWidth: 640, animation: "scaleIn .25s ease" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <h2 style={{ color: "#f9fafb", fontSize: 20, fontWeight: 800, margin: 0 }}>📍 IEC Ghaziabad Meetup Spots</h2>
                    <button onClick={onClose} style={{ background: "none", border: "none", color: "#6b7280", fontSize: 20, cursor: "pointer" }}>✕</button>
                </div>
                <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 16, fontFamily: "'DM Mono', monospace" }}>
                    Safe, well-monitored locations for item exchange inside IEC Ghaziabad Campus
                </p>
                <div style={{ borderRadius: 12, overflow: "hidden", height: 360 }}>
                    <MapContainer center={[28.6758, 77.4479]} zoom={17} style={{ height: "100%", width: "100%" }} scrollWheelZoom={true}>
                        <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        {PICKUP_SPOTS.map((spot, i) => (
                            <Marker key={i} position={[spot.lat, spot.lng]}>
                                <Popup>
                                    <strong>{spot.name}</strong><br />
                                    <span style={{ fontSize: 12 }}>{spot.desc}</span>
                                </Popup>
                            </Marker>
                        ))}
                    </MapContainer>
                </div>
                {/* Spot List */}
                <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {PICKUP_SPOTS.map((spot, i) => (
                        <div key={i} style={{ background: "#111827", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#9ca3af", fontFamily: "'DM Mono', monospace" }}>
                            {spot.name} <span style={{ color: "#4b5563" }}>· {spot.desc}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
