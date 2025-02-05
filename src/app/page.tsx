"use client"

import { useState } from 'react';
import type { NextPage } from 'next';
import { usePrivy } from '@privy-io/react-auth';
import {useConnectWallet} from '@privy-io/react-auth';

const Home: NextPage = () => {
  const [senderWallet, setSenderWallet] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const {getAccessToken} = usePrivy();
  const {connectWallet} = useConnectWallet({
    onSuccess: ({wallet}) => {
      setSenderWallet(wallet.address);
      // Any logic you'd like to execute after a user successfully connects their wallet
    },
    onError: (error) => {
      console.log(error);
      // Any logic you'd like to execute after a user exits the connection flow or there is an error
    },
  });

  // Handle the onboarding form submission
  const handleOnboard = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    const accessToken = await getAccessToken();
    try {
      const res = await fetch('/api/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json',   
                    'Authorization': `Bearer ${accessToken}` },
        body: JSON.stringify({ email, senderWallet }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage('User wallet created successfully!');
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Onboarding error:', error);
      setMessage('Failed to onboard user');
    }
    setLoading(false);
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Crypto Onboarding Demo</h1>
      {!senderWallet && (
        <div>
          <button onClick={connectWallet}>Connect Wallet</button>
        </div>
      )}
      {senderWallet && (
        <div>
          <p>Connected Wallet: {senderWallet}</p>
          <form onSubmit={handleOnboard}>
            <label>
              Recipient Email:
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <button type="submit" disabled={loading}>
              {loading ? 'Onboarding...' : 'Onboard User'}
            </button>
          </form>
        </div>
      )}
      {message && <p>{message}</p>}
    </div>
  );
};

export default Home;
