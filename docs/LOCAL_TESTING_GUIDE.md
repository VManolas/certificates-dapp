http://localhost:5173/
# 🧪 Local Testing Guide - Step by Step

This guide assumes the `localHardhat` path:
- RPC URL: `http://127.0.0.1:8545`
- Chain ID: `1337`
- Deploy command: `cd contracts && npm run deploy:local`

## ✅ System Status

All services are running and ready for testing!

| Service | Status | URL/Address |
|---------|--------|-------------|
| **Hardhat Node (`localHardhat`)** | ✅ Running | http://localhost:8545 |
| **AuthVerifier** | ✅ Deployed | see `VITE_VERIFIER_ADAPTER_ADDRESS` in `frontend/.env.local` |
| **ZKAuthRegistry** | ✅ Deployed | see `VITE_ZK_AUTH_REGISTRY_ADDRESS` in `frontend/.env.local` |
| **Frontend** | ✅ Running | http://localhost:5173 |

> Addresses are assigned fresh on every `npm run deploy:local` — always check `frontend/.env.local` for the current deployment rather than relying on hardcoded values in this guide.

---

## 📝 Step-by-Step Testing Instructions

### Step 1: Setup MetaMask for Local Testing

1. **Open MetaMask** in your browser

2. **Add Hardhat Network**:
   - Click on network dropdown (top center)
   - Click "Add Network" → "Add a network manually"
   - Fill in:
     - **Network Name**: `Hardhat Local`
     - **RPC URL**: `http://localhost:8545`
     - **Chain ID**: `1337`
     - **Currency Symbol**: `ETH`
   - Click "Save"

3. **Import Test Account**:
   - Click account icon → "Import Account"
   - Select "Private Key"
   - Paste: `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`
   - This is Hardhat's test account #0 with 10,000 ETH
   - Address: `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`

4. **Switch to Hardhat Network**:
   - Click network dropdown
   - Select "Hardhat Local"

---

### Step 2: Open the Application

1. Open browser and navigate to: **http://localhost:5173**

2. You should see the zkCredentials homepage

---

### Step 3: Test Wallet Connection

1. **Click "Connect Wallet"** button

2. **MetaMask will pop up**:
   - Click "Next"
   - Click "Connect"
   - Approve the connection

3. **Verify**:
   - ✅ You should see your wallet address displayed
   - ✅ Balance should show ~10,000 ETH
   - ✅ Network should show "Hardhat Local" or Chain ID 1337

**Expected Result**: Wallet connected successfully

---

### Step 4: Test Registration (Student with ZK)

1. **Navigate to Registration**:
   - Click "Register" or "Get Started"

2. **Select Role**:
   - Choose **"Student"** (recommended for ZK auth)
   - Students have both ZK and Web3 auth methods available

3. **Choose Auth Method**:
   - Select **"ZK Authentication (Privacy-Preserving)"**
   - This will generate ZK credentials

4. **Generate Credentials**:
   - Click "Generate Credentials" button
   - Wait a moment (generates random keys)
   - ✅ You should see:
     - Private Key (shown once)
     - Salt (shown once)
     - Commitment (this goes on-chain)

5. **IMPORTANT - Save Credentials**:
   - The app will show your private key and salt
   - **Copy and save these somewhere safe**
   - You'll need them for login
   - The app will encrypt and store them locally

6. **Submit Registration**:
   - Click "Register" button
   - MetaMask will pop up asking to sign
   - Click "Sign" to encrypt credentials
   - MetaMask will pop up again for transaction
   - Click "Confirm" to submit commitment to blockchain
   - Wait for transaction confirmation (~2 seconds)

7. **Verify Registration**:
   - ✅ You should see "Registration Successful!"
   - ✅ Credentials stored encrypted in browser
   - ✅ Commitment registered on blockchain

**Expected Result**: Registration completes without errors

---

### Step 5: Test Logout

1. **Click "Logout"** (if not already logged out)

2. **Verify**:
   - ✅ You're redirected to homepage or login page
   - ✅ Session cleared

---

### Step 6: Test ZK Login

1. **Navigate to Login Page**

2. **Click "Login with ZK Proof"**

3. **Sign to Decrypt Credentials**:
   - MetaMask will pop up asking for signature
   - Click "Sign"
   - This decrypts your stored credentials
   - No gas cost!

4. **Generate ZK Proof** (automatic):
   - App generates a real Groth16 proof from your credentials, in the browser
   - The contracts deploy with a real Groth16 verifier by default (`VERIFIER_TYPE=mock` opts into the always-true mock instead)

5. **Submit Login**:
   - Click "Login" button
   - MetaMask pops up for transaction
   - Click "Confirm"
   - Wait for confirmation (~2 seconds)

6. **Verify Login Success**:
   - ✅ You should see "Login Successful!"
   - ✅ Redirected to Student Dashboard
   - ✅ Session active
   - ✅ Can access student features

**Expected Result**: Successful login with ZK proof

---

### Step 7: Verify Session and Access Control

1. **Check Dashboard**:
   - ✅ Student Dashboard loads
   - ✅ Your commitme nt/role displayed
   - ✅ Can navigate student features

2. **Test Access Control** (try accessing admin routes):
   - Try navigating to `/admin/dashboard`
   - ✅ Should be blocked or redirected
   - ✅ Only student routes accessible

3. **Check Session Persistence**:
   - Refresh the page
   - ✅ Still logged in
   - ✅ Dashboard still accessible

4. **Test Logout Again**:
   - Click "Logout"
   - ✅ Session cleared
   - ✅ Redirected to public page
   - ✅ Cannot access dashboard anymore

