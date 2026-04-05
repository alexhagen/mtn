#!/usr/bin/env node

/**
 * Contract Coverage Checker
 * 
 * Ensures that every contract JSON file in contracts/ is tested on both platforms:
 * - TypeScript: src/services/__tests__/contracts.test.ts
 * - Swift: apple/MTNTests/ContractTests.swift
 * 
 * Usage: node scripts/check-contract-coverage.js
 * Exit code: 0 if all contracts are covered, 1 if any are missing
 */

const fs = require('fs');
const path = require('path');

const CONTRACTS_DIR = path.join(__dirname, '../contracts');
const TS_TEST_FILE = path.join(__dirname, '../src/services/__tests__/contracts.test.ts');
const SWIFT_TEST_FILE = path.join(__dirname, '../apple/MTNTests/ContractTests.swift');

function getContractFiles() {
  return fs.readdirSync(CONTRACTS_DIR)
    .filter(file => file.endsWith('.json'))
    .map(file => file.replace('.json', ''));
}

function checkFileReferences(filePath, contracts) {
  const content = fs.readFileSync(filePath, 'utf8');
  const missing = [];
  
  for (const contract of contracts) {
    if (!content.includes(contract)) {
      missing.push(contract);
    }
  }
  
  return missing;
}

function main() {
  console.log('🔍 Checking contract coverage...\n');
  
  // Get all contract files
  const contracts = getContractFiles();
  console.log(`Found ${contracts.length} contract files:`);
  contracts.forEach(c => console.log(`  - ${c}.json`));
  console.log();
  
  // Check TypeScript tests
  console.log('Checking TypeScript tests...');
  const tsMissing = checkFileReferences(TS_TEST_FILE, contracts);
  if (tsMissing.length > 0) {
    console.error('❌ Missing in TypeScript tests:');
    tsMissing.forEach(c => console.error(`  - ${c}`));
  } else {
    console.log('✅ All contracts tested in TypeScript');
  }
  console.log();
  
  // Check Swift tests
  console.log('Checking Swift tests...');
  const swiftMissing = checkFileReferences(SWIFT_TEST_FILE, contracts);
  if (swiftMissing.length > 0) {
    console.error('❌ Missing in Swift tests:');
    swiftMissing.forEach(c => console.error(`  - ${c}`));
  } else {
    console.log('✅ All contracts tested in Swift');
  }
  console.log();
  
  // Summary
  const totalMissing = tsMissing.length + swiftMissing.length;
  if (totalMissing > 0) {
    console.error(`❌ ${totalMissing} contract(s) not fully tested`);
    process.exit(1);
  } else {
    console.log('✅ All contracts are tested on both platforms');
    process.exit(0);
  }
}

main();
