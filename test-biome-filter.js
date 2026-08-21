// Test snap() biome filtering logic
const allForageSources = [
  { harvestType: 'berry', charges: 3, mesh: { position: { x: 8, z: 0 } } },    // meadow
  { harvestType: 'grain', charges: 2, mesh: { position: { x: 9, z: -2 } } },   // meadow
  { harvestType: 'wood', charges: 3, mesh: { position: { x: -10, z: 0 } } },   // forest
  { harvestType: 'wood', charges: 2, mesh: { position: { x: -12, z: 2 } } },   // forest
  { harvestType: 'stone', charges: 2, mesh: { position: { x: 0, z: 10 } } },   // rock
  { harvestType: 'ore', charges: 2, mesh: { position: { x: 2, z: 12 } } },     // rock
  { harvestType: 'fish', charges: 1, mesh: { position: { x: -2, z: -11 } } },  // water
];

function getBiomeAt(x, z) {
  const pondCenterX = -2;
  const pondCenterZ = -11;
  const pondRadius = 6.5;
  
  const distToPond = Math.hypot(x - pondCenterX, z - pondCenterZ);
  if (distToPond < pondRadius) return 'water';
  
  if (z >= 7 && z <= 15 && x >= -6 && x <= 6) return 'rock';
  if (x >= -14 && x <= -6 && z >= -6 && z <= 6) return 'forest';
  if (x >= 3 && x <= 13 && z >= -6 && z <= 6) return 'meadow';
  
  return 'meadow';
}

function getForageBiome(source) {
  const harvestType = source.harvestType;
  if (harvestType === 'berry' || harvestType === 'grain') return 'meadow';
  if (harvestType === 'wood') return 'forest';
  if (harvestType === 'stone' || harvestType === 'ore') return 'rock';
  if (harvestType === 'water' || harvestType === 'fish') return 'water';
  return getBiomeAt(source.mesh.position.x, source.mesh.position.z);
}

function findBestForageTarget(agentX, agentZ, harvestTypes, preferDifferentBiome) {
  const currentBiome = getBiomeAt(agentX, agentZ);
  
  const candidates = allForageSources
    .filter(s => harvestTypes.includes(s.harvestType) && s.charges > 0)
    .map(s => ({
      source: s,
      biome: getForageBiome(s),
      dist: Math.hypot(s.mesh.position.x - agentX, s.mesh.position.z - agentZ),
    }));
  
  if (preferDifferentBiome) {
    const differentBiome = candidates
      .filter(opt => opt.biome !== currentBiome)
      .sort((a, b) => a.dist - b.dist);
    
    if (differentBiome.length > 0) {
      return differentBiome[0];
    }
  }
  
  // Fallback to nearest
  candidates.sort((a, b) => a.dist - b.dist);
  return candidates[0];
}

console.log('Test: Agent in meadow (8, 0), low wanderlust');
let result = findBestForageTarget(8, 0, ['berry', 'grain'], false);
console.log(`  Found: ${result.source.harvestType} in ${result.biome}, dist=${result.dist.toFixed(1)}`);

console.log('\nTest: Agent in meadow (8, 0), HIGH wanderlust (prefer different biome)');
result = findBestForageTarget(8, 0, ['berry', 'grain'], true);
console.log(`  Found: ${result.source.harvestType} in ${result.biome}, dist=${result.dist.toFixed(1)}`);

console.log('\nTest: Agent in meadow (8, 0), HIGH wanderlust seeking wood');
result = findBestForageTarget(8, 0, ['wood'], true);
console.log(`  Found: ${result.source.harvestType} in ${result.biome}, dist=${result.dist.toFixed(1)}`);
console.log(`  (Should prefer forest wood even though it's farther)`);

console.log('\nTest: Agent in forest (-10, 0), HIGH wanderlust seeking food');
result = findBestForageTarget(-10, 0, ['berry', 'grain'], true);
console.log(`  Found: ${result.source.harvestType} in ${result.biome}, dist=${result.dist.toFixed(1)}`);
console.log(`  (Should prefer meadow food)`);

console.log('\n✓ Biome filtering tests completed');
