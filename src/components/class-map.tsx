"use client";

import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export type MapAggregate = {
  city: string;
  count: number;
  lat: number;
  lng: number;
};

function pinIcon(count: number) {
  const size = Math.min(28 + count * 4, 64);
  const fontSize = Math.max(11, Math.round(size / 3.2));
  return L.divIcon({
    className: "",
    html: `<div style="width:${size}px;height:${size}px;background:#e85d45;color:#ffffff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:${fontSize}px;font-family:ui-sans-serif,system-ui,sans-serif;border:2px solid #ffffff;box-shadow:0 1px 3px rgba(31,24,20,0.35);letter-spacing:-0.02em;">${count}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

export function ClassMap({ aggregates }: { aggregates: MapAggregate[] }) {
  return (
    <MapContainer
      center={[25, 0]}
      zoom={2}
      worldCopyJump
      style={{ height: 420, width: "100%" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {aggregates.map((a) => (
        <Marker key={a.city} position={[a.lat, a.lng]} icon={pinIcon(a.count)}>
          <Popup>
            <div style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
              <strong style={{ color: "#1f1814" }}>{a.city}</strong>
              <br />
              <span style={{ color: "#5b4f44" }}>
                {a.count} {a.count === 1 ? "person" : "people"}
              </span>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