**Expected Result**: Proper access control and session management

---

## 🔍 What to Look For

### ✅ Success Indicators:

1. **Registration**:
   - [ ] Credentials generated without errors
   - [ ] Commitment computed correctly
   - [ ] Transaction confirmed on blockchain
   - [ ] Credentials stored encrypted locally

2. **Login**:
   - [ ] Signature request for decryption
   - [ ] Proof generation completes
   - [ ] Login transaction confirms
   - [ ] Redirected to appropriate dashboard

3. **Session**:
   - [ ] Dashboard loads correctly
   - [ ] Role-specific features visible
   - [ ] Access control working
   - [ ] Can logout successfully

### ⚠️ What Might Go Wrong:

1. **"Network Error"**:
   - Check Hardhat node is running (should be!)
   - Check MetaMask is on Chain ID 1337
   - Check RPC URL is http://localhost:8545

2. **"Transaction Failed"**:
   - Check you have ETH (Hardhat account has 10,000)
   - Check contract addresses are correct
   - Look at browser console for errors

3. **"Cannot Decrypt Credentials"**:
   - Make sure you signed with the same wallet
   - Try clearing localStorage and re-registering
   - Check browser console for errors

4. **"Invalid Proof"**:
   - The default local deployment uses a real Groth16 verifier, so a malformed proof or mismatched public inputs will genuinely fail
   - Check browser console for the proof-generation inputs
   - If you deployed with `VERIFIER_TYPE=mock`, this shouldn't happen (the mock always returns true)

---

## 🧪 Testing Different Scenarios

### Test 1: Multiple Users

1. Import additional Hardhat accounts:
   - Account #1: `0x70997970C51812dc3A010C7d01b50e0d17dc79C8`
   - Private Key: `0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d`

2. Register as different roles:
   - Student (ZK auth)
   - University (Web3 auth)
   - Employer (Web3 or ZK)

3. Test switching between accounts

### Test 2: Privacy Verification

1. **Register as Student**
2. **Check what's on blockchain**:
   - Open Hardhat node terminal
   - Look at transaction logs
   - ✅ Only the commitment (hash) is registered, never the private key or salt
   - ⚠️ The wallet address (`msg.sender`) IS visible on-chain for both registration and login — it is pseudonymous, not unlinkable. See `ZKAuthRegistry.sol`'s contract docstring for the full threat-model note.

### Test 3: Re-Registration

1. **Logout**
2. **Clear credentials** (in app settings if available)
3. **Register again with same wallet**
4. **Different credentials should be generated**

---

## 🐛 Debugging Tips

### Check Browser Console

```javascript
// Open browser console (F12) and run:

// Check if contracts are loaded
console.log('ZKAuthRegistry:', import.meta.env.VITE_ZK_AUTH_REGISTRY_ADDRESS);

// Check stored credentials
console.log('Stored:', localStorage.getItem('zkauth_encrypted_credentials'));

// Check network
window.ethereum.request({ method: 'net_version' })
  .then(id => console.log('Chain ID:', id));
```

### Check Hardhat Node

In the terminal where Hardhat node is running, you'll see:
- Contract calls
- Transaction hashes
- Gas used
- Events emitted

### Check Smart Contract State

```bash
# In a new terminal
cd contracts

# Check if user is registered
npx hardhat console --network localhost

# In the console (use the address from frontend/.env.local's VITE_ZK_AUTH_REGISTRY_ADDRESS):
const registry = await ethers.getContractAt("ZKAuthRegistry", "YOUR_DEPLOYED_ADDRESS");
const commitment = "YOUR_COMMITMENT_HERE";
await registry.isRegistered(commitment);
```

---

## 📊 Expected Performance

| Operation | Time | Gas (approx) |
|-----------|------|--------------|
| Generate Credentials | ~100ms | 0 (off-chain) |
| Compute Commitment | ~50ms | 0 (off-chain) |
| Register (on-chain) | ~2s | ~100k gas |
| Generate Groth16 Proof | varies by device; run `npm run benchmark:proof-generation` in `contracts/` for current numbers | 0 (off-chain) |
| Login (on-chain) | ~2s | ~80k gas |
| Decrypt Credentials | ~50ms | 0 (off-chain) |

---

## ✅ Testing Checklist

Use this to track your testing:

- [ ] MetaMask configured for Hardhat
- [ ] Test account imported
- [ ] Wallet connected to app
- [ ] Student registration completed
- [ ] Credentials saved
- [ ] Logged out successfully
- [ ] Logged in with ZK proof
- [ ] Dashboard accessible
- [ ] Access control working
- [ ] Session persists on refresh
- [ ] Logout clears session

---

## 🎉 Success Criteria

Your system is working correctly if:

✅ All services are running  
✅ Wallet connects without issues  
✅ Registration completes successfully  
✅ Credentials are encrypted and stored  
✅ Login works with generated proofs  
✅ Dashboard loads and is functional  
✅ Access control prevents unauthorized access  
✅ Logout properly clears session  

---

## 📞 Need Help?

### Check Logs:

1. **Browser Console** (F12): Frontend errors
2. **Hardhat Terminal**: Contract interactions
3. **Frontend Terminal**: React/Vite errors

### Common Issues:

1. **Port already in use**: Kill the process or use different port
2. **MetaMask won't connect**: Reset connection in MetaMask settings
3. **Transaction fails**: Check you're on correct network and have ETH
4. **State issues**: Clear browser cache/localStorage

---

## 🚀 You're All Set!

**Open http://localhost:5173 and start testing!**

Follow the steps above and check off each item as you go.

---

*Happy Testing! 🎉*
