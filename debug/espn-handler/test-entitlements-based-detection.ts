#!/usr/bin/env node

/**
 * Test script to test the new entitlements-based ESPN Ultimate detection
 * Based on the BAM GraphQL endpoint that returns user entitlements
 */

import {espnHandler} from '../../services/espn-handler';
import {db} from '../../services/database';
import {userAgent} from '../../services/user-agent';
import axios from 'axios';

async function testEntitlementsQuery() {
  console.log('🧪 Testing BAM entitlements query...');

  try {
    // Initialize handler and get tokens
    await espnHandler.initialize();
    await espnHandler.refreshTokens();

    const espnplus = await db.providers.findOneAsync({name: 'espnplus'});

    // Check for account refresh token first, then fall back to device refresh token
    const refreshToken =
      espnplus?.tokens?.account_token?.refresh_token || espnplus?.tokens?.device_refresh_token?.refresh_token;

    if (!refreshToken) {
      console.log('❌ No refresh token available for testing');
      return false;
    }

    const tokenType = espnplus?.tokens?.account_token?.refresh_token ? 'account' : 'device';
    console.log(`✅ Using ${tokenType} refresh token`);

    // Test the entitlements query directly
    const entitlementsQuery = {
      operationName: 'refreshToken',
      query: `
        mutation refreshToken($input: RefreshTokenInput!) {
          refreshToken(refreshToken: $input) {
            activeSession {
              sessionId
            }
          }
        }
      `,
      variables: {
        input: {
          refreshToken,
        },
      },
    };

    console.log('🔍 Querying BAM device GraphQL endpoint...');

    // Use the same constants as the main handler
    const BAM_API_KEY = 'ZXNwbiZicm93c2VyJjEuMC4w.ptUt7QxsteaRruuPmGZFaJByOoqKvDP2a5YkInHrc7c';
    const BAM_CLIENT_ID = 'espn-a9b93989';
    const BAM_SDK_VERSION = '32.5';
    const BAM_DEVICE_GRAPHQL_ENDPOINT = 'https://espn.api.edge.bamgrid.com/graph/v1/device/graphql';

    const {data: refreshResponse} = await axios.post(BAM_DEVICE_GRAPHQL_ENDPOINT, entitlementsQuery, {
      headers: {
        Authorization: BAM_API_KEY,
        'Content-Type': 'application/json',
        'User-Agent': userAgent,
        'x-bamsdk-client-id': BAM_CLIENT_ID,
        'x-bamsdk-platform': 'javascript/browser/chrome',
        'x-bamsdk-version': BAM_SDK_VERSION,
      },
    });

    console.log('✅ GraphQL query successful!');

    // Let's examine the full response structure first
    console.log('\n🔍 Full Response Structure:');
    console.log(JSON.stringify(refreshResponse, null, 2));

    // Extract entitlements
    const entitlements = refreshResponse?.extensions?.sdk?.session?.entitlements;

    if (entitlements && Array.isArray(entitlements)) {
      console.log('\n📋 User entitlements found:');
      entitlements.forEach((entitlement, index) => {
        console.log(`   ${index + 1}. ${entitlement}`);
      });

      // Check for ESPN Ultimate/Flagship entitlements
      const ultimateEntitlements = entitlements.filter(
        entitlement =>
          entitlement === 'ESPN_FLAGSHIP' || entitlement === 'espn:flagship' || entitlement.includes('flagship'),
      );

      if (ultimateEntitlements.length > 0) {
        console.log('\n🏆 ESPN Ultimate entitlements detected:');
        ultimateEntitlements.forEach(entitlement => {
          console.log(`   ✅ ${entitlement}`);
        });

        console.log('\n🎯 Result: ESPN Ultimate subscription CONFIRMED');
        return true;
      } else {
        console.log('\n❌ No ESPN Ultimate entitlements found');
        console.log('   This indicates the user does not have ESPN Ultimate subscription');
        return false;
      }
    } else {
      console.log('❌ No entitlements data found in expected location');
      console.log('   Expected path: extensions.sdk.session.entitlements');
      console.log("   Let's check other possible locations...");

      // Check alternative paths
      if (refreshResponse?.data) {
        console.log('   ✓ Found refreshResponse.data');
      }
      if (refreshResponse?.extensions) {
        console.log('   ✓ Found refreshResponse.extensions');
        if (refreshResponse.extensions.sdk) {
          console.log('   ✓ Found refreshResponse.extensions.sdk');
          if (refreshResponse.extensions.sdk.session) {
            console.log('   ✓ Found refreshResponse.extensions.sdk.session');
            console.log('   📋 Session keys:', Object.keys(refreshResponse.extensions.sdk.session));
          }
        }
      }

      return false;
    }
  } catch (error) {
    console.error('❌ Entitlements query failed:', error.message);

    if (error.response?.data) {
      console.log('Error response data:', JSON.stringify(error.response.data, null, 2));
    }

    return false;
  }
}

