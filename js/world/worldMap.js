/**
 * worldMap.js
 * World graph: adjacency list of city connections with travel distances.
 * Distance is in "km" - used to calculate travel time for vehicles.
 *
 * Connection graph (undirected):
 *
 *   ironhaven ─────── cogsworth ──── verdania
 *        │                │               │
 *        └──── steamport ─┘           windhollow
 *                  │                      │
 *              millhurst ──────────── crystaldeep
 */

export const CONNECTIONS = [
  { from: 'cogsworth',  to: 'ironhaven',   distance: 120 },
  { from: 'cogsworth',  to: 'steamport',   distance: 180 },
  { from: 'cogsworth',  to: 'verdania',    distance: 150 },
  { from: 'cogsworth',  to: 'millhurst',   distance: 200 },
  { from: 'ironhaven',  to: 'steamport',   distance: 160 },
  { from: 'steamport',  to: 'windhollow',  distance: 140 },
  { from: 'steamport',  to: 'millhurst',   distance: 220 },
  { from: 'verdania',   to: 'windhollow',  distance: 130 },
  { from: 'windhollow', to: 'crystaldeep', distance: 110 },
  { from: 'millhurst',  to: 'crystaldeep', distance: 250 },
  { from: 'millhurst',  to: 'cogsworth',   distance: 200 },
];

/** Build adjacency list from connections */
export function buildAdjacency() {
  const adj = {};
  for (const conn of CONNECTIONS) {
    if (!adj[conn.from]) adj[conn.from] = [];
    if (!adj[conn.to])   adj[conn.to]   = [];
    adj[conn.from].push({ city: conn.to,   distance: conn.distance });
    adj[conn.to].push({   city: conn.from, distance: conn.distance });
  }
  return adj;
}

/** Dijkstra shortest path between two cities */
export function shortestPath(adjList, start, end) {
  const dist  = {};
  const prev  = {};
  const queue = new Set(Object.keys(adjList));

  for (const city of queue) dist[city] = Infinity;
  dist[start] = 0;

  while (queue.size > 0) {
    // Get unvisited city with min distance
    let u = null;
    for (const city of queue) {
      if (u === null || dist[city] < dist[u]) u = city;
    }
    if (u === end || dist[u] === Infinity) break;
    queue.delete(u);

    for (const neighbor of (adjList[u] ?? [])) {
      if (!queue.has(neighbor.city)) continue;
      const alt = dist[u] + neighbor.distance;
      if (alt < dist[neighbor.city]) {
        dist[neighbor.city] = alt;
        prev[neighbor.city] = u;
      }
    }
  }

  if (dist[end] === Infinity) return null; // No path

  const path = [];
  let cur = end;
  while (cur) {
    path.unshift(cur);
    cur = prev[cur];
  }
  return { path, totalDistance: dist[end] };
}

/** Get direct distance between two adjacent cities, or null */
export function getDirectDistance(from, to) {
  const conn = CONNECTIONS.find(
    c => (c.from === from && c.to === to) || (c.from === to && c.to === from)
  );
  return conn?.distance ?? null;
}
