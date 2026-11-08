"use client";

import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { useEffect, useMemo, useState } from "react";
import {
  Circle,
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import type { PriceStats, Ranked } from "@/lib/filter";
import { FUEL_SHORT, type Fuel } from "@/lib/fuels";
import { FRANCE_CENTER, FRANCE_ZOOM } from "@/lib/geo";
import { priceStep, priceStepClass } from "@/lib/scale";
import type { Coordinates } from "@/lib/types";

/**
 * Presque 10 000 stations : tout afficher met le navigateur à genoux. On rend
 * juste ce qui est à l'écran, plafonné, les mieux classées d'abord.
 */
const MAX_MARKERS = 500;

interface Props {
  rows: Ranked[];
  stats: PriceStats | null;
  fuel: Fuel | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onPickReference: (position: Coordinates) => void;
  reference: Coordinates | null;
  radiusKm: number;
  /** les ids des stations au prix le plus bas */
  bestIds: ReadonlySet<string>;
}

export default function MapCanvas(props: Props) {
  return (
    <MapContainer
      center={[FRANCE_CENTER.lat, FRANCE_CENTER.lon]}
      zoom={FRANCE_ZOOM}
      minZoom={5}
      maxZoom={18}
      zoomControl={false}
      preferCanvas={false}
      className="h-full w-full"
      attributionControl
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · prix : <a href="https://www.prix-carburants.gouv.fr/">prix-carburants.gouv.fr</a>'
        maxZoom={19}
      />
      <ZoomControl />
      <Layers {...props} />
    </MapContainer>
  );
}

function ZoomControl() {
  const map = useMap();
  useEffect(() => {
    const control = L.control.zoom({ position: "bottomright" });
    control.addTo(map);
    return () => {
      control.remove();
    };
  }, [map]);
  return null;
}

function Layers({
  rows,
  stats,
  fuel,
  selectedId,
  onSelect,
  onPickReference,
  reference,
  radiusKm,
  bestIds,
}: Props) {
  const map = useMap();
  const [bounds, setBounds] = useState<L.LatLngBounds | null>(() =>
    map.getBounds(),
  );

  useMapEvents({
    moveend: () => setBounds(map.getBounds()),
    zoomend: () => setBounds(map.getBounds()),
    click: (event) => {
      onPickReference({ lat: event.latlng.lat, lon: event.latlng.lng });
    },
  });

  // on recentre sur le point de départ
  useEffect(() => {
    if (!reference) return;
    map.flyTo([reference.lat, reference.lon], Math.max(map.getZoom(), 11), {
      duration: 0.8,
    });
  }, [map, reference]);

  // on ramène la station choisie dans le champ
  useEffect(() => {
    if (!selectedId) return;
    const row = rows.find((candidate) => candidate.station.id === selectedId);
    if (!row) return;
    const point = L.latLng(row.station.lat, row.station.lon);
    if (!map.getBounds().contains(point)) {
      map.panTo(point, { animate: true });
    }
  }, [map, rows, selectedId]);

  const visible = useMemo(() => {
    if (!bounds) return rows.slice(0, MAX_MARKERS);

    const inside = rows.filter((row) =>
      bounds.contains(L.latLng(row.station.lat, row.station.lon)),
    );
    if (inside.length <= MAX_MARKERS) return inside;

    // rows est déjà trié, donc couper garde le haut du panier
    const kept = inside.slice(0, MAX_MARKERS);
    if (selectedId && !kept.some((row) => row.station.id === selectedId)) {
      const selected = inside.find((row) => row.station.id === selectedId);
      if (selected) kept[kept.length - 1] = selected;
    }
    return kept;
  }, [bounds, rows, selectedId]);

  return (
    <>
      {reference && (
        <>
          <Circle
            center={[reference.lat, reference.lon]}
            radius={radiusKm * 1000}
            // Leaflet écrit ça dans un attribut SVG, et var() y passe pas : couleur en dur
            pathOptions={{
              color: "#2a78d6",
              weight: 2,
              opacity: 0.55,
              fillOpacity: 0.05,
            }}
          />
          <Marker
            position={[reference.lat, reference.lon]}
            interactive={false}
            icon={L.divIcon({
              className: "",
              html: '<div class="reference-marker"></div>',
              iconSize: [18, 18],
              iconAnchor: [9, 9],
            })}
          />
        </>
      )}

      {visible.map((row) => (
        <StationMarker
          key={row.station.id}
          row={row}
          stats={stats}
          fuel={fuel}
          selected={row.station.id === selectedId}
          best={bestIds.has(row.station.id)}
          onSelect={onSelect}
        />
      ))}
    </>
  );
}

function StationMarker({
  row,
  stats,
  fuel,
  selected,
  best,
  onSelect,
}: {
  row: Ranked;
  stats: PriceStats | null;
  fuel: Fuel | null;
  selected: boolean;
  best: boolean;
  onSelect: (id: string) => void;
}) {
  const { station, price } = row;

  const icon = useMemo(() => {
    const classes = ["price-marker"];
    let label = "";
    let size: [number, number] = [14, 14];

    if (price !== null && stats) {
      classes.push(priceStepClass(priceStep(price, stats)));
      label = price.toFixed(3).replace(".", ",");
      // le texte fait toujours la même largeur
      size = [best ? 60 : 48, 24];
    } else {
      classes.push("price-marker--plain");
    }

    if (best) classes.push("price-marker--best");
    if (selected) classes.push("price-marker--selected");
    // hachures seulement pour les vraies ruptures (les temporaires)
    if (fuel && station.prices[fuel]?.shortage === "temporaire") {
      classes.push("price-marker--shortage");
    }

    const title = `${station.name} — ${station.city}${
      label ? ` — ${label} €` : ""
    }`;

    return L.divIcon({
      className: "",
      html: `<div class="${classes.join(" ")}" title="${escapeHtml(title)}">${
        label ? escapeHtml(label) : ""
      }</div>`,
      iconSize: size,
      iconAnchor: [size[0] / 2, size[1] / 2],
    });
  }, [best, fuel, price, selected, station, stats]);

  return (
    <Marker
      position={[station.lat, station.lon]}
      icon={icon}
      // hors tabulation : des centaines de marqueurs rendraient le clavier
      // inutilisable, la liste latérale est là pour ça
      keyboard={false}
      eventHandlers={{
        click: (event) => {
          // sinon le clic passe à travers et déplace le point de départ
          event.originalEvent.stopPropagation();
          onSelect(station.id);
        },
      }}
    />
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export { MAX_MARKERS };