async function testFullDetection() {
  console.log('\n🧪 Testing full ESPN Ultimate auto-detection...');

  try {
    // Reset Ultimate to false for testing
    await db.providers.updateAsync({name: 'espnplus'}, {$set: {'meta.ultimate_subscription': false}});
    console.log('🔧 Reset Ultimate subscription to false for testing');

    // Test the new detection method
    const detected = await espnHandler.detectUltimateSubscription();

    console.log('\n📊 Detection Results:');
    console.log('   Ultimate detected:', detected ? '✅ Yes' : '❌ No');

    // Check final state
    const finalState = await db.providers.findOneAsync({name: 'espnplus'});
    console.log('   Ultimate enabled in DB:', finalState?.meta?.ultimate_subscription || false);

    return detected;
  } catch (error) {
    console.error('❌ Full detection test failed:', error.message);
    return false;
  }
}

async function main() {
  console.log('🧪 ESPN Ultimate Entitlements-Based Detection Test');
  console.log('==================================================\n');

  try {
    // Check token status first
    const espnplus = await db.providers.findOneAsync({name: 'espnplus'});

    if (!espnplus?.enabled || !espnplus?.tokens?.tokens?.id_token) {
      console.log('❌ ESPN+ not enabled or missing tokens');
      console.log('💡 Please authenticate ESPN+ first:');
      console.log('   1. Start the server: npm start');
      console.log('   2. Go to http://localhost:8000');
      console.log('   3. Click ESPN+ provider and authenticate');
      return;
    }

    console.log('✅ ESPN+ is enabled with valid tokens\n');

    // Test 1: Direct entitlements query
    console.log('=== Test 1: Direct Entitlements Query ===');
    const directResult = await testEntitlementsQuery();

    // Test 2: Full detection method
    console.log('\n=== Test 2: Full Detection Method ===');
    const detectionResult = await testFullDetection();

    // Summary
    console.log('\n📊 Test Summary:');
    console.log('================');
    console.log('Direct entitlements query:', directResult ? '✅ Success' : '❌ Failed');
    console.log('Full detection method:', detectionResult ? '✅ Success' : '❌ Failed');

    if (directResult && detectionResult) {
      console.log('\n🎉 SUCCESS: ESPN Ultimate auto-detection is working perfectly!');
      console.log('   The system can now automatically detect Ultimate subscriptions');
      console.log("   by checking the ESPN_FLAGSHIP entitlement in the user's account.");
    } else if (directResult && !detectionResult) {
      console.log('\n⚠️  Entitlements found but detection method failed');
      console.log('   This indicates an implementation issue in the detection logic');
    } else if (!directResult) {
      console.log('\n❌ No ESPN Ultimate entitlements found');
      console.log('   This means the account does not have ESPN Ultimate subscription');
    }

    console.log('\n💡 Next Steps:');
    console.log("   1. If Ultimate was detected, check the web UI to confirm it's enabled");
    console.log('   2. Try accessing linear ESPN channels in your media player');
    console.log('   3. The detection runs automatically during ESPN handler initialization');
  } catch (error) {
    console.error('❌ Test execution failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

if (require.main === module) {
  main();
}
