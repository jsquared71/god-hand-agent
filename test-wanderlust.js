// Quick test to verify wanderlust logic
const state = {
  wanderlust: 0.0,
  currentBiome: null,
  biomeEntryTime: 0,
  lastBiomeVisit: {},
};

function getBiomeAt(x, z) {
  const pondCenterX = -2;
  const pondCenterZ = -11;
  const pondRadius = 6.5;
  
  const distToPond = Math.hypot(x - pondCenterX, z - pondCenterZ);
  if (distToPond < pondRadius) return 'water';
  
  if (z >= 7 && z <= 15 && x >= -6 && x <= 6) return 'rock';
  if (x >= -14 && x <= -6 && z >= -6 && z <= 6) return 'forest';
  if (x >= 3 && x <= 13 && z >= -6 && z <= 6) return 'meadow';
  
  return 'meadow'; // default
}

function updateWanderlust(x, z, dt, isBusy) {
  const currentBiome = getBiomeAt(x, z);
  
  if (currentBiome !== state.currentBiome) {
    const timeSinceLastVisit = state.lastBiomeVisit[currentBiome] || 999;
    
    if (timeSinceLastVisit > 30) {
      state.wanderlust = Math.max(0, state.wanderlust - 0.5);
    } else if (timeSinceLastVisit > 10) {
      state.wanderlust = Math.max(0, state.wanderlust - 0.3);
    }
    
    if (state.currentBiome) {
      state.lastBiomeVisit[state.currentBiome] = 0;
    }
    state.currentBiome = currentBiome;
    state.biomeEntryTime = 0;
  }
  
  if (state.currentBiome) {
    state.biomeEntryTime += dt;
    for (const biome in state.lastBiomeVisit) {
      if (biome !== state.currentBiome) {
        state.lastBiomeVisit[biome] += dt;
      }
    }
  }
  
  let wanderlustGain = 0.015 * dt;
  if (isBusy) wanderlustGain *= 2.0;
  state.wanderlust = Math.min(1, state.wanderlust + wanderlustGain);
}

console.log('Test 1: Starting in meadow, staying for 70s');
for (let i = 0; i < 70; i++) {
  updateWanderlust(8, 0, 1.0, false);
  if (i % 10 === 0) {
    console.log(`  t=${i}s: wanderlust=${state.wanderlust.toFixed(2)}, biome=${state.currentBiome}`);
  }
}

console.log('\nTest 2: Moving to forest (should drop wanderlust)');
updateWanderlust(-10, 0, 1.0, false);
console.log(`  After move: wanderlust=${state.wanderlust.toFixed(2)}, biome=${state.currentBiome}`);

console.log('\nTest 3: Staying in forest for 30s');
for (let i = 0; i < 30; i++) {
  updateWanderlust(-10, 0, 1.0, false);
  if (i % 10 === 0) {
    console.log(`  t=${i}s: wanderlust=${state.wanderlust.toFixed(2)}, biome=${state.currentBiome}`);
  }
}

console.log('\nTest 4: Back to meadow (should drop less since visited recently)');
updateWanderlust(8, 0, 1.0, false);
console.log(`  After move: wanderlust=${state.wanderlust.toFixed(2)}, biome=${state.currentBiome}`);

console.log('\nTest 5: Foraging in meadow (2x gain rate)');
for (let i = 0; i < 20; i++) {
  updateWanderlust(8, 0, 1.0, true);
  if (i % 5 === 0) {
    console.log(`  t=${i}s: wanderlust=${state.wanderlust.toFixed(2)}`);
  }
}

console.log('\n✓ All tests completed');
