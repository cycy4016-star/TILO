// Leaflet/OpenStreetMap island shared by checkout, settings and the public
// rider page. Leaflet is imported in an effect (it touches window at import
// time), so the component is safe in the Next server tree and the map only
// exists in the browser. Markers can be dragged to fine-tune an entrance pin;
// the parent owns the coordinates and receives dragend updates.
'use client';

import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState } from 'react';

export type DeliveryMapMarker = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  kind?: 'store' | 'customer' | 'pickup';
  draggable?: boolean;
};

type DeliveryMapProps = {
  center: { lat: number; lng: number };
  zoom?: number;
  markers: DeliveryMapMarker[];
  /** Draw a dashed straight line between the first two markers. */
  connect?: boolean;
  /** Fired after a draggable marker is dropped. */
  onMarkerMove?: (id: string, coordinates: { lat: number; lng: number }) => void;
  className?: string;
};

function pinIcon(leaflet: typeof import('leaflet'), kind: DeliveryMapMarker['kind']) {
  const color = kind === 'store' ? '#0f766e' : kind === 'customer' ? '#2563eb' : '#ea580c';
  return leaflet.divIcon({
    className: 'tilza-delivery-pin',
    html: `<span style="display:block;width:20px;height:20px;border-radius:9999px;background:${color};border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35)"></span>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

export function DeliveryMap({
  center,
  zoom = 13,
  markers,
  connect = false,
  onMarkerMove,
  className = '',
}: DeliveryMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import('leaflet').Map | null>(null);
  const leafletRef = useRef<typeof import('leaflet') | null>(null);
  const markerLayers = useRef(new Map<string, import('leaflet').Marker>());
  const lineRef = useRef<import('leaflet').Polyline | null>(null);
  const fittedRef = useRef<string | null>(null);
  const onMoveRef = useRef(onMarkerMove);
  const initialCenter = useRef(center);
  const initialZoom = useRef(zoom);
  const [ready, setReady] = useState(false);
  onMoveRef.current = onMarkerMove;

  useEffect(() => {
    let disposed = false;
    let map: import('leaflet').Map | null = null;
    let resizeObserver: ResizeObserver | null = null;

    void import('leaflet').then((leaflet) => {
      if (disposed || !containerRef.current) return;
      leafletRef.current = leaflet;
      map = leaflet
        .map(containerRef.current, { scrollWheelZoom: false })
        .setView([initialCenter.current.lat, initialCenter.current.lng], initialZoom.current);
      leaflet
        .tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 19,
        })
        .addTo(map);
      mapRef.current = map;
      resizeObserver = new ResizeObserver(() => map?.invalidateSize());
      resizeObserver.observe(containerRef.current);
      setReady(true);
    });

    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      markerLayers.current.clear();
      lineRef.current = null;
      map?.remove();
      mapRef.current = null;
      leafletRef.current = null;
      setReady(false);
    };
  }, []);

  // Re-sync layers whenever the parent's coordinates change.
  useEffect(() => {
    const leaflet = leafletRef.current;
    const map = mapRef.current;
    if (!ready || !leaflet || !map) return;

    const seen = new Set<string>();
    for (const marker of markers) {
      seen.add(marker.id);
      const existing = markerLayers.current.get(marker.id);
      if (existing) {
        existing.setLatLng([marker.lat, marker.lng]);
        continue;
      }
      const layer = leaflet.marker([marker.lat, marker.lng], {
        draggable: marker.draggable === true,
        icon: pinIcon(leaflet, marker.kind),
        title: marker.label,
      });
      layer.on('dragend', () => {
        const position = layer.getLatLng();
        onMoveRef.current?.(marker.id, { lat: position.lat, lng: position.lng });
      });
      layer.addTo(map);
      markerLayers.current.set(marker.id, layer);
    }
    for (const [id, layer] of markerLayers.current) {
      if (!seen.has(id)) {
        layer.remove();
        markerLayers.current.delete(id);
      }
    }

    if (connect && markers.length >= 2) {
      const points = markers
        .slice(0, 2)
        .map((marker) => [marker.lat, marker.lng] as [number, number]);
      if (lineRef.current) lineRef.current.setLatLngs(points);
      else {
        lineRef.current = leaflet
          .polyline(points, { color: '#2563eb', weight: 3, dashArray: '6 8' })
          .addTo(map);
      }
    } else if (lineRef.current) {
      lineRef.current.remove();
      lineRef.current = null;
    }

    // Fit only when the set of markers changes, never on a drag update — that
    // would yank the map back under the rider's finger.
    const fitKey = markers.map((marker) => marker.id).join('|');
    if (markers.length >= 2 && fittedRef.current !== fitKey) {
      map.fitBounds(
        leaflet.latLngBounds(markers.map((marker) => [marker.lat, marker.lng] as [number, number])),
        { padding: [36, 36], maxZoom: 16 },
      );
      fittedRef.current = fitKey;
    } else {
      const only = markers[0];
      if (markers.length === 1 && only && fittedRef.current !== fitKey) {
        map.setView([only.lat, only.lng], Math.max(map.getZoom(), 14));
        fittedRef.current = fitKey;
      }
    }
  }, [ready, connect, markers]);

  return (
    <section
      ref={containerRef}
      aria-label="Delivery location map"
      className={`relative z-0 h-56 w-full overflow-hidden rounded-lg border border-border bg-muted ${className}`}
    />
  );
}
